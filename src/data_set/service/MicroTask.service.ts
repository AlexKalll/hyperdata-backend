import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryRunner, Repository } from 'typeorm';
import { PaginationService } from 'src/common/service/pagination.service';
import { QueryOptions } from 'src/utils/queryOption.util';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { TaskService } from 'src/project/service/Task.service';
import { Task } from 'src/project/entities/Task.entity';
import { MicroTask } from '../entities/MicroTask.entity';
import { DataSet } from '../entities/DataSet.entity';
import { paginate, PaginatedResult } from 'src/utils/paginate.util';
import { UserService } from 'src/auth/service/User.service';
import { User } from 'src/auth/entities/User.entity';
import { UserTask } from 'src/project/entities/UserTask.entity';
import { UserTaskService } from 'src/project/service/UserTask.service';
import { FileService } from 'src/common/service/File.service';
import { taskTypes } from 'src/utils/constants/Task.constant';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';
import { MicroTaskRto } from '../rto/MicroTask.rto';
export interface ContributorMicroTaskRto extends MicroTask {
  acceptance_status: string;
  current_retry: number;
  allowed_retry: number;
  can_retry: boolean;
}
@Injectable()
export class MicroTaskService {
  constructor(
    @InjectRepository(MicroTask)
    private readonly microTaskRepository: Repository<MicroTask>,
    private readonly taskService: TaskService,
    private readonly paginateService: PaginationService<MicroTask>,
    private readonly fileService: FileService,
    private readonly userTaskService: UserTaskService,
    private readonly userService: UserService,
  ) {
    this.paginateService = new PaginationService<MicroTask>(
      this.microTaskRepository,
    );
  }

