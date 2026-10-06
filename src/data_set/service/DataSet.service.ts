import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, QueryRunner, Repository } from 'typeorm';
import { PaginationService } from 'src/common/service/pagination.service';
import { QueryOptions } from 'src/utils/queryOption.util';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { DataSet } from '../entities/DataSet.entity';
import { MicroTaskService } from './MicroTask.service';
import { TaskService } from 'src/project/service/Task.service';
import { Task } from 'src/project/entities/Task.entity';
import { RejectionReason } from '../entities/RejectionReason.entity';
import { RejectionReasonService } from './RejectionReason.service';
import { paginate, PaginatedResult } from 'src/utils/paginate.util';
import { FileService } from 'src/common/service/File.service';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';
import { DataSetType, taskTypes } from 'src/utils/constants/Task.constant';
import { TaskRequirement } from 'src/project/entities/TaskRequirement.entity';
import { User } from 'src/auth/entities/User.entity';
import { UserTaskService } from 'src/project/service/UserTask.service';
import { UserTask } from 'src/project/entities/UserTask.entity';
import { startOfDay, startOfYear, subDays } from 'date-fns';
import { DataSetAnnotationService } from 'src/base_data/service/DataSetAnnotation.service';
import { DataSetAnnotation } from 'src/base_data/entities/DataSetAnnotation.entity';

import { ReviewerTaskService } from 'src/task_distribution/service/ReviewerTasks.service';
import { DataSetSanitize, MicroTaskSanitize } from '../sanitize';
import { TaskSubmissionsDto } from '../dto/DataSet.dto';
import { CacheService } from 'src/cache/CacheService.service';

export interface GroupedContributorDataSets {
  contributor_id: string;
  contributor: User;
  data_sets: DataSet[];
}
export interface ContributorMicroTaskRto extends MicroTaskSanitize {
  dataSets: DataSetSanitize[];
  current_retry: number;
  allowed_retry: number;
  can_retry: boolean;
}
@Injectable()
export class DataSetService {
  constructor(
    @InjectRepository(DataSet)
    private readonly dataSetRepository: Repository<DataSet>,
    private readonly microTaskService: MicroTaskService,
    private readonly taskService: TaskService,
    private readonly userTaskService: UserTaskService,
    private readonly paginateService: PaginationService<DataSet>,
    private readonly rejectionReasonService: RejectionReasonService,
    // private readonly flagReasonService: FlagReasonService,
    private readonly fileService: FileService,
    private readonly dataSetAnnotationService: DataSetAnnotationService,

    private readonly cacheService: CacheService,
    // private readonly publishService:PublisherService,
    private reviewerTaskService: ReviewerTaskService,
  ) {
    this.paginateService = new PaginationService<DataSet>(
      this.dataSetRepository,
    );
  }
  /**
   * Creates a new data set in the database.
   * If a query runner is provided, it will be used to create the data set.
   * Otherwise, a new query runner will be created.
   * @param dataSet The partial data set to create.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the created data set.
   */
  async create(
    dataSet: Partial<DataSet>,
    queryRunner?: QueryRunner,
  ): Promise<DataSet> {
    // get the data set code
    dataSet.code = 'DAT-' + crypto.randomUUID().slice(0, 8);
    if (queryRunner) {
      const manager = queryRunner.manager;
      const data = manager.create(DataSet, dataSet);
      return await manager.save(DataSet, data);
    } else {
      const manager = this.dataSetRepository;
      const data = manager.create(dataSet);
      return await manager.save(data);
    }
  }

