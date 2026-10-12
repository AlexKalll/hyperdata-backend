// dataset.consumer.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  MessageErrorHandler,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import { ConfirmChannel, Message } from 'amqplib';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { setTimeout as delay } from 'timers/promises';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { DataSource, QueryRunner } from 'typeorm';
import { ReviewerTasks } from 'src/task_distribution/enitities/ReviewerTasks.entity';
import { UserTaskService } from 'src/project/service/UserTask.service';
import { CacheService } from 'src/cache/CacheService.service';
import { WalletService } from 'src/finance/service/Wallet.service';
import { NotificationService } from 'src/common/service/Notification.service';
import { ScoreValueService } from 'src/finance/service/ScoreValue.service';
import { UserScoreService } from 'src/auth/service/UserScore.service';
import { MicroTaskService } from 'src/data_set/service/MicroTask.service';
import { TaskService } from 'src/project/service/Task.service';
import { UserTask } from 'src/project/entities/UserTask.entity';
import { MicroTask } from 'src/data_set/entities/MicroTask.entity';
import { checkIfMicroTasIskRejectedAndTotalAttempts } from 'src/utils/MicroTask.util';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';

const datasetQueue = process.env.DATASET_RABBITMQ_QUEUE_NAME || 'dataset.queue';
const retryDelays = [5000, 15000];
const failureLogger = new Logger('DatasetFailureHandler');

export const hasPassedAllContributorTests = (
  testMicroTasks: MicroTask[],
  contributorId: string,
): boolean => {
  if (testMicroTasks.length === 0) return false;

  return testMicroTasks.every((microTask) => {
    const contributorDataSets = (microTask.dataSets ?? []).filter(
      (dataSet) => dataSet.contributor_id === contributorId,
    );
    if (contributorDataSets.length === 0) return false;

    return (
      checkIfMicroTasIskRejectedAndTotalAttempts(
        { ...microTask, dataSets: contributorDataSets },
        3,
      ).acceptanceStatus === 'APPROVED'
    );
  });
};

// Preserve the original bytes (including malformed JSON), then acknowledge
// only after the broker confirms the persistent copy in the failure queue.
export const preserveFailedDatasetAction: MessageErrorHandler = async (
  channel,
  message,
  error: unknown,
) => {
  const failedQueue = `${datasetQueue}.failed`;
  const confirmChannel = channel as ConfirmChannel;
  const messageId = randomUUID();
  let returned = false;
  const onReturn = (item: Message) => {
    if (item.properties.messageId === messageId) returned = true;
  };
  try {
    if (typeof confirmChannel.waitForConfirms !== 'function') {
      throw new Error('Publisher confirms unavailable');
    }
    await channel.assertQueue(failedQueue, { durable: true });
    channel.on('return', onReturn);
    await new Promise<void>((resolve, reject) => {
      confirmChannel.sendToQueue(
        failedQueue,
        message.content,
        {
          persistent: true,
          mandatory: true,
          messageId,
          correlationId: message.properties.correlationId,
          contentType: message.properties.contentType,
          contentEncoding: message.properties.contentEncoding,
          headers: {
            ...message.properties.headers,
            'x-original-queue': datasetQueue,
            'x-original-message-id': message.properties.messageId || '',
            'x-failed-at': new Date().toISOString(),
            'x-failure-type':
              error instanceof Error ? error.name : 'UnknownError',
          },
        },
        (publishError: unknown) => {
          if (publishError)
            reject(
              publishError instanceof Error
                ? publishError
                : new Error('Publish failed'),
            );
          else if (returned) reject(new Error('Failure queue is unavailable'));
          else resolve();
        },
      );
    });
    channel.ack(message);
    failureLogger.error(`Dataset action preserved in ${failedQueue}`);
  } catch {
    // If the broker cannot retain the copy, keep the original message. Never
    // fall back to an immediate requeue loop, even during a broker outage.
    failureLogger.error(
      'Unable to preserve dataset action; retrying after 30s',
    );
    await delay(30000);
    try {
      channel.nack(message, false, true);
    } catch {
      // A closed channel automatically returns unacknowledged messages.
    }
  } finally {
    channel.removeListener('return', onReturn);
  }
};

@Injectable()
export class DatasetConsumer {
  private readonly logger = new Logger(DatasetConsumer.name);