  /**
   * @returns {Promise<Microtask>}
   * Create micro tasks for user.
   * @param {microtaskData} microtask data
   * @param {queryRunner} query runner
   */
  async createTextMicroTask(
    microTaskData: Partial<MicroTask>,
    queryRunner?: QueryRunner,
  ): Promise<MicroTask> {
    const task: Task | null = await this.taskService.findOne({
      where: { id: microTaskData.task_id },
      relations: { taskType: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    const task_type = task?.taskType?.task_type || '';
    if (
      [taskTypes.TEXT_TO_TEXT, taskTypes.TEXT_TO_AUDIO].indexOf(task_type) ===
      -1
    ) {
      throw new BadRequestException(`Invalid task type`);
    }
    if (microTaskData.is_test === true) {
      if (!task.require_contributor_test) {
        throw new BadRequestException(
          'Contributor test is not required for this task',
        );
      }
    }
    microTaskData.code = await this.generateCode();
    if (queryRunner) {
      const manager = queryRunner.manager;
      const microTask = manager.create(MicroTask, microTaskData);
      return await manager.save(MicroTask, microTask);
    } else {
      const manager = this.microTaskRepository;
      const microTask = manager.create(microTaskData);
      return await manager.save(microTask);
    }
  }
  /**
   * Get contributor participated data sets.
   * @param {contributorId} contributor id
   * @param {taskId} task id
   * @param {paginationDto} pagination parameters
   * @returns {Promise<PaginatedResult<MicroTaskRto>>}
   */
  async getContributorParticipatedDataSets(
    contributorId: string,
    taskId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<MicroTaskRto>> {
    const task: Task | null = await this.taskService.findOne({
      where: { id: taskId },
      relations: { taskType: true, taskRequirement: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const offset = (page - 1) * limit;
    const [microTaskWithDataSets, count] = await this.microTaskRepository
      .createQueryBuilder('micro_task')
      .leftJoinAndSelect('micro_task.dataSets', 'dataSets')
      .leftJoinAndSelect('dataSets.rejectionReasons', 'rejectionReasons')
      .leftJoinAndSelect('dataSets.flagReason', 'flagReason')
      .where('micro_task.task_id = :taskId', { taskId })
      .andWhere('dataSets.contributor_id = :contributorId', { contributorId })
      .skip(offset)
      .take(limit)
      .orderBy('micro_task.created_date', 'DESC')
      .getManyAndCount();

    const micro_task_data_sets: ContributorMicroTaskRto[] = [];
    for (const microTask of microTaskWithDataSets) {
      // check if micro_task_exist
      let current_retry = 0;
      const allowed_retry = task?.taskRequirement?.max_retry_per_task || 0;
      let acceptance_status = '';
      let can_retry = false;
      for (let index = 0; index < microTask.dataSets.length; index++) {
        current_retry++;
        if (microTask.dataSets[index].status !== DataSetStatus.REJECTED) {
          acceptance_status = microTask.dataSets[index].status;
        }
        if (
          current_retry > allowed_retry &&
          microTask.dataSets[index].status === DataSetStatus.REJECTED
        ) {
          acceptance_status = DataSetStatus.REJECTED;
          can_retry = false;
        } else if (
          current_retry <= allowed_retry &&
          microTask.dataSets[index].status === DataSetStatus.REJECTED
        ) {
          acceptance_status = DataSetStatus.REJECTED;
          can_retry = current_retry > allowed_retry ? false : true;
        }
      }
      micro_task_data_sets.push({
        ...microTask,
        current_retry: current_retry,
        allowed_retry: task.taskRequirement.max_retry_per_task,
        acceptance_status: acceptance_status,
        can_retry: can_retry,
      });
    }
    if (
      [taskTypes.AUDIO_TO_TEXT, taskTypes.IMAGE_TO_TEXT].includes(
        task.taskType.task_type,
      )
    ) {
      for (const microTask of micro_task_data_sets) {
        microTask.file_path = await this.fileService.getPreSignedUrl(
          microTask.file_path,
        );
      }
    }
    if (task.taskType.task_type === taskTypes.TEXT_TO_AUDIO) {
      for (const microTask of micro_task_data_sets) {
        for (const dataSet of microTask.dataSets) {
          dataSet.file_path = await this.fileService.getPreSignedUrl(
            dataSet.file_path,
          );
        }
      }
    }

    micro_task_data_sets.sort((a, b) => (b.can_retry === true ? 1 : -1));
    // micro_task_data_sets.sort((a, b) => b.acceptance_status===DataSetStatus.APPROVED?1:-1);
    const data = micro_task_data_sets.map((item) =>
      MicroTaskRto.from(item, {
        current_retry: item.current_retry,
        allowed_retry: item.allowed_retry,
        acceptance_status: item.acceptance_status,
        can_retry: item.can_retry,
      }),
    );
    // micro_task_data_sets.sort((a, b) => b.acceptance_status===DataSetStatus.PENDING?1:-1);
    return paginate(data, count, page, limit);
  }
  /**
   * Create multiple text micro tasks.
   *
   * @param microtaskData - The partial text microtask data.
   * @param task_id - The task id.
   * @param queryRunner - The query runner for the database.
   * @returns - A promise of the created microtasks.
   */
  async createMultipleTextMicroTask(
    microTaskData: Partial<MicroTask>[],
    task_id: string,
    queryRunner?: QueryRunner,
  ): Promise<MicroTask[]> {
    const task: Task | null = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskType: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    const task_type = task?.taskType?.task_type || '';
    if (
      [taskTypes.TEXT_TO_TEXT, taskTypes.TEXT_TO_AUDIO].indexOf(task_type) ===
      -1
    ) {
      throw new BadRequestException(`Invalid task type`);
    }
    const last_microTask = await this.microTaskRepository.findOne({
      where: {},
      order: { code: 'DESC' },
      select: { code: true },
    });
    for (const microTask of microTaskData) {
      microTask.code = await this.generateCode();
      microTask.task_id = task_id;
      microTask.type = 'text';
    }
    if (queryRunner) {
      const manager = queryRunner.manager;
      const microTasks = manager.create(MicroTask, microTaskData);
      return await manager.save(MicroTask, microTasks);
    } else {
      const manager = this.microTaskRepository;
      const microTasks = manager.create(microTaskData);
      return await manager.save(microTasks);
    }
  }
  /**
   * @brief: Create an audio microtask
   * @param: microtaskData: Partial<Microtask>
   * @param: queryRunner: QueryRunner
   * @return: Promise<Microtask>
   * @throws: new NotFoundException if the task is not found
   * @throws: new BadRequestException if the task type is not audio
   **/
  async createAudioMicroTask(
    microTaskData: Partial<MicroTask>,
    queryRunner?: QueryRunner,
  ): Promise<MicroTask> {
    const task: Task | null = await this.taskService.findOne({
      where: { id: microTaskData.task_id },
      relations: { taskType: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    if (microTaskData.is_test === true) {
      if (!task.require_contributor_test) {
        throw new BadRequestException(
          'Contributor test is not required for this task',
        );
      }
    }
    const task_type = task.taskType?.task_type || '';
    if (task_type !== taskTypes.AUDIO_TO_TEXT) {
      throw new BadRequestException(`Invalid task type`);
    }
    microTaskData.code = await this.generateCode();
    microTaskData.type = 'audio';
    if (queryRunner) {
      const manager = queryRunner.manager;
      const microTask = manager.create(MicroTask, microTaskData);
      return await manager.save(MicroTask, microTask);
    } else {
      const manager = this.microTaskRepository;
      const microTask = manager.create(microTaskData);
      return await manager.save(microTask);
    }
  }

  async createImageMicroTask(
    data: Partial<MicroTask>,
    queryRunner: QueryRunner,
  ): Promise<MicroTask> {
    const task = await queryRunner.manager.findOne(Task, {
      where: { id: data.task_id },
      relations: { taskType: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.taskType.task_type !== taskTypes.IMAGE_TO_TEXT) {
      throw new BadRequestException('Images require an image-to-text task');
    }
    if (task.is_archived || task.is_closed)
      throw new BadRequestException('Task is closed or archived');
    if (data.is_test && !task.require_contributor_test) {
      throw new BadRequestException(
        'Contributor test is not required for this task',
      );
    }
    return queryRunner.manager.save(
      MicroTask,
      queryRunner.manager.create(MicroTask, {
        ...data,
        type: 'image',
        code: await this.generateCode(),
      }),
    );
  }

  /**
   * Create multiple audio microtasks.
   *
   * @param taskId - The task id.
   * @param microTaskDatas - The partial microtask data.
   * @param queryRunner - The query runner for the database.
   * @returns - A promise of the created microtasks.
   * @throws new NotFoundException if the task is not found
   * @throws new BadRequestException if the task type is not audio, or if the contributor test is not required for the task
   */
  async createMultipleAudioMicroTask(
    taskId: string,
    microTaskDatas: Partial<MicroTask>[],
    queryRunner: QueryRunner,
  ): Promise<any> {
    const task: Task | null = await this.taskService.findOne({
      where: { id: taskId },
      relations: { taskType: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    await Promise.all(
      microTaskDatas.map(async (microTaskData) => {
        if (microTaskData.is_test === true) {
          if (!task.require_contributor_test) {
            throw new BadRequestException(
              'Contributor test is not required for this task',
            );
          }
        }
        microTaskData.code = await this.generateCode();
        microTaskData.type = 'audio';
        const manager = queryRunner.manager;
        const microTask = manager.create(MicroTask, microTaskData);
        return await manager.save(MicroTask, microTask);
      }),
    );
    return;
  }

  /**
   * Finds all microtasks that match the given query option.
   * @param queryOption - The query options.
   * @param queryRunner - The query runner.
   * @returns - A promise of the found microtasks.
   */
  async findAll(
    queryOption: QueryOptions<MicroTask>,
    queryRunner?: QueryRunner,
  ): Promise<MicroTask[]> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    const manager = queryRunner
      ? queryRunner.manager
      : this.microTaskRepository;
    return await manager.find(options);
  }
  /**
   * Finds all microtasks that match the given query option and are rejected.
   * @param taskId - the id of the task.
   * @param userId - the id of the contributor.
   * @param badStatuses - the bad statuses to filter by.
   * @param queryRunner - The query runner.
   * @returns - A promise of the found microtasks.
   */
  async findRejectedMicroTaskOfContributor(
    taskId: string,
    userId: string,
  ): Promise<MicroTask[]> {
    const rejectedMicroTasks = await this.microTaskRepository
      .createQueryBuilder('microTask')
      .innerJoin('microTask.dataSets', 'dataset')
      .where('microTask.task_id = :taskId', { taskId })
      .andWhere('dataset.contributor_id = :userId', { userId })
      .andWhere('dataset.status = :rejected', {
        rejected: DataSetStatus.REJECTED,
      })
      .andWhere(
        `NOT EXISTS (
      SELECT 1 
      FROM data_set ds
      WHERE ds.micro_task_id = "microTask"."id"
      AND ds.contributor_id = :userId
      AND ds.status IN (:...badStatuses)
    )`,
        {
          userId,
          badStatuses: [DataSetStatus.PENDING, DataSetStatus.APPROVED],
        },
      )
      .getMany();

    return rejectedMicroTasks;
  }
  /**
   * Finds all microtasks that match the given query option and are test microtasks.
   * @param queryOption - The query options.
   * @returns - A promise of the found microtasks.
   */
  async findAllTestMicroTasks(
    queryOption: QueryOptions<MicroTask>,
  ): Promise<MicroTask[]> {
    const options: any = {
      where: { ...queryOption.where, is_test: true },
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    const manager = this.microTaskRepository;
    return await manager.find(options);
  }
  /**
   * Finds microtasks with pagination.
   * @param queryOption - The options to filter microtasks.
   * @param paginationDto - The pagination options.
   * @returns - A promise that resolves to a paginated result of microtasks.
   * @remarks - If the task type is 'audio_to_text', the file path will be replaced with a pre signed url.
   */
  async findPaginate(
    queryOption: QueryOptions<MicroTask>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<MicroTask>> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    let microTaskTypeIsFile = false;
    if (queryOption.where && queryOption.where['task_id']) {
      // If task_id is provided, we need to fetch the task and its dialect
      const task: Task | null = await this.taskService.findOne({
        where: { id: queryOption.where['task_id'] },
        relations: { taskType: true },
      });
      if (!task) {
        throw new NotFoundException(`Task not found`);
      }
      // Add dialect to the query option
      if (
        [taskTypes.AUDIO_TO_TEXT, taskTypes.IMAGE_TO_TEXT].includes(
          task.taskType?.task_type || '',
        )
      ) {
        microTaskTypeIsFile = true;
      }
    }
    const data: PaginatedResult<MicroTask> =
      await this.paginateService.paginateWithOptionQuery(
        paginationDto,
        'micro_task',
        queryOption,
      );
    if (microTaskTypeIsFile) {
      data.result = await this.fileService.getPreSignedMicroTasks(data.result);
    }
    return data;
  }

  /**
   * Finds a microtask by given query options.
   * @param queryOption - The query options.
   * @param queryRunner - The query runner.
   * @returns - A promise that resolves to the found microtask or null if not found.
   * @remarks - If the microtask type is 'audio', the file path will be replaced with a pre signed url.
   */
  async findOne(
    queryOption: QueryOptions<MicroTask>,
    queryRunner?: QueryRunner,
  ): Promise<MicroTask | null> {
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
      return await manager.findOne(MicroTask, options);
    }

    const manager = this.microTaskRepository;
    const micro_task = await manager.findOne(options);
    if (micro_task && ['audio', 'image'].includes(micro_task.type)) {
      micro_task.file_path = await this.fileService.getPreSignedUrl(
        micro_task.file_path,
      );
    }
    return micro_task;
  }

  /**
   * Updates a microtask by given id and partial microtask data.
   * @param id - The id of the microtask to update.
   * @param taskData - The partial microtask data to update.
   * @param queryRunner - The query runner.
   * @returns - A promise that resolves to the updated microtask or null if not found.
   */
  async update(
    id: string,
    taskData: Partial<MicroTask>,
    queryRunner?: QueryRunner,
  ): Promise<MicroTask | null> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      await manager.update(MicroTask, id, taskData);
      return await manager.findOne(MicroTask, { where: { id } });
    } else {
      const manager = this.microTaskRepository;
      await manager.update(id, taskData);
      return await manager.findOne({ where: { id } });
    }
  }

  /**
   * Soft deletes a microtask by given id.
   * @param id - The id of the microtask to remove.
   * @throws NotFoundException - If the microtask is not found.
   * @throws BadRequestException - If the microtask has datasets.
   */
  async remove(id: string): Promise<void> {
    const microTask = await this.microTaskRepository.findOne({
      where: { id },
      relations: { dataSets: true },
    });
    if (!microTask) {
      throw new NotFoundException(`MicroTask not found`);
    }
    if (microTask.dataSets.length > 0) {
      throw new BadRequestException(`MicroTask has datasets`);
    }
    await this.microTaskRepository.softDelete(id);
    return;
  }
  /**
   * Generates a random code for a microtask.
   * The code is in the format 'PMT-XXXXX' where 'XXXXX' is a 5-digit random number.
   * If the generated code already exists in the database, it calls itself recursively until it generates a unique code.
   * @returns A promise that resolves to the generated code.
   */
  async generateCode(): Promise<string> {
    // generate 5 random digits
    const randomNumber = Math.floor(Math.random() * 1000000000) + 1;
    // Format as DAT-XXXXX (pad with zeros)
    const code = `PMT-${String(randomNumber).padStart(8, '0')}`;
    const codeExist = await this.microTaskRepository.findOne({
      where: { code: code },
    });
    if (codeExist) {
      return this.generateCode();
    }
    return code;
  }
  /**
   * Fetch microtasks by task ids.
   * @param task_ids - The task ids.
   * @returns - A promise that resolves to the found microtask or null, not found.
   */
  async contributorMicroTasks(
    user_id: string,
    paginateDto: PaginationDto,
  ): Promise<PaginatedResult<MicroTask>> {
    // Fetch User
    const user: User | null = await this.userService.findOne({
      where: { id: user_id },
      relations: { dialect: true },
    });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    const user_dialect = user.dialect;
    // Fetch user approved tasks
    const user_task: UserTask[] = await this.userTaskService.findAll({
      where: { user_id: user_id },
    });
    const task_ids = user_task.map((t) => t.task_id);
    // Fetch tasks by dialect
    const dialect_tasks: Task[] = await this.taskService.findAll({});

    const dialect_task_ids: string[] = dialect_tasks.map((t) => t.id);
    // Fetch microTasks by task ids
    return this.paginateService.paginateWithOptionQuery(
      paginateDto,
      'micro_task',
      {
        where: [
          { task_id: In(task_ids) },
          { task_id: In(dialect_task_ids), is_test: true },
        ],
      },
    );
  }
  /**
   * Import microtasks from other tasks.
   * @param source_task_id - The source task id.
   * @param task_id - The task id.
   * @param created_by - The user who created the microtask.
   * @param queryRunner - The query runner.
   * @param limit - The limit of microtasks to import.
   * @returns - A promise that resolves to the imported microtasks.
   */
  async importMicroTaskFromOtherTask(
    source_task_id: string,
    task_id: string,
    created_by: string,
    queryRunner: QueryRunner,
    limit?: number,
  ): Promise<MicroTask[]> {
    const source_task: Task | null = await this.taskService.findOne({
      where: { id: source_task_id },
      relations: { taskType: true },
    });
    if (!source_task) {
      throw new NotFoundException(`Source Task not found`);
    }
    const task: Task | null = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskType: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    const task_type = task.taskType.task_type;
    const source_task_type = source_task.taskType.task_type;
    const task_type_split = task_type.split('-');
    const source_task_type_split = source_task_type.split('-');
    if (task_type_split[0] !== source_task_type_split[0]) {
      throw new BadRequestException(
        `Task type mismatch between source task and target task`,
      );
    }
    let microTasks: MicroTask[] = await this.microTaskRepository.find({
      where: { task_id: source_task_id },
    });
    if (microTasks.length === 0) {
      throw new NotFoundException(`No micro tasks found in source task`);
    }
    if (limit && limit > 0) {
      microTasks = microTasks.slice(0, limit);
    }
    const manager = queryRunner.manager;
    const microtasks = await Promise.all(
      microTasks.map(async (microTask: MicroTask) => {
        microTask.task_id = task_id;
        microTask.code = await this.generateCode();
        return await manager.save(MicroTask, {
          task_id: task_id,
          code: microTask.code,
          text: microTask.text,
          is_test: task.require_contributor_test ? microTask.is_test : false,
          instruction: microTask.instruction,
          file_path: microTask.file_path,
          type: microTask.type,
          created_by: created_by,
        });
      }),
    );

    return microtasks;
  }

  /**
   * Imports approved datasets from a source task and creates corresponding micro-tasks
   * under a target task within an existing database transaction.
   *
   * This method:
   * - Validates the existence of both source and target tasks
   * - Ensures task type compatibility between source and target tasks
   * - Extracts only APPROVED datasets from the source task's micro-tasks
   * - Optionally limits the number of imported datasets
   * - Creates new micro-tasks based on the dataset type (text or file-based)
   *
   * ⚠️ This method must be executed inside an active TypeORM transaction.
   *
   * @param {string} source_task_id - ID of the source task from which datasets are imported
   * @param {string} task_id - ID of the target task where micro-tasks will be created
   * @param {string} created_by - User ID of the creator of the new micro-tasks
   * @param {QueryRunner} queryRunner - Active TypeORM QueryRunner used for transactional operations
   * @param {number} [limit] - Optional maximum number of datasets to import
   *
   * @returns {Promise<MicroTask[]>} A list of newly created micro-tasks
   *
   * @throws {NotFoundException} If the source task, target task, or approved datasets are not found
   * @throws {BadRequestException} If the source and target task types are incompatible
   */

  async importMicroTaskFromOtherTaskDataset(
    source_task_id: string,
    task_id: string,
    created_by: string,
    queryRunner: QueryRunner,
    limit?: number,
  ): Promise<MicroTask[]> {
    const source_task: Task | null = await this.taskService.findOne({
      where: { id: source_task_id },
      relations: { taskType: true },
    });
    if (!source_task) {
      throw new NotFoundException(`Source Task not found`);
    }
    const task: Task | null = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskType: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    const task_type = task.taskType.task_type;
    const source_task_type = source_task.taskType.task_type;
    // split the sm and d by '-'
    const task_type_split = task_type.split('-');
    const source_task_type_split = source_task_type.split('-');
    // check if task type is valid
    if (task_type_split[0] !== source_task_type_split[1]) {
      throw new BadRequestException(
        `Task type mismatch between source task and target task`,
      );
    }
    const microTasks: MicroTask[] = await this.microTaskRepository.find({
      where: { task_id: source_task_id },
      relations: { dataSets: true },
    });
    let datasets: DataSet[] = microTasks.map((m) => m.dataSets).flat();
    datasets = datasets.filter((d) => d.status === DataSetStatus.APPROVED);
    if (datasets.length === 0) {
      throw new NotFoundException(`No micro tasks found in source task`);
    }
    if (limit && limit > 0) {
      datasets = datasets.slice(0, limit);
    }
    const manager = queryRunner.manager;
    const microTaskCode = await this.generateCode();
    if (task_type_split[0] === 'text') {
      const microtasks = await Promise.all(
        datasets.map(async (dataset) => {
          return await manager.save(MicroTask, {
            task_id: task_id,
            code: microTaskCode,
            text: dataset.text_data_set,
            is_test: false,
            file_path: '',
            type: task_type_split[0],
            created_by: created_by,
          });
        }),
      );
      return microtasks;
    } else {
      const microtasks = await Promise.all(
        datasets.map(async (dataset) => {
          return await manager.save(MicroTask, {
            task_id: task_id,
            code: microTaskCode,
            text: '',
            is_test: false,
            file_path: dataset.file_path,
            type: task_type_split[0],
            minimum_seconds: 5,
            maximum_seconds: dataset.audio_duration,
            created_by: created_by,
          });
        }),
      );
      return microtasks;
    }
  }
  /**
   * Count the number of micro tasks in the database, given an optional query option.
   * @param {QueryOptions<Microtask>} queryOption - The query option to filter the microtasks to count.
   * @returns {Promise<number>} - A promise that resolves to the number of microtasks in the database.
   */
  async count(queryOption: QueryOptions<MicroTask>): Promise<number> {
    const total_projects: number =
      await this.microTaskRepository.count(queryOption);
    return total_projects;
  }
}
