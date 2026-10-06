// dataset.consumer.ts
import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { DataSource, QueryRunner } from 'typeorm';
import { ReviewerTaskService } from 'src/task_distribution/service/ReviewerTasks.service';
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
@Injectable()
export class DatasetConsumer {
  private readonly logger = new Logger(DatasetConsumer.name);

  constructor(
    // Inject necessary services here
    private readonly dataSource: DataSource,
    private readonly reviewerTaskService: ReviewerTaskService,
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
    queue: process.env.DATASET_RABBITMQ_QUEUE_NAME || 'dataset.queue',
    queueOptions: {
      durable: true,
    },
  })
  async handleDatasetAction(message: {
    datasetId: string;
    action: 'APPROVED' | 'REJECTED';
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`Processing dataset ${message.datasetId}`);

    if (message.action === 'REJECTED') {
      await this.handleRejected(message.datasetId);
    }

    if (message.action === 'APPROVED') {
      await this.handleApproved(message.datasetId);
    }
    return;
  }

  private async handleRejected(datasetId: string) {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
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
      await this.reviewerTaskService.checkAndRemoveDataSetFromReviewer(
        dataSet.reviewer.id,
        dataSet.microTask.task.id,
        dataSet.id,
        queryRunner,
      );
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
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error processing dataset ${datasetId}: ${err.message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async handleApproved(datasetId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
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
      await this.reviewerTaskService.checkAndRemoveDataSetFromReviewer(
        dataSet.reviewer.id,
        dataSet.microTask.task.id,
        datasetId,
        queryRunner,
      );
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
        // check if all the test micro tasks are approved
        const contributorTestMicroTasks: MicroTask[] =
          await this.microTaskService.findAllTestMicroTasks({
            where: {
              task_id: dataSet.microTask.task.id,
              is_test: true,
              dataSets: {
                contributor_id: dataSet.contributor_id,
              },
            },
            relations: {
              dataSets: true,
            },
          });
        if (contributorTestMicroTasks.length == 1) {
          await this.taskService.activateContributorToTask(create, queryRunner);
        } else {
          let has_pending = false;
          let has_rejected = false;
          for (const task of contributorTestMicroTasks) {
            const statusOfMicroTask =
              checkIfMicroTasIskRejectedAndTotalAttempts(task, 3);
            if (task.id == dataSet.micro_task_id) {
              continue;
            }
            if (
              statusOfMicroTask.acceptanceStatus === 'PENDING' ||
              statusOfMicroTask.acceptanceStatus === 'NOT_STARTED'
            ) {
              has_pending = true;
              break;
            }
            if (statusOfMicroTask.acceptanceStatus === 'REJECTED') {
              has_rejected = true;
              break;
            }
            // break;
          }
          if (!has_rejected && !has_pending) {
            await this.taskService.activateContributorToTask(
              create,
              queryRunner,
            );
            await this.cacheService.clearContributorTaskCache(
              dataSet.contributor_id,
              dataSet.microTask.task_id,
            );
          }
        }
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
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