  constructor(
    // Inject necessary services here
    private readonly dataSource: DataSource,
    private readonly userTaskService: UserTaskService,
    private readonly cacheService: CacheService,
    private readonly scoreService: ScoreValueService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly userScoreService: UserScoreService,
    private readonly taskService: TaskService,
    private readonly microTaskService: MicroTaskService,
  ) {}
  @RabbitSubscribe({
    exchange: process.env.DATASET_RABBITMQ_EXCHANGE_NAME || 'dataset.exchange',
    routingKey: process.env.DATASET_RABBITMQ_ROUTING_KEY || 'dataset.action',
    queue: datasetQueue,
    queueOptions: {
      durable: true,
      channel: 'dataset-actions',
    },
    errorHandler: preserveFailedDatasetAction,
  })
  async handleDatasetAction(message: {
    datasetId: string;
    action: 'APPROVED' | 'REJECTED';
    timestamp: string;
  }): Promise<void> {
    if (
      !message ||
      typeof message.datasetId !== 'string' ||
      !isUUID(message.datasetId) ||
      !['APPROVED', 'REJECTED'].includes(message.action)
    ) {
      throw new Error('Invalid dataset action');
    }

    // Keep the durable delivery unacknowledged during backoff. Three attempts
    // per delivery; persistent failures then go to the failure queue above.
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        if (message.action === 'REJECTED') {
          await this.handleRejected(message.datasetId);
        } else {
          await this.handleApproved(message.datasetId);
        }
        return;
      } catch (error) {
        if (attempt === retryDelays.length) throw error;
        this.logger.warn(`Dataset action retry ${attempt + 1} scheduled`);
        await delay(retryDelays[attempt]);
      }
    }
  }

  private async removeReviewedAssignment(
    dataSet: DataSet,
    queryRunner: QueryRunner,
  ): Promise<void> {
    // The review endpoint already authorized and recorded this decision.
    // Settlement may run after assignment expiry or cleanup; removal must be
    // idempotent and must not re-authorize an already completed review.
    await queryRunner.manager
      .createQueryBuilder()
      .update(ReviewerTasks)
      .set({ data_set_ids: () => 'array_remove(data_set_ids, :dataSetId)' })
      .where('reviewer_id = :reviewerId', { reviewerId: dataSet.reviewer_id })
      .andWhere('task_id = :taskId', { taskId: dataSet.microTask.task.id })
      .andWhere(':dataSetId = ANY(data_set_ids)', { dataSetId: dataSet.id })
      .execute();
  }

  private async handleRejected(datasetId: string) {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      //  Get the dataset
      const lockedDataSet = await queryRunner.manager.findOne(DataSet, {
        where: { id: datasetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedDataSet) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(`Dataset with id ${datasetId} not found.`);
        return;
      }
      const dataSet = await queryRunner.manager.findOne(DataSet, {
        where: { id: datasetId },
        relations: {
          microTask: {
            task: { payment: true },
          },
          reviewer: true,
          contributor: true,
        },
      });
      if (!dataSet) throw new Error(`Dataset with id ${datasetId} disappeared`);
      if (
        dataSet.status !== DataSetStatus.REJECTED ||
        dataSet.is_paid_for_reviewer
      ) {
        await queryRunner.commitTransaction();
        return;
      }
      //  Remove Assignment from reviewer
      await this.removeReviewedAssignment(dataSet, queryRunner);
      //  const membership=await this.userTaskService.findOne({
      //       where:{
      //         user_id: dataSet.reviewer.id,
      //         task_id: dataSet.microTask.task.id
      //       },
      //       relations:{user:{userDeviceTokens:true}}
      //     })
      //  If test  - Reject user member ship
      //           - Clear Contributor task cache
      if (
        dataSet.microTask.task.require_contributor_test &&
        dataSet.microTask.is_test
      ) {
        // set user Task to rejected
        await this.userTaskService.rejectUserTask(
          {
            user_id: dataSet.contributor_id,
            task_id: dataSet.microTask.task.id,
          },
          queryRunner,
        );
        // Update contributor cache
        await this.cacheService.clearContributorTaskCache(
          dataSet.contributor_id,
          dataSet.microTask.task_id,
        );
      }

      // Credit user wallet
      const scoreValue = await this.scoreService.get();
      const score = scoreValue.value_in_birr;
      await this.walletService.addFunds(
        dataSet.reviewer.id,
        dataSet.microTask.task.payment.reviewer_credit_per_microtask * score,
        {
          data_set_id: dataSet.id,
          code: dataSet.code,
        },
        queryRunner,
      );
      await queryRunner.manager.update(DataSet, dataSet.id, {
        is_paid_for_reviewer: true,
      });
      // Send Notification to the user
      await this.notificationService.create({
        user_id: dataSet.contributor_id,
        title: 'Task Rejected',
        message:
          'Your task with code ' +
          dataSet.code +
          ' on task ' +
          dataSet.microTask.task.name +
          'has been rejected. Please try again.',
        type: 'task-rejected',
      });
      // update the user score
      await this.userScoreService.updateScore(
        dataSet.contributor_id,
        'REJECT',
        queryRunner,
      );
      await queryRunner.commitTransaction();
    } catch (err) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async handleApproved(datasetId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      // get data sets
      const lockedDataSet = await queryRunner.manager.findOne(DataSet, {
        where: { id: datasetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedDataSet) {
        await queryRunner.commitTransaction();
        return;
      }
      const dataSet = await queryRunner.manager.findOne(DataSet, {
        where: { id: datasetId },
        relations: {
          microTask: {
            task: { payment: true },
          },
          reviewer: true,
          contributor: true,
        },
      });
      if (!dataSet) throw new Error(`Dataset with id ${datasetId} disappeared`);
      if (dataSet.status !== DataSetStatus.APPROVED) {
        await queryRunner.commitTransaction();
        return;
      }
      if (dataSet.is_paid_for_contributor && dataSet.is_paid_for_reviewer) {
        await queryRunner.commitTransaction();
        return;
      }
      // remove reviewer assignment
      await this.removeReviewedAssignment(dataSet, queryRunner);
      const taskPayment = dataSet?.microTask.task.payment;
      const memberContributor: UserTask | null =
        await this.userTaskService.findOne({
          where: {
            user_id: dataSet.contributor_id,
            task_id: dataSet.microTask.task.id,
          },
        });
      const create = {
        task_id: dataSet.microTask.task.id,
        user_id: dataSet.contributor_id,
      };
      //  activate contributor task
      //  clear contributor task cache
      if (
        !memberContributor &&
        !dataSet.microTask.task.require_contributor_test
      ) {
        await this.taskService.activateContributorToTask(create, queryRunner);
        await this.cacheService.clearContributorTaskCache(
          dataSet.contributor_id,
        );
      } else if (
        dataSet.microTask.task.require_contributor_test &&
        dataSet.microTask.is_test
      ) {
        // Require an approved submission for every test microtask before
        // activating the contributor. Loading only test tasks with existing
        // submissions would let a partial exam appear complete.
        const contributorTestMicroTasks: MicroTask[] =
          await this.microTaskService.findAllTestMicroTasks({
            where: {
              task_id: dataSet.microTask.task.id,
            },
            relations: {
              dataSets: true,
            },
          });
        if (
          hasPassedAllContributorTests(
            contributorTestMicroTasks,
            dataSet.contributor_id,
          )
        ) {
          await this.taskService.activateContributorToTask(create, queryRunner);
        }
        await this.cacheService.clearContributorTaskCache(
          dataSet.contributor_id,
          dataSet.microTask.task_id,
        );
      }

      // credit contributor and reviewer wallet
      const score = await this.scoreService.get();
      const scoreValueInBIRR = score.value_in_birr;
      if (!dataSet.is_paid_for_contributor) {
        await this.walletService.addFunds(
          dataSet.contributor_id,
          taskPayment.contributor_credit_per_microtask * scoreValueInBIRR,
          { data_set_id: datasetId, code: dataSet.code },
          queryRunner,
        );
        dataSet.is_paid_for_contributor = true;
      }

      if (!dataSet.is_paid_for_reviewer) {
        await this.walletService.addFunds(
          dataSet.reviewer.id,
          taskPayment.reviewer_credit_per_microtask * scoreValueInBIRR,
          { data_set_id: datasetId, code: dataSet.code },
          queryRunner,
        );
        dataSet.is_paid_for_reviewer = true;
      }
      await queryRunner.manager.save(dataSet);
      // create and send notification to contributor
      await this.notificationService.create({
        user_id: dataSet.contributor_id,
        title: 'Task Approved',
        message:
          'Your task with code ' +
          dataSet.code +
          ' on task ' +
          dataSet.microTask.task.name +
          ' has been approved.',
        type: 'task-approved',
      });
      // update contributor score
      // await this.userScoreService.updateScore(
      //       dataSet.contributor_id,
      //       UserScoreAction.ACCEPT,
      //       queryRunner,
      //     );
      await queryRunner.commitTransaction();
      return;
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