  /**
   * Creates multiple text data sets in the database.
   * If a query runner is provided, it will be used to create the data sets.
   * Otherwise, a new query runner will be created.
   * @param dataSets The partial data sets to create.
   * @param contributor_id The id of the contributor who is submitting the data sets.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to void.
   */
  async createMultipleTextDataSet(
    dataSets: {
      micro_task_id: string;
      text_data_set: string;
      dialect_id: string;
      language_id: string;
      is_test: boolean;
    }[],
    contributor_id: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (dataSets.length === 0) {
      return;
    }
    const entities = dataSets.map((item, index) => ({
      micro_task_id: item.micro_task_id,
      text_data_set: item.text_data_set,
      dialect_id: item.dialect_id,
      language_id: item.language_id,
      is_test: item.is_test,
      contributor_id: contributor_id,
      type: DataSetType.TEXT,
      code: 'DAT-' + crypto.randomUUID().slice(0, 8),
    }));
    await queryRunner.manager.save(DataSet, entities);
  }
  /**
   * Creates multiple audio data sets in the database.
   * If a query runner is provided, it will be used to create the data sets.
   * Otherwise, a new query runner will be created.
   * @param dataSets The partial data sets to create.
   * @param contributor_id The id of the contributor who is submitting the data sets.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the created data sets.
   */
  async createMultipleAudioDataSet(
    dataSets: {
      micro_task_id: string;
      file_path: string;
      dialect_id: string;
      language_id: string;
      is_test: boolean;
      audio_duration: number;
    }[],
    contributor_id: string,
    queryRunner: QueryRunner,
  ): Promise<DataSet[]> {
    const dataSetsMetaData = dataSets.map((item) => {
      const code = 'DAT-' + crypto.randomUUID().slice(0, 8);
      return this.dataSetRepository.create({
        ...item,
        code,
        contributor_id,
        type: DataSetType.AUDIO,
        queue_status: 'pending',
      });
    });
    return await queryRunner.manager.save(DataSet, dataSetsMetaData);
  }
  /**
   * Creates a new audio data set in the database.
   * If a query runner is provided, it will be used to create the data set.
   * Otherwise, a new query runner will be created.
   * @param dataSet The partial data set to create.
   * @param contributor_id The id of the contributor who is submitting the data set.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the created data set.
   */
  async createAudioDataSet(
    dataSet: {
      micro_task_id: string;
      file_path: string;
      audio_duration?: number;
      dialect_id: string;
      language_id: string;
      is_test: boolean;
    },
    contributor_id: string,
    queryRunner: QueryRunner,
  ): Promise<DataSet> {
    const code = 'DAT-' + crypto.randomUUID().slice(0, 8);
    const manager = queryRunner.manager;
    const data = manager.create(DataSet, {
      micro_task_id: dataSet.micro_task_id,
      file_path: dataSet.file_path,
      audio_duration: dataSet.audio_duration,
      contributor_id: contributor_id,
      dialect_id: dataSet.dialect_id,
      type: DataSetType.AUDIO,
      is_test: dataSet.is_test ? true : false,
      code: code,
    });
    return await manager.save(DataSet, data);
  }
  /**
   * Validate the submission of a contributor, ensuring that the contributor has not already
   * contributed to the micro task and that the contributor has not exceeded the maximum retry
   * amount for the micro task.
   * @param contributorSubmittedDataSets The data sets submitted by the contributor.
   * @param contributorId The id of the contributor.
   * @param maxRetryPerTask The maximum amount of retries allowed for the contributor to submit
   * data sets for the micro task.
   * @throws BadRequestException If the contributor has already contributed to the micro task or has
   * exceeded the maximum retry amount.
   */
  async validateSubmission(
    contributorSubmittedDataSets: DataSet[],
    contributorId: string,
    maxRetryPerTask: number,
  ): Promise<void> {
    const un_rejected_prev_data_sets: DataSet[] =
      contributorSubmittedDataSets.filter(
        (d) =>
          d.status != DataSetStatus.REJECTED &&
          d.status != DataSetStatus.Flagged,
      );
    const rejected_data_sets: DataSet[] = contributorSubmittedDataSets.filter(
      (d) =>
        d.status === DataSetStatus.REJECTED ||
        d.status === DataSetStatus.Flagged,
    );
    if (un_rejected_prev_data_sets.length > 0) {
      throw new BadRequestException(
        `You already have contributed to this micro task`,
      );
    }
    if (rejected_data_sets.length >= maxRetryPerTask + 1) {
      throw new BadRequestException(`Maximum retry amount reached !`);
    }
  }
  /**
   * Finds all data sets that match the given options.
   * @param queryOption - The options to filter data sets.
   * @param queryRunner - The query runner to use.
   * @returns - A promise that resolves to an array of data sets.
   */
  async findAll(
    queryOption: QueryOptions<DataSet>,
    queryRunner?: QueryRunner,
  ): Promise<DataSet[]> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    const manager = queryRunner ? queryRunner.manager : this.dataSetRepository;
    return await manager.find(options);
  }

  /**
 * Finds data sets with pagination.
 * @param queryOption - The options to filter data sets.
 * @param paginationDto - The pagination options.
 * @returns - A promise that resolves to a paginated result of data sets.
 * @remarks - If the data set type is 'audio', the file path will be replaced with a pre signed url.

 */
  async findPaginate(
    queryOption: QueryOptions<DataSet>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<DataSet>> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    const datasets: PaginatedResult<DataSet> =
      await this.paginateService.paginateWithOptionQuery(
        paginationDto,
        'data_set',
        queryOption,
      );
    for (const d of datasets.result) {
      if (d.type == 'audio') {
        d.file_path = await this.fileService.getPreSignedUrl(d.file_path);
      }
    }
    datasets.result = await this.fileService.getPreSignedDatasets(
      datasets.result,
    );
    return datasets;
  }

  /**
   * Finds one data set by the given options.
   * If a query runner is provided, it will be used to find the data set.
   * Otherwise, a new query runner will be created.
   * If the data set type is 'audio', the file path will be replaced with a pre signed url.
   * @param queryOption - The options to filter data sets.
   * @param queryRunner - The query runner to use.
   * @returns - A promise that resolves to the found data set or null if not found.
   */
  async findOne(
    queryOption: QueryOptions<DataSet>,
    queryRunner?: QueryRunner,
  ): Promise<DataSet | null> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }

    if (queryRunner) {
      const manager = queryRunner.manager;
      return await manager.findOne(DataSet, options);
    }
    const manager = this.dataSetRepository;
    const dataSet: DataSet | null = await manager.findOne(options);
    if (dataSet && dataSet.type == 'audio') {
      dataSet.file_path = await this.fileService.getPreSignedUrl(
        dataSet.file_path,
      );
    }
    return dataSet;
  }

  /**
   * Updates a data set in the database.
   * If a query runner is provided, it will be used to update the data set.
   * Otherwise, a new query runner will be created.
   * @param id The id of the data set to update.
   * @param dataSet The partial data set to update.
   * @param queryRunner The query runner to use.
   * @returns A promise resolving to the updated data set if found, or null.
   */
  async update(
    id: string,
    dataSet: Partial<DataSet>,
    queryRunner?: QueryRunner,
  ): Promise<DataSet | null> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      await manager.update(DataSet, id, dataSet);
      return await manager.findOne(DataSet, { where: { id } });
    } else {
      const manager = this.dataSetRepository;
      await manager.update(id, dataSet);
      return await manager.findOne({ where: { id } });
    }
  }
  /**
   * Updates the queue status of a data set in the database.
   * If the data set is found, it will also update the cache.
   * @param id The id of the data set to update.
   * @param status The new queue status of the data set, either 'pending', 'completed', or 'failed'.
   * @param filePath The new file path of the data set.
   * @returns A promise resolving to void when the update is successful.
   */
  async updateQueueStatus(
    id: string,
    status: 'pending' | 'completed' | 'failed',
    filePath: string,
  ): Promise<void> {
    const manager = this.dataSetRepository;
    await manager.update(id, { queue_status: status, file_path: filePath });
    const d = await manager.findOne({
      where: { id },
      select: {
        id: true,
        contributor_id: true,
        micro_task_id: true,
        microTask: { id: true, task_id: true },
      },
      relations: { microTask: true },
    });
    if (d) {
      await this.cacheService.updateDataSetFilPathAndQueueStatus(
        d.contributor_id,
        d.microTask.task_id,
        d.id,
        d.micro_task_id,
        filePath,
      );
    }
  }

  /**
   * Removes a data set from the database.
   * @param id The id of the data set to remove.
   * @returns A promise resolving to void when the removal is successful.
   */
  async remove(id: string, contributorId?: string): Promise<void> {
    const result = await this.dataSetRepository.delete(
      contributorId ? { id, contributor_id: contributorId } : { id },
    );
    if (!result.affected) {
      throw new NotFoundException('Dataset not found');
    }
    return;
  }
  // async generateCode(): Promise<string> {
  //   const randomNumber = Math.floor(Math.random() * 1000000) + 1;
  //   // Format as DAT-XXXXX (pad with zeros)
  //   const code = `DAT-${String(randomNumber).padStart(8, '0')}`;
  //   let dataset = await this.dataSetRepository.findOne({
  //     where: { code: code },
  //   });
  //   if (dataset) {
  //     return this.generateCode();
  //   }
  //   return code;
  // }
  async generateCodes(amount: number): Promise<string[]> {
    const codes: string[] = [];
    for (let i = 0; i < amount; i++) {
      const code = 'DAT-' + crypto.randomUUID().slice(0, 8);
      codes.push(code);
    }
    return codes;
  }

  /**
   * Rejects a data set and updates the reviewer's wallet and the contributor's user task status.
   * @param id The id of the data set to reject.
   * @param rejectionReason The reason for rejecting the data set.
   * @param reviewer_id The id of the reviewer who is rejecting the data set.
   * @param queryRunner The query runner to use when updating the database.
   * @param is_flagged Whether the data set is flagged or not.
   * @returns A promise resolving to the rejected data set if successful.
   * @throws BadRequestException If the data set is already rejected.
   * @throws NotFoundException If the data set is not found.
   * @throws BadRequestException If the reviewer is not a member of the task.
   */
  async rejectDataSet(
    id: string,
    rejectionReason: Partial<RejectionReason>[],
    reviewer_id: string,
    queryRunner: QueryRunner,
    is_flagged?: boolean,
  ): Promise<DataSet | null> {
    const manager = queryRunner.manager;
    const dataSet = await this.findOne({
      where: { id: id },
      relations: {
        microTask: { task: { payment: true } },
        contributor: { userDeviceTokens: true },
      },
    });
    if (!dataSet) {
      throw new NotFoundException('Dataset not found');
    }
    const taskPayment = dataSet.microTask.task.payment;
    if (dataSet.status !== DataSetStatus.PENDING) {
      throw new BadRequestException('data set already rejected');
    }
    await this.reviewerTaskService.assertAssignedDataSet(
      reviewer_id,
      dataSet.microTask.task.id,
      id,
      queryRunner,
    );

    await manager.update(DataSet, dataSet.id, {
      status: DataSetStatus.REJECTED,
      is_flagged: is_flagged ? true : false,
      reviewer_id: reviewer_id,
    });
    await this.rejectionReasonService.createBulk(rejectionReason, queryRunner);
    // await this.reviewerTaskService.checkAndRemoveDataSetFromReviewer(
    //   reviewer_id,
    //   dataSet.microTask.task.id,
    //   id,
    //   queryRunner
    // )

    // if (!membership || membership.status!='Active') {
    //   throw new BadRequestException('You are not a member of this task');
    // }
    // const contributorLastUsedDevice=dataSet.contributor.userDeviceTokens.length>0 && dataSet.contributor.userDeviceTokens[dataSet.contributor.userDeviceTokens.length-1];

    await this.cacheService.updateDataSetStatus(
      dataSet.contributor_id,
      dataSet.microTask.task_id,
      dataSet.micro_task_id,
      'Rejected',
    );
    const updatedDataSet: DataSet | null = await manager.findOne(DataSet, {
      where: { id },
    });

    // await this.notificationService.create({
    //   user_id: dataSet.contributor_id,
    //   title: 'Task Rejected',
    //   message:'Your task with code '+dataSet.code +' on task '+dataSet.microTask.task.name+'has been rejected. Please try again.',
    //   type:  'task-rejected'
    // },)

    // await this.userScoreService.updateScore(
    //   dataSet.contributor_id,
    //   UserScoreAction.REJECT,
    //   queryRunner,
    // );
    return updatedDataSet;
  }

  /**
   * Approves a data set.
   *
   * @param id - id of the data set.
   * @param reviewer_id - id of the reviewer.
   * @param queryRunner - query runner object.
   * @param annotation - annotation of the data set.
   * @returns nothing if the data set is approved successfully.
   * @throws NotFoundException - if the data set is not found.
   * @throws BadRequestException - if the data set is already approved or rejected, or if the annotation is not found.
   */
  async approveDataSet(
    id: string,
    reviewer_id: string,
    queryRunner: QueryRunner,
    annotation?: string,
  ): Promise<void> {
    const manager = queryRunner.manager;
    let update: Partial<DataSet> = {
      status: DataSetStatus.APPROVED,
      reviewer_id: reviewer_id,
    };
    if (annotation) {
      const dataSetAnnotation: DataSetAnnotation | null =
        await this.dataSetAnnotationService.findOne({ name: annotation });
      if (!dataSetAnnotation) {
        throw new BadRequestException(
          `Annotation with name  ${annotation} doesn't exist`,
        );
      }
      update = { ...update, annotation };
    }
    const dataSet: DataSet | null = await this.findOne(
      {
        where: { id: id },
        relations: {
          microTask: { task: { payment: true } },
          contributor: { userDeviceTokens: true },
        },
      },
      queryRunner,
    );
    if (!dataSet) {
      throw new NotFoundException('Data set not found');
    }
    if (dataSet.status == DataSetStatus.APPROVED) {
      throw new BadRequestException('Data set already approved');
    }
    if (dataSet.status !== DataSetStatus.PENDING) {
      throw new BadRequestException('Data set is not pending review');
    }
    await this.reviewerTaskService.assertAssignedDataSet(
      reviewer_id,
      dataSet.microTask.task.id,
      id,
      queryRunner,
    );
    // await this.reviewerTaskService.checkAndRemoveDataSetFromReviewer(
    //   reviewer_id,
    //   dataSet.microTask.task.id,
    //   id,
    //   queryRunner
    // )
    // const taskPayment = dataSet?.microTask.task.payment;
    // const memberContributor: UserTask | null = await this.userTaskService.findOne({
    //   where: {
    //     user_id: dataSet.contributor_id,
    //     task_id: dataSet.microTask.task.id,
    //   },
    // });

    // let create = {
    //   task_id: dataSet.microTask.task.id,
    //   user_id: dataSet.contributor_id,
    // };
    // if (!memberContributor && !dataSet.microTask.task.require_contributor_test) {
    //   await this.taskService.activateContributorToTask(create, queryRunner);
    //   await this.cacheService.clearContributorTaskCache(dataSet.contributor_id);
    // } else if (
    //   dataSet.microTask.task.require_contributor_test &&
    //   dataSet.microTask.is_test
    // ) {
    //   // check if all the test micro tasks are approved
    //   const contributorTestMicroTasks: MicroTask[] =
    //     await this.microTaskService.findAllTestMicroTasks({
    //       where: {
    //         task_id: dataSet.microTask.task.id,
    //         is_test: true,
    //         dataSets: {
    //           contributor_id: dataSet.contributor_id
    //         }
    //         },
    //       relations:{
    //         dataSets:true
    //       }
    //     });
    //   if (contributorTestMicroTasks.length == 1) {
    //     await this.taskService.activateContributorToTask(create, queryRunner);
    //   } else {
    //     let has_pending = false;
    //     let has_rejected = false;
    //     for (const task of contributorTestMicroTasks) {
    //       const statusOfMicroTask=checkIfMicroTasIskRejectedAndTotalAttempts(task, 3);
    //       console.log("STEP 11     ============= ");
    //       if (task.id==dataSet.micro_task_id) {
    //         continue;
    //       }
    //       if (statusOfMicroTask.acceptanceStatus==='PENDING' || statusOfMicroTask.acceptanceStatus==='NOT_STARTED') {
    //         has_pending=true;
    //         break;
    //       }
    //       if (statusOfMicroTask.acceptanceStatus==='REJECTED') {
    //         has_rejected=true;
    //         break;
    //       }
    //       // break;
    //     }
    //     if (!has_rejected && !has_pending) {
    //       await this.taskService.activateContributorToTask(create, queryRunner);
    //       await this.cacheService.clearContributorTaskCache(dataSet.contributor_id,dataSet.microTask.task_id);
    //     }
    //   }
    // }
    await this.cacheService.updateDataSetStatus(
      dataSet.contributor_id,
      dataSet.microTask.task_id,
      dataSet.micro_task_id,
      'Approved',
    );
    await manager.update(DataSet, id, update);

    // fund  Contributor wallet
    // const score= await this.scoreService.get();
    // const scoreValueInBIRR=score.value_in_birr;
    // await this.walletService.addFunds(
    //   dataSet.contributor_id,
    //   taskPayment.contributor_credit_per_microtask * scoreValueInBIRR,
    //   { data_set_id: id, code: dataSet.code },
    //   queryRunner,
    // );
    // // fund Reviewer wallet
    // await this.walletService.addFunds(
    //   reviewer_id,
    //   taskPayment.reviewer_credit_per_microtask * scoreValueInBIRR,
    //   { data_set_id: id, code: dataSet.code },
    //   queryRunner,
    // );
    // await this.notificationService.create({
    //   user_id: dataSet.contributor_id,
    //   title: 'Task Approved',
    //   message:'Your task with code '+dataSet.code+' on task '+dataSet.microTask.task.name+' has been approved.',
    //   type:  'task-approved'
    // })
    // await this.userScoreService.updateScore(
    //   dataSet.contributor_id,
    //   UserScoreAction.ACCEPT,
    //   queryRunner,
    // );

    return;
  }
  /**
   * Checks if a microtask is open for a contributor to submit a dataset.
   * It checks if the number of submitted datasets for the microtask is less than the max allowed.
   * If no task requirement is provided, it will assume that the microtask is open.
   * @param micro_task_id The id of the microtask to check.
   * @param taskRequirement The task requirement to check against.
   * @returns A promise that resolves to a boolean indicating if the microtask is open.
   */
  async checkMicroTaskOpenForDataSet(
    micro_task_id: string,
    taskRequirement?: TaskRequirement,
  ): Promise<boolean> {
    if (!taskRequirement) {
      return true; // If no task requirement is provided, assume it's open
    }
    const data_sets: DataSet[] = await this.findAll({
      where: {
        micro_task_id: micro_task_id,
        status: Not(DataSetStatus.REJECTED),
      },
    });
    if (data_sets.length >= taskRequirement.max_contributor_per_micro_task) {
      return false;
    }
    return true;
  }
  async findReviewerDataSets(
    user_id: string,
    task_id: string,
    paginationDto: PaginationDto,
    status?: string,
  ): Promise<PaginatedResult<DataSet>> {
    const userTask: UserTask | null = await this.userTaskService.findOne({
      where: { user_id: user_id, task_id: task_id },
      relations: { user: true, task: { taskType: true } },
    });
    if (!userTask) {
      throw new UnauthorizedException(`User is not assigned to the task`);
    }
    const reviewerId = user_id;
    const task = userTask.task;
    // const
    // get datasets from redis if exists
    const dataSets: string[] = await this.reviewerTaskService.getReviewerTasks(
      reviewerId,
      task_id,
    );
    const queryBuilder = this.dataSetRepository.createQueryBuilder('dataSet');
    if (status === DataSetStatus.PENDING) {
      if (dataSets.length > 0) {
        queryBuilder
          .andWhere('dataSet.id IN (:...ids)', { ids: dataSets })
          .andWhere('dataSet.status = :status', {
            status: DataSetStatus.PENDING,
          })
          .leftJoinAndSelect('dataSet.microTask', 'microTask');
      } else {
        return {
          result: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
        };
      }
    } else if (
      status === DataSetStatus.APPROVED ||
      status === DataSetStatus.REJECTED
    ) {
      queryBuilder
        .leftJoinAndSelect('dataSet.microTask', 'microTask')
        .where('microTask.task_id = :taskId', { taskId: task.id })
        .andWhere('dataSet.status = :status', { status })
        .andWhere('dataSet.reviewer_id = :reviewerId', { reviewerId });
    } else if (status === DataSetStatus.Flagged) {
      queryBuilder
        .leftJoinAndSelect('dataSet.microTask', 'microTask')
        .where('microTask.task_id = :taskId', { taskId: task.id })
        .andWhere('dataSet.is_flagged = :is_flagged', { is_flagged: true })
        .andWhere('dataSet.reviewer_id = :reviewerId', { reviewerId });
    } else {
      const datasets = await this.reviewerTaskService.getReviewerTasks(
        reviewerId,
        task_id,
      );
      queryBuilder
        .leftJoinAndSelect('dataSet.microTask', 'microTask')
        .where('microTask.task_id = :taskId', { taskId: task.id })
        .andWhere('dataSet.status IN (:...statuses)', {
          statuses: [
            DataSetStatus.APPROVED,
            DataSetStatus.REJECTED,
            DataSetStatus.Flagged,
          ],
        })
        .andWhere('dataSet.reviewer_id = :reviewerId', { reviewerId });
      if (datasets.length > 0) {
        queryBuilder.orWhere('dataSet.id IN (:...ids)', { ids: datasets });
      }
      // .orWhere('dataSet.id IN (:...ids)', { ids: datasets });
    }

    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;

    queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('dataSet.created_date', 'DESC');
    // if (task.taskRequirement.is_dialect_specific) {
    //   queryBuilder.andWhere('dataSet.dialect_id = :dialectId', { dialectId });
    // }

    const [result, count] = await queryBuilder.getManyAndCount();
    if (
      [taskTypes.TEXT_TO_AUDIO].indexOf(task?.taskType?.task_type || '') !== -1
    ) {
      for (const dataset of result) {
        await this.fileService.setPreSignedDatasets(dataset);
      }
    }
    if (
      [taskTypes.AUDIO_TO_TEXT].indexOf(task?.taskType?.task_type || '') !== -1
    ) {
      for (const dataset of result) {
        dataset.microTask.file_path = await this.fileService.getPreSignedUrl(
          dataset.microTask.file_path,
        );
      }
    }
    return {
      result,
      page: paginationDto.page || 1,
      limit: paginationDto.limit || 10,
      total: count,
      totalPages: Math.ceil(count / (paginationDto.limit || 10)),
    };
  }
  /**
   * Get the count of datasets per day/month/year
   * @param {string} view_type - 'WEEKLY', 'MONTHLY', or 'YEARLY'
   * @returns {Promise<any[]>} - An array of objects containing the date and count of datasets
   */
  async count(
    view_type: 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'WEEKLY',
  ): Promise<any[]> {
    if (view_type == 'WEEKLY') {
      const sevenDaysAgo: Date = startOfDay(subDays(new Date(), 6)); // Includes today
      const seven_days_ago = sevenDaysAgo.toISOString();
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('day', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('dataset.created_date >= :seven_days_ago', { seven_days_ago })
        .groupBy("DATE_TRUNC('day', dataset.created_date)")
        .orderBy("DATE_TRUNC('day', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getDay(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else if (view_type == 'MONTHLY') {
      const start_date_year = startOfYear(new Date());
      const first_month = start_date_year.toISOString();
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('month', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('dataset.created_date >= :first_month', { first_month })
        .groupBy("DATE_TRUNC('month', dataset.created_date)")
        .orderBy("DATE_TRUNC('month', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getMonth(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else if (view_type == 'YEARLY') {
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('year', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .groupBy("DATE_TRUNC('year', dataset.created_date)")
        // .addGroupBy('dataset.status')
        .orderBy("DATE_TRUNC('year', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getFullYear(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else {
      return [];
    }
  }
  /**
   * Counts the total number of datasets matching the given query.
   * @param query - The query options to filter the count.
   * @returns A promise resolving to the count of datasets.
   */
  async countAll(query: FindOptionsWhere<DataSet>): Promise<number> {
    return await this.dataSetRepository.count({ where: query });
  }
  /**
   * Get the count of datasets per day/month/year for a given task.
   * @param {string} view_type - 'WEEKLY', 'MONTHLY', or 'YEARLY'
   * @param {string} task_id - The ID of the task
   * @returns {Promise<any[]>} - An array of objects containing the date and count of datasets
   * @example
   * const task_id = '12345678-1234-5678-9012-3456789012';
   * const result = await dataSetService.countByTasks('MONTHLY', task_id);
   * console.log(result.map(r => ({date: r.date, count: r.count})));
   */
  async countByTasks(
    view_type: 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'WEEKLY',
    task_id: string,
  ): Promise<any[]> {
    const micro_tasks = await this.microTaskService.findAll({
      where: { task_id: task_id },
    });
    const micro_task_ids = micro_tasks.map((m) => m.id);
    if (view_type == 'WEEKLY') {
      const sevenDaysAgo: Date = startOfDay(subDays(new Date(), 6)); // Includes today
      const seven_days_ago = sevenDaysAgo.toISOString();
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('day', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('dataset.created_date >= :seven_days_ago', { seven_days_ago })
        .andWhere('dataset.micro_task_id IN (:...micro_task_ids)', {
          micro_task_ids,
        })
        .groupBy("DATE_TRUNC('day', dataset.created_date)")
        .orderBy("DATE_TRUNC('day', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getDay(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else if (view_type == 'MONTHLY') {
      const start_date_year = startOfYear(new Date());
      const first_month = start_date_year.toISOString();
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('month', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('dataset.created_date >= :first_month', { first_month })
        .andWhere('dataset.micro_task_id IN (:...micro_task_ids)', {
          micro_task_ids,
        })
        .groupBy("DATE_TRUNC('month', dataset.created_date)")
        .orderBy("DATE_TRUNC('month', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getMonth(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else if (view_type == 'YEARLY') {
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('year', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .andWhere('dataset.micro_task_id IN (:...micro_task_ids)', {
          micro_task_ids,
        })
        .groupBy("DATE_TRUNC('year', dataset.created_date)")
        .orderBy("DATE_TRUNC('year', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getFullYear(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else {
      return [];
    }
  }
  /**
   * Returns data set statistics grouped by the specified view type.
   * @param {string} view_type - The view type, either 'WEEKLY', 'MONTHLY' or 'YEARLY'.
   * @param {string[]} micro_task_ids - The IDs of the micro tasks to filter the data set statistics by.
   * @returns {Promise<any[]>} - A promise that resolves to an array of objects containing the date and count of the data set statistics.
   */
  async countByMicroTasks(
    view_type: 'WEEKLY' | 'MONTHLY' | 'YEARLY',
    micro_task_ids: string[],
  ): Promise<any[]> {
    if (view_type == 'WEEKLY') {
      const sevenDaysAgo: Date = startOfDay(subDays(new Date(), 6)); // Includes today
      const seven_days_ago = sevenDaysAgo.toISOString();
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('day', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('dataset.created_date >= :seven_days_ago', { seven_days_ago })
        .andWhere('dataset.micro_task_id IN (:...micro_task_ids)', {
          micro_task_ids,
        })
        .groupBy("DATE_TRUNC('day', dataset.created_date)")
        .orderBy("DATE_TRUNC('day', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getDay(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else if (view_type == 'MONTHLY') {
      const start_date_year = startOfYear(new Date());
      const first_month = start_date_year.toISOString();
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('month', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .where('dataset.created_date >= :first_month', { first_month })
        .andWhere('dataset.micro_task_id IN (:...micro_task_ids)', {
          micro_task_ids,
        })
        .groupBy("DATE_TRUNC('month', dataset.created_date)")
        .orderBy("DATE_TRUNC('month', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getMonth(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else if (view_type == 'YEARLY') {
      const result = await this.dataSetRepository
        .createQueryBuilder('dataset')
        .select("DATE_TRUNC('year', dataset.created_date)", 'date')
        .addSelect('COUNT(*)', 'count')
        .andWhere('dataset.micro_task_id IN (:...micro_task_ids)', {
          micro_task_ids,
        })
        .groupBy("DATE_TRUNC('year', dataset.created_date)")
        .orderBy("DATE_TRUNC('year', dataset.created_date)", 'ASC')
        .getRawMany();
      return result.map((r) => ({
        date: new Date(r.date).getFullYear(), // formatInTimeZone(new Date(r.date), 'Africa/Addis_Ababa', 'yyyy-MM-dd'),
        count: r.count,
      }));
    } else {
      return [];
    }
  }
  /**
   * Retrieve the data sets for a given task.
   *
   * @param {string} task_id - The ID of the task.
   * @param {TaskSubmissionsDto} taskSubmissionDto - The pagination and filtering options.
   * @returns {Promise<PaginatedResult<DataSet>>} - A promise that resolves to a paginated result of data sets.
   */
  async getTaskDataSetsSubmissions(
    task_id: string,
    taskSubmissionDto: TaskSubmissionsDto,
  ): Promise<PaginatedResult<DataSet>> {
    const page = taskSubmissionDto.page || 1;
    const limit = taskSubmissionDto.limit || 10;
    const offset = (page - 1) * limit;
    const task: Task | null = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskType: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    // const queryBuilder =  this.dataSetRepository
    //   .createQueryBuilder('data_set')
    //   .leftJoinAndSelect('data_set.microTask', 'microTask')
    //   .leftJoinAndSelect('microTask.task', 'task') // Join the task from microTask
    //   .leftJoinAndSelect('data_set.contributor', 'contributor')
    //   .leftJoinAndSelect('data_set.rejectionReasons', 'rejectionReasons')
    //   .leftJoinAndSelect('rejectionReasons.rejectionType', 'rejectionType')
    //   .leftJoinAndSelect('data_set.flagReason', 'flagReason')
    //   .leftJoinAndSelect('flagReason.flagType', 'flagType')
    //   .where('task.id = :task_id', { task_id })

    //   if(taskSubmissionDto.contributor_id){
    //     queryBuilder.andWhere('data_set.contributor_id = :contributor_id', { contributor_id: taskSubmissionDto.contributor_id });
    //   }

    //   if(taskSubmissionDto.status){
    //     queryBuilder.andWhere('data_set.status = :status', { status: taskSubmissionDto.status });
    //   }
    const query: FindOptionsWhere<DataSet> = {
      microTask: {
        task: {
          id: task_id,
        },
      },
    };
    if (taskSubmissionDto.contributor_id) {
      query.contributor = {
        id: taskSubmissionDto.contributor_id,
      };
    }
    if (taskSubmissionDto.status) {
      query.status = taskSubmissionDto.status;
    }
    const [dataSets, totalCount] = await this.dataSetRepository.findAndCount({
      where: query,
      relations: {
        contributor: true,
        rejectionReasons: {
          rejectionType: true,
        },
        flagReason: {
          flagType: true,
        },
        microTask: true,
        reviewer: true,
      },
      skip: offset,
      take: limit,
    });
    // const [dataSets, totalCount] = await queryBuilder
    //   .orderBy('data_set.created_date', 'DESC')
    //   .offset(offset)
    //   .limit(limit)
    //   .getManyAndCount();
    // const totalCount = await this.dataSetRepository
    //   .createQueryBuilder('data_set')
    //   .leftJoin('data_set.microTask', 'microTask')
    //   .leftJoin('microTask.task', 'task')
    //   .where('task.id = :task_id', { task_id })
    //   .getCount();  // Now safe - no SELECT * from joins that multiply rows
    console.log(dataSets);
    console.log(totalCount);
    let signedDataSets = dataSets;
    if (
      [taskTypes.TEXT_TO_AUDIO].indexOf(task?.taskType?.task_type || '') !== -1
    ) {
      signedDataSets = await this.fileService.getPreSignedDatasets(dataSets);
    } else if (
      [taskTypes.AUDIO_TO_TEXT].indexOf(task?.taskType?.task_type || '') !== -1
    ) {
      for (const dataset of dataSets) {
        await this.fileService.setPreSignedMicroTask(dataset.microTask);
      }
    }
    return paginate(signedDataSets, totalCount, page, limit);
  }
  /**
   * Retrieves data sets for a given task and contributor.
   * @param {string} task_id - id of the task
   * @param {string} contributor_id - id of the contributor
   * @param {PaginationDto} paginationDto - pagination info
   * @returns {Promise<PaginatedResult<DataSet>>} - paginated result containing data sets
   * @throws {NotFoundException} - task is not found
   */
  async getTaskDataSetsSubmissionsPerContributor(
    task_id: string,
    contributor_id: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<DataSet>> {
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const offset = (page - 1) * limit;
    const task: Task | null = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskType: true },
    });
    if (!task) {
      throw new NotFoundException('Task is not found !');
    }

    const [dataSets, totalCount] = await this.dataSetRepository.findAndCount({
      where: {
        microTask: {
          task: { id: task_id },
        },
        contributor: { id: contributor_id },
      },
      relations: {
        contributor: true,
        rejectionReasons: {
          rejectionType: true,
        },
        flagReason: {
          flagType: true,
        },
        microTask: true,
        reviewer: true,
      },
      skip: offset,
      take: limit,
    });
    if ([taskTypes.TEXT_TO_AUDIO].includes(task.taskType.task_type)) {
      for (const dataSet of dataSets) {
        await this.fileService.setPreSignedDatasets(dataSet);
      }
    } else if ([taskTypes.AUDIO_TO_TEXT].includes(task.taskType.task_type)) {
      for (const dataSet of dataSets) {
        await this.fileService.setPreSignedMicroTask(dataSet.microTask);
      }
    }

    return {
      result: dataSets,
      total: totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }
  /**
   * Retrieves a list of data sets grouped by dialect and the count of each dialect.
   * @param {string[]} microTaskIds - optional list of micro task ids to filter by
   * @returns {Promise<any[]>} - list of objects containing dialect id, dialect name, and count
   */
  async getDatasetCountsByDialect(microTaskIds?: string[]) {
    const queryBuilder = this.dataSetRepository.createQueryBuilder('dataset');
    if (microTaskIds) {
      queryBuilder.where('dataset.micro_task_id IN (:...microTaskIds)', {
        microTaskIds,
      });
    }
    return await queryBuilder
      .select('dataset.dialect_id', 'dialect_id')
      .addSelect('dialect.name', 'dialect_name')
      .addSelect('COUNT(dataset.id)', 'count')
      .leftJoin('dataset.dialect', 'dialect')
      .groupBy('dataset.dialect_id')
      .addGroupBy('dialect.name')
      .orderBy('count', 'DESC')
      .getRawMany();
  }
  async getDatasetCountsByLanguage(microTaskIds?: string[]) {
    const queryBuilder = this.dataSetRepository.createQueryBuilder('dataset');
    if (microTaskIds) {
      queryBuilder.where('dataset.micro_task_id IN (:...microTaskIds)', {
        microTaskIds,
      });
    }
    return await queryBuilder
      .select('dataset.language_id', 'language_id')
      .addSelect('language.name', 'language_name')
      .addSelect('COUNT(dataset.id)', 'count')
      .leftJoin('dataset.language', 'language')
      .groupBy('dataset.language_id')
      .addGroupBy('language.name')
      .orderBy('count', 'DESC')
      .getRawMany();
  }
  async countByOptions(
    options: FindOptionsWhere<DataSet> | FindOptionsWhere<DataSet>[],
  ): Promise<number> {
    return await this.dataSetRepository.count({ where: options });
  }
  /**
   * Returns the microtask and its associated dataSets for the given contributor
   *
   * @param microTaskId - the id of the microtask
   * @param contributorId - the id of the contributor
   * @returns an object containing the microtask and its associated dataSets
   * @throws NotFoundException if the microtask is not found
   */
  async contributorSubmission(
    microTaskId: string,
    contributorId: string,
  ): Promise<ContributorMicroTaskRto> {
    const microTask = await this.microTaskService.findOne({
      where: {
        id: microTaskId,
        dataSets: {
          contributor_id: contributorId,
        },
      },
      relations: {
        task: { taskRequirement: true, taskType: true },
        dataSets: {
          rejectionReasons: true,
          flagReason: true,
        },
      },
    });
    if (!microTask) {
      throw new NotFoundException(`MicroTask not found`);
    }
    const hasApprovedOrPendingDatasets = microTask.dataSets.some((dataSet) => {
      return (
        dataSet.status === DataSetStatus.APPROVED ||
        dataSet.status === DataSetStatus.PENDING
      );
    });
    const hasReachedMaxRetry =
      microTask.dataSets.length >=
      microTask.task.taskRequirement.max_retry_per_task;
    if (microTask.task.taskType.task_type == 'text-audio') {
      microTask.dataSets = await this.fileService.getPreSignedDatasets(
        microTask.dataSets,
      );
    }
    return {
      ...MicroTaskSanitize.from(microTask),
      dataSets: microTask.dataSets.map((dataSet) =>
        DataSetSanitize.from(dataSet),
      ),
      current_retry: microTask.dataSets.length,
      allowed_retry: microTask.task.taskRequirement.max_retry_per_task,
      can_retry: hasApprovedOrPendingDatasets ? false : hasReachedMaxRetry,
    };
  }
}
