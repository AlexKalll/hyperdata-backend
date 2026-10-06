import {
  BadRequestException,
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  FindOptionsWhere,
  In,
  Not,
  QueryRunner,
  Repository,
} from 'typeorm';
import { PaginationService } from 'src/common/service/pagination.service';
import { QueryOptions } from 'src/utils/queryOption.util';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { Task } from '../entities/Task.entity';
import { ProjectService } from './Project.service';
import { LanguageService } from 'src/base_data/service/Language.service';
import { TaskTypeService } from './TaskType.service';
import { Project } from '../entities/Project.entity';
import { Language } from 'src/base_data/entities/Language.entity';
import { TaskType } from '../entities/TaskType.entity';
import { UserTaskService } from './UserTask.service';
import { UserTask } from '../entities/UserTask.entity';
import { User } from 'src/auth/entities/User.entity';
import { UserService } from 'src/auth/service/User.service';
import { Role } from 'src/auth/entities/Role.entity';
import { RoleService } from 'src/auth/service/Role.service';
import { Role as RoleEnum } from 'src/auth/decorators/roles.enum';
import { EmailService } from 'src/email/email.service';
import { paginate, PaginatedResult } from 'src/utils/paginate.util';
import { DialectService } from 'src/base_data/service/Dialect.service';
import { TaskInstruction } from '../entities/TaskInstruction.entity';
import { TaskInstructionService } from './TaskInstruction.service';
import {
  CreateTaskDto,
  UpdateTaskInstructionDto,
  UpdateTaskPaymentDto,
  UpdateTaskRequirementDto,
} from '../dto/Task.dto';
import { TaskRequirementService } from './TaskRequirement.service';
import { TaskRequirement } from '../entities/TaskRequirement.entity';
import { UserTaskStatus } from 'src/utils/constants/Task.constant';
import { FacilitatorContributorService } from './FacilitatorContributor.service';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';
import { FacilitatorContributor } from '../entities/FacilitatorContributor.entity';
import { TaskPaymentService } from 'src/project/service/TaskPayment.service';
import { getTaskStatus, TaskStatus } from 'src/utils/MicroTask.util';
export interface ContributorTaskRto extends Task {
  done_count?: number;
  total_count?: number;
  dead_line?: Date;
}
export interface ContributorSubmissionsDto {
  id: string;
  name: string;
  task_type: string;
  total_count: number;
  last_submission_date: Date;
}
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly paginateService: PaginationService<Task>,
    private readonly taskTypeService: TaskTypeService,
    private readonly languageService: LanguageService,
    private readonly taskInstructionService: TaskInstructionService,
    private readonly taskRequirementService: TaskRequirementService,
    private readonly dialectService: DialectService,
    private readonly taskPaymentService: TaskPaymentService,

    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,

    private readonly userTaskService: UserTaskService,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly emailService: EmailService,

    @Inject(forwardRef(() => FacilitatorContributorService))
    private readonly facilitatorContributorService: FacilitatorContributorService,
    // private readonly notificationService:NotificationService,
  ) {
    this.paginateService = new PaginationService<Task>(this.taskRepository);
  }

  /**
   * Creates a new task
   * @param taskData The task data
   * @param created_by The created by user id
   * @param queryRunner The query runner
   * @returns The created task
   * @throws {BadRequestException} If the task already exists
   * @throws {NotFoundException} If the project, language or task type is not found
   */
  async create(
    taskData: CreateTaskDto,
    created_by: string,
    queryRunner: QueryRunner,
  ): Promise<Task> {
    const project_id = taskData.project_id;
    const language_id = taskData.language_id;
    const task_type_id = taskData.task_type_id;
    const project: Project | null = await this.projectService.findOne({
      where: { id: project_id },
    });
    const language: Language | null = await this.languageService.findOne({
      id: language_id,
    });
    const taskType: TaskType | null = await this.taskTypeService.findOne({
      where: { id: task_type_id },
    });

    if (!project) {
      throw new NotFoundException(`Project not found`);
    }
    if (!language) {
      throw new NotFoundException(`Language not found`);
    }
    if (!taskType) {
      throw new NotFoundException(`Task Type not found`);
    }
    // Check if the dialects exist
    const dialects =
      taskData.is_dialect_specific && taskData.dialects
        ? await this.dialectService.findMany({
            id: In(taskData.dialects || []),
          })
        : [];
    const taskBefore: Task | null = await this.findOne({
      where: { name: taskData.name, project_id: project_id },
    });
    if (taskBefore) {
      throw new BadRequestException(
        `Task with name ${taskData.name} already exists`,
      );
    }
    const manager = queryRunner.manager;
    const task = manager.create(Task, { ...taskData, created_by: created_by });
    await manager.save(Task, task);
    if (taskData.minimum_seconds && taskData.maximum_seconds) {
      if (taskData.minimum_seconds > taskData.maximum_seconds) {
        throw new BadRequestException(
          `Minimum seconds should be less than maximum seconds`,
        );
      }
    }
    if (
      taskData.minimum_characters_length &&
      taskData.maximum_characters_length
    ) {
      if (
        taskData.minimum_characters_length >= taskData.maximum_characters_length
      ) {
        throw new BadRequestException(
          `Minimum characters length should be less than maximum characters length`,
        );
      }
    }
    const taskRequirement: TaskRequirement =
      await this.taskRequirementService.create(
        {
          task_id: task.id,
          max_contributor_per_micro_task:
            taskData.max_contributor_per_micro_task,
          max_micro_task_per_contributor:
            taskData.max_micro_task_per_contributor,
          max_contributor_per_facilitator:
            taskData.max_contributor_per_facilitator,
          max_retry_per_task: taskData.max_retry_per_task,
          max_dataset_per_reviewer: taskData.max_dataset_per_reviewer,
          maximum_seconds: taskData.maximum_seconds,
          minimum_seconds: taskData.minimum_seconds,
          maximum_characters_length: taskData.maximum_characters_length,
          minimum_characters_length: taskData.minimum_characters_length,
          batch: taskData.batch || taskData.max_micro_task_per_contributor,
          appriximate_time_per_batch: taskData.appriximate_time_per_batch,
          is_dialect_specific: taskData.is_dialect_specific,
          dialects: taskData.is_dialect_specific
            ? dialects.map((d) => ({ id: d.id, name: d.name }))
            : [],
          is_age_specific: taskData.is_age_specific,
          age: taskData.is_age_specific ? taskData.age : undefined,
          is_sector_specific: taskData.is_sector_specific,
          sectors: taskData.is_sector_specific ? taskData.sectors : undefined,
          is_gender_specific: taskData.is_gender_specific,
          gender: taskData.is_gender_specific ? taskData.gender : undefined,
          is_location_specific: taskData.is_location_specific,
          locations: taskData.is_location_specific
            ? taskData.locations
            : undefined,
        },
        queryRunner,
      );
    const payment = await this.taskPaymentService.create(
      {
        task_id: task.id,
        contributor_credit_per_microtask:
          taskData.contributor_payment_per_microtask,
        reviewer_credit_per_microtask: taskData.reviewer_payment_per_microtask,
        created_by,
      },
      queryRunner,
    );
    return { ...task, taskRequirement, payment };
  }

  /**
   * Finds all tasks that match the given query options.
   * @param queryOption - The query options to filter tasks.
   * @param queryRunner - The query runner to use.
   * @returns - A promise that resolves to an array of tasks.
   */
  async findAll(
    queryOption: QueryOptions<Task>,
    queryRunner?: QueryRunner,
  ): Promise<Task[]> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    const manager = queryRunner ? queryRunner.manager : this.taskRepository;
    return await manager.find(options);
  }

  /**
   * Finds tasks with pagination.
   * @param queryOption - The query options to filter tasks.
   * @param paginationDto - The pagination options.
   * @returns A promise that resolves to a paginated result of tasks.
   */
  async findPaginate(
    queryOption: QueryOptions<Task>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Task>> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    return await this.paginateService.paginateWithOptionQuery(
      paginationDto,
      'task',
      queryOption,
    );
  }
  /**
   * Finds task members of a task with pagination.
   * @param task_id The id of the task.
   * @param userTaskOption The query options to filter user tasks.
   * @param queryOption The query options to filter users.
   * @param paginationDto The pagination options.
   * @returns A promise that resolves to a paginated result of task members.
   */
  async findPaginateTaskMembers(
    task_id: string,
    userTaskOption: FindOptionsWhere<UserTask>,
    queryOption: FindOptionsWhere<User> | FindOptionsWhere<User>[],
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<UserTask>> {
    return await this.userTaskService.findTaskMembers(
      task_id,
      userTaskOption,
      queryOption,
      paginationDto,
    );
  }
  /**
   * Finds all task members of a task.
   * @param task_id The id of the task.
   * @param queryOption The query options to filter user tasks.
   * @returns A promise that resolves to an array of task members.
   */
  async findAllTaskMembers(
    task_id: string,
    queryOption: QueryOptions<UserTask>,
  ): Promise<UserTask[]> {
    const options: QueryOptions<UserTask> = {
      where: {
        ...queryOption.where,
        task_id,
        status: 'Active',
        user: { is_active: true },
      },
      // order: queryOption.order || {},
      relations: { user: true },
    };
    return await this.userTaskService.findAll({
      where: options.where,
      relations: { user: true },
    });
  }
  /**
   * Finds contributors of a task with pagination.
   * @param id The id of the task.
   * @param queryOptions The query options to filter users.
   * @param paginationDto The pagination options.
   * @returns A promise that resolves to a paginated result of contributors.
   * @throws {NotFoundException} - If the task is not found.
   */
  async findTaskRelatedContributors(
    id: string,
    queryOptions: QueryOptions<User>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<User>> {
    const task: Task | null = await this.findOne({
      where: { id },
      relations: { taskRequirement: true },
    });
    if (!task) throw new NotFoundException('Task Not Found !');
    const members = await this.userTaskService.findAll({
      where: { task_id: id, role: 'Contributor' },
    });
    const memberUserIds = members.map((member) => member.user_id);
    // Normalize filters into an array (so we can safely modify them)
    if (memberUserIds.length > 0) {
      // Apply "exclude members" to EACH filter
      if (!Array.isArray(queryOptions.where)) {
        queryOptions.where = {
          ...queryOptions.where,
          id: Not(In(memberUserIds)),
        };
      } else if (Array.isArray(queryOptions.where)) {
        queryOptions.where = queryOptions.where.map((item) => ({
          ...item,
          id: Not(In(memberUserIds)),
        }));
      }
    }
    return this.userService.findUserByTaskRequirement(
      task.taskRequirement,
      queryOptions,
      task.language_id,
      paginationDto.page || 1,
      paginationDto.limit || 10,
    );
  }
  async findOne(
    queryOption: QueryOptions<Task>,
    queryRunner?: QueryRunner,
  ): Promise<Task | null> {
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
      return await manager.findOne(Task, options);
    }

    const manager = this.taskRepository;
    return await manager.findOne(options);
  }

  async update(
    id: string,
    taskData: Partial<Task>,
    queryRunner?: QueryRunner,
  ): Promise<Task | null> {
    const task = await this.findOne({
      where: { id },
      relations: { microTasks: true },
    });
    if (!task) throw new NotFoundException('Task Not Found !');
    if (
      (taskData.language_id && taskData.language_id !== task.language_id) ||
      (taskData.task_type_id && taskData.task_type_id !== task.task_type_id) ||
      (taskData.require_contributor_test &&
        taskData.require_contributor_test !== task.require_contributor_test)
    ) {
      if (task.distribution_started) {
        throw new BadRequestException(
          'Cannot update Language , task type or test requirements after distribution started',
        );
      }
    }
    if (
      (taskData.language_id && taskData.language_id !== task.language_id) ||
      (taskData.task_type_id &&
        taskData.task_type_id !== task.task_type_id &&
        task.microTasks.length > 0)
    ) {
      throw new BadRequestException(
        'Cannot update task type after micro tasks are created',
      );
    }
    if (queryRunner) {
      const manager = queryRunner.manager;
      await manager.update(Task, id, taskData);
      return await manager.findOne(Task, { where: { id } });
    } else {
      const manager = this.taskRepository;
      await manager.update(id, taskData);
      return await manager.findOne({ where: { id } });
    }
  }
  async closeToggle(
    id: string,
    queryRunner?: QueryRunner,
  ): Promise<Task | null> {
    const manager = this.taskRepository;
    const task = await manager.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found !');
    }
    task.is_closed = !task?.is_closed;
    await manager.update(id, task);
    return task;
  }
  async updateRequirement(
    task_id: string,
    taskData: UpdateTaskRequirementDto,
    queryRunner?: QueryRunner,
  ): Promise<TaskRequirement | null> {
    const taskRequirement: TaskRequirement | null =
      await this.taskRequirementService.findOne({
        where: { task_id: task_id },
        relations: { task: true },
      });
    if (!taskRequirement) {
      throw new NotFoundException(`Task Requirement not found`);
    }
    if (taskRequirement.task.distribution_started) {
      throw new BadRequestException(`Distribution already started`);
    }
    return await this.taskRequirementService.update(
      taskRequirement.id,
      taskData,
      queryRunner,
    );
  }
  async updateInstruction(
    task_id: string,
    taskData: UpdateTaskInstructionDto,
    queryRunner?: QueryRunner,
  ): Promise<TaskInstruction | null> {
    const taskInstruction: TaskInstruction | null =
      await this.taskInstructionService.findOne({
        where: { task_id: task_id },
        relations: { task: true },
      });
    if (!taskInstruction) {
      throw new NotFoundException(`Task Instruction not found`);
    }
    return await this.taskInstructionService.update(
      taskInstruction.id,
      taskData,
      queryRunner,
    );
  }
  async deleteInstruction(id: string): Promise<void> {
    const taskInstruction: TaskInstruction | null =
      await this.taskInstructionService.findOne({
        where: { id },
      });
    if (!taskInstruction) {
      throw new NotFoundException(`Task Instruction not found`);
    }
    await this.taskInstructionService.remove(taskInstruction.id);
    return;
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne({
      where: { id },
      relations: { taskRequirement: true, taskInstructions: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    if (task.distribution_started) {
      throw new BadRequestException(`Distribution already started`);
    }
    await this.taskRequirementService.remove(task.taskRequirement.id);
    if (task.taskInstructions.length > 0) {
      await Promise.all(
        task.taskInstructions.map((taskInstruction: TaskInstruction) =>
          this.taskInstructionService.remove(taskInstruction.id),
        ),
      );
    }
    await this.taskRepository.delete(id);
    return;
  }

  /**
   * Assigns a facilitator to a task.
   * If the facilitator is not a user, a new user will be created with the given email and a random password.
   * An email will be sent to the facilitator with the password.
   * If the facilitator is already assigned to the task, the existing user task will be returned.
   * @param userTask - object containing email and task id of the facilitator
   * @param queryRunner - query runner to use for the transaction
   * @returns a promise resolving to the saved user task entity
   * @throws {NotFoundException} - if the task is not found
   * @throws {NotFoundException} - if the role is not found
   */
  async assignFacilitator(
    userTask: { email: string; task_id: string },
    queryRunner: QueryRunner,
  ): Promise<UserTask> {
    let user: User | null = await this.userService.findOne({
      where: { email: userTask.email },
    });
    const task: Task | null = await this.findOne({
      where: { id: userTask.task_id },
    });
    const role: Role | null = await this.roleService.findOne({
      name: RoleEnum.FACILITATOR,
    });

    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    if (user) {
      this.emailService.sendEmail(
        user.email,
        'Welcome to Mahder platform',
        `
        Dear ${user.first_name} ${user.middle_name},you are assigned as a facilitator for a task ${task.name}
       
        `,
      );
    }
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8);
      user = await this.userService.create(
        {
          email: userTask.email,
          role_id: role.id,
          password: randomPassword,
        },
        queryRunner,
      );
      // Send email to user with random password
      this.emailService.sendEmail(
        user.email,
        'Welcome to Mahder platform',
        `
          Dear user, Welcome to our platform,you are assigned as a facilitator for a task ${task.name}
          Your password is ${randomPassword}, you can change it later
          `,
      );
    }
    // Check If the user is already assigned
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne({
      where: { task_id: task.id, user_id: user.id },
    });
    if (userTaskBefore) {
      return userTaskBefore;
    }
    return await this.userTaskService.create(
      {
        task_id: task.id,
        user_id: user.id,
        role: RoleEnum.FACILITATOR,
        status: UserTaskStatus.ACTIVE,
      },
      queryRunner,
    );
  }
  /**
   * Assigns a reviewer to a task.
   * If the reviewer is not a user, a new user will be created with the given email and a random password.
   * An email will be sent to the reviewer with the password.
   * If the reviewer is already assigned to the task, the existing user task will be returned.
   * @param userTask - object containing email and task id of the reviewer
   * @param queryRunner - query runner to use for the transaction
   * @returns a promise resolving to the saved user task entity
   * @throws {NotFoundException} - if the task is not found
   * @throws {NotFoundException} - if the role is not found
   */
  async assignReviewer(
    userTask: { email: string; task_id: string },
    queryRunner: QueryRunner,
  ): Promise<UserTask> {
    let user: User | null = await this.userService.findOne({
      where: { email: userTask.email },
    });
    const task: Task | null = await this.findOne({
      where: { id: userTask.task_id },
    });
    const role: Role | null = await this.roleService.findOne({
      name: RoleEnum.REVIEWER,
    });

    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    if (user) {
      this.emailService.sendEmail(
        user.email,
        'Welcome to Mahder platform',
        `
        Dear ${user.first_name} ${user.middle_name},you are assigned as a reviewer for a task ${task.name}
       
        `,
      );
    }
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8);
      user = await this.userService.create(
        {
          email: userTask.email,
          role_id: role.id,
          password: randomPassword,
        },
        queryRunner,
      );
      // Send email to user with random password
      this.emailService.sendEmail(
        user.email,
        'Welcome to Mahder platform',
        `
          Dear user, Welcome to our platform,you are assigned as a reviewer for a task ${task.name}
          Your password is ${randomPassword}, you can change it later
          `,
      );
    }
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne({
      where: { task_id: task.id, user_id: user.id },
    });
    if (userTaskBefore) {
      return userTaskBefore;
    }
    return await this.userTaskService.create(
      {
        task_id: task.id,
        user_id: user.id,
        role: RoleEnum.REVIEWER,
      },
      queryRunner,
    );
  }
  /**
   * Assigns contributors to a task.
   * The task must exist and the contributors must be valid users with the correct role.
   * If the task has a maximum expected number of contributors, the number of contributors
   * assigned to it must not exceed this number.
   * If the task requires a contributor test, the status of the contributor assignment will be 'PENDING'.
   * Otherwise, the status will be 'ACTIVE'.
   * @param task_id The id of the task.
   * @param contributor_ids An array of ids of the contributors to be assigned.
   * @param queryRunner The query runner to use for the transaction.
   * @returns A promise that resolves to an array of user task entities.
   * @throws {NotFoundException} - if the task or user is not found
   * @throws {BadRequestException} - if the number of contributors exceeds the maximum expected number
   * @throws {InternalServerErrorException} - if an unexpected error occurs
   */
  async assignContributor(
    task_id: string,
    contributor_ids: string[],
    queryRunner: QueryRunner,
  ): Promise<UserTask[]> {
    const task: Task | null = await this.findOne({
      where: { id: task_id },
      relations: { userToTasks: true },
    });
    const role: Role | null = await this.roleService.findOne({
      name: RoleEnum.CONTRIBUTOR,
    });
    try {
      if (!task) {
        throw new NotFoundException(`Task not found`);
      }
      if (!role) {
        throw new NotFoundException(`Role not found`);
      }
      const users: User[] | null = await this.userService.findMany({
        where: { id: In(contributor_ids), role_id: role.id },
      });
      if (!users || users.length === 0) {
        throw new NotFoundException(`User not found`);
      }
      if (task.max_expected_no_of_contributors) {
        const totalContributor = task.userToTasks.filter(
          (ut) => ut.role == RoleEnum.CONTRIBUTOR,
        ).length;
        if (
          contributor_ids.length + totalContributor >
          task.max_expected_no_of_contributors
        ) {
          throw new BadRequestException(
            `Number of contributors exceeds the maximum expected number of contributors for this task`,
          );
        }
      }
      const status = task.require_contributor_test
        ? UserTaskStatus.PENDING
        : UserTaskStatus.ACTIVE;
      const userTasks = await Promise.all(
        users.map(async (user) => {
          return this.userTaskService.findOneOrCreate(
            { where: { task_id: task.id, user_id: user.id } },
            {
              task_id: task.id,
              user_id: user.id,
              role: RoleEnum.CONTRIBUTOR,
              status: status,
            },
            queryRunner,
          );
        }),
      );
      return userTasks.filter((ut): ut is UserTask => ut !== null);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
  /**
   * Assigns contributors to a facilitator in a task.
   * The task, facilitator and contributors must exist.
   * The facilitator must be assigned to the task with the correct role.
   * The contributors must be valid users with the correct role.
   * If the task has a maximum expected number of contributors, the number of contributors
   * assigned to it must not exceed this number.
   * If the task requires a contributor test, the status of the contributor assignment will be 'PENDING'.
   * Otherwise, the status will be 'ACTIVE'.
   * @param task_id The id of the task.
   * @param facilitator_id The id of the facilitator.
   * @param contributor_ids An array of ids of the contributors to be assigned.
   * @param queryRunner The query runner to use for the transaction.
   * @returns A promise that resolves to a facilitator contributor entity.
   * @throws {NotFoundException} - if the task, facilitator or user is not found
   * @throws {BadRequestException} - if the number of contributors exceeds the maximum expected number
   * @throws {InternalServerErrorException} - if an unexpected error occurs
   */
  async assignContributorsToFacilitator(
    task_id: string,
    facilitator_id: string,
    contributor_ids: string[],
    queryRunner: QueryRunner,
  ): Promise<FacilitatorContributor> {
    const task: Task | null = await this.findOne({ where: { id: task_id } });
    const role: Role | null = await this.roleService.findOne({
      name: RoleEnum.FACILITATOR,
    });
    const contributor_role: Role | null = await this.roleService.findOne({
      name: RoleEnum.CONTRIBUTOR,
    });
    const user: User[] = await this.userService.findMany({
      where: { id: In(contributor_ids), role_id: contributor_role?.id },
    });
    const valid_contributor_ids: string[] = user.map((user) => user.id);
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    return await this.facilitatorContributorService.assignContributors(
      task_id,
      facilitator_id,
      valid_contributor_ids,
      queryRunner,
    );
  }
  /**
   * Finds a user task or creates a new one if it doesn't exist.
   * Updates the has_done_task field of the user task if it exists.
   * @param userTask The partial user task to find or create.
   * @param queryRunner The query runner to use for the transaction.
   * @returns A promise that resolves to the found or created user task.
   * @throws {InternalServerErrorException} - if an unexpected error occurs
   */
  async findOrAddContributorToTask(
    userTask: Partial<UserTask>,
    queryRunner?: QueryRunner,
  ): Promise<UserTask> {
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne({
      where: { task_id: userTask.task_id, user_id: userTask.user_id },
    });
    if (userTaskBefore) {
      userTaskBefore.has_done_task = true;
      await this.userTaskService.update(userTaskBefore.id, userTaskBefore);
      return userTaskBefore;
    }
    if (queryRunner) {
      const manager = queryRunner.manager;
      const userTaskk = manager.create(UserTask, {
        task_id: userTask.task_id,
        user_id: userTask.user_id,
        has_done_task: true,
        role: RoleEnum.CONTRIBUTOR,
        status: UserTaskStatus.PENDING,
      });
      return manager.save(userTaskk);
    } else {
      return await this.userTaskService.create({
        task_id: userTask.task_id,
        user_id: userTask.user_id,
        has_done_task: true,
        role: RoleEnum.CONTRIBUTOR,
        status: UserTaskStatus.PENDING,
      });
    }
  }
  /**
   * Activates a contributor to a task.
   * If the user task does not exist, creates a new one.
   * If the user task exists, updates the status of the user task to 'ACTIVE'.
   * @param userTask The partial user task to activate.
   * @param queryRunner The query runner to use for the transaction.
   * @returns A promise that resolves to the updated or created user task.
   * @throws {InternalServerErrorException} - if an unexpected error occurs
   */
  async activateContributorToTask(
    userTask: Partial<UserTask>,
    queryRunner: QueryRunner,
  ): Promise<UserTask | null> {
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne(
      {
        where: { task_id: userTask.task_id, user_id: userTask.user_id },
      },
      queryRunner,
    );
    if (userTaskBefore) {
      return await this.userTaskService.update(
        userTaskBefore.id,
        { status: UserTaskStatus.ACTIVE },
        queryRunner,
      );
    } else {
      const manager = queryRunner.manager;
      const userTaskk = manager.create(UserTask, {
        task_id: userTask.task_id,
        user_id: userTask.user_id,
        role: RoleEnum.CONTRIBUTOR,
        status: UserTaskStatus.ACTIVE,
      });
      return manager.save(userTaskk);
    }
  }
  /**
   * Puts a contributor to a pending status if the task status is rejected.
   * If the user task does not exist, returns null.
   * If the user task exists and the status is not rejected, returns the user task.
   * If the user task exists and the status is rejected, updates the status of the user task to 'PENDING' and returns the updated user task.
   * @param userTask The partial user task to update.
   * @param queryRunner The query runner to use for the transaction.
   * @returns A promise that resolves to the updated or original user task, or null if the user task does not exist.
   */
  async pendingContributorIfRejectedOnTask(
    userTask: Partial<UserTask>,
    queryRunner: QueryRunner,
  ): Promise<UserTask | null> {
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne({
      where: { task_id: userTask.task_id, user_id: userTask.user_id },
    });
    if (userTaskBefore) {
      if (userTaskBefore.status == UserTaskStatus.REJECTED) {
        const manager = queryRunner.manager;
        await manager.update(
          UserTask,
          { task_id: userTask.task_id, user_id: userTask.user_id },
          { status: UserTaskStatus.PENDING },
        );
        return await manager.findOne(UserTask, {
          where: { task_id: userTask.task_id, user_id: userTask.user_id },
        });
      } else {
        return userTaskBefore;
      }
    }
    return null;
  }
  /**
   * Updates a user task to pending status if the task status is rejected.
   * If the user task does not exist, creates a new one.
   * @param userTask The partial user task to update.
   * @param queryRunner The query runner to use for the transaction.
   */
  async updateOrCreateUserToPending(
    userTask: Partial<UserTask> | DeepPartial<UserTask>,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne(
      {
        where: { task_id: userTask.task_id, user_id: userTask.user_id },
      },
      queryRunner,
    );
    if (userTaskBefore && userTaskBefore.status == UserTaskStatus.REJECTED) {
      await queryRunner.manager.update(
        UserTask,
        { task_id: userTask.task_id, user_id: userTask.user_id },
        { status: UserTaskStatus.PENDING },
      );
      return;
    } else if (!userTaskBefore) {
      const data = queryRunner.manager.create(UserTask, userTask);
      await queryRunner.manager.save(UserTask, data);
    }
  }
  /**
   * Adds a task instruction to a task.
   * If the task does not exist, throws a NotFoundException.
   * @param taskInstruction The partial task instruction to add.
   * @param queryRunner The query runner to use for the transaction.
   * @returns A promise that resolves to the created task instruction.
   * @throws {NotFoundException} - if the task is not found
   */
  async addTaskInstructions(
    taskInstruction: Partial<TaskInstruction>,
    queryRunner?: QueryRunner,
  ): Promise<TaskInstruction> {
    const task: Task | null = await this.findOne({
      where: { id: taskInstruction.task_id },
    });
    if (!task) {
      throw new NotFoundException(`Task not found`);
    }
    return await this.taskInstructionService.create(
      taskInstruction,
      queryRunner,
    );
  }
  /**
   * Removes a user from a task.
   * If the user task does not exist, throws a NotFoundException.
   * @param userTask The partial user task to remove.
   * @returns A promise that resolves to void.
   * @throws {NotFoundException} - if the user task is not found
   */
  async removeUserFromTask(userTask: Partial<UserTask>): Promise<void> {
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne({
      where: { task_id: userTask.task_id, user_id: userTask.user_id },
    });
    if (!userTaskBefore) {
      throw new NotFoundException(`User not found`);
    }
    await this.userTaskService.remove(userTaskBefore.id);
  }
  /**
   * Toggles the status of a user task between 'Active' and 'InActive'.
   * If the user task does not exist, throws a NotFoundException.
   * @param userTask The partial user task to toggle.
   * @param queryRunner The query runner to use for the transaction.
   * @returns A promise that resolves to the updated user task.
   * @throws {NotFoundException} - if the user task is not found
   */
  async activateToggleUserTask(
    userTask: Partial<UserTask>,
    queryRunner?: QueryRunner,
  ): Promise<UserTask | null> {
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne({
      where: { task_id: userTask.task_id, user_id: userTask.user_id },
      relations: { task: true, user: true },
    });
    if (!userTaskBefore) {
      throw new NotFoundException(`User not found`);
    }
    const status: 'Active' | 'InActive' =
      userTaskBefore.status == 'Active' ? 'InActive' : 'Active';
    return await this.userTaskService.update(
      userTaskBefore.id,
      { status: status },
      queryRunner,
    );
  }
  /**
   * Flags a user task.
   * If the user task does not exist, throws a NotFoundException.
   * If the user task is flagged, it sets the status to 'InActive' and sends an email to the user.
   * @param userTask The partial user task to flag.
   * @param queryRunner The query runner to use for the transaction.
   * @returns A promise that resolves to the updated user task.
   * @throws {NotFoundException} - if the user task is not found
   */
  async flagUserTask(
    userTask: Partial<UserTask>,
    queryRunner?: QueryRunner,
  ): Promise<UserTask | null> {
    const userTaskBefore: UserTask | null = await this.userTaskService.findOne({
      where: { task_id: userTask.task_id, user_id: userTask.user_id },
      relations: { task: true, user: true },
    });
    if (!userTaskBefore) {
      throw new NotFoundException(`User not found`);
    }
    userTaskBefore.is_flagged = false;
    userTaskBefore.status = 'InActive';
    if (userTaskBefore.is_flagged) {
      this.emailService.sendEmail(
        userTaskBefore.user.email,
        'Mahder platform',
        `
        Dear ${userTaskBefore.user.first_name} ${userTaskBefore.user.middle_name},you are flagged from the task ${userTaskBefore.task.name}
        `,
      );
    }
    return await this.userTaskService.update(
      userTaskBefore.id,
      { is_flagged: userTask.is_flagged },
      queryRunner,
    );
  }

  /**
   * This function takes a user profile and returns a list of tasks that match it.
   * The tasks are scored based on how well they match the user's profile.
   * The score is determined by the following criteria:
   * - Dialect match: 1 point
   * - Language match: 1 point
   * - Age match: 1 point
   * - Sector match: 1 point
   * The function returns a list of tasks sorted by score in descending order.
   * @param userProfile The user's profile
   * @returns A list of tasks that match the user's profile
   */
  async findMatchingTasks(userProfile: {
    dialect_id: string;
    language_id: string;
    birth_date: Date;
    gender: string;
    sector?: string[];
  }) {
    const tasks: Task[] = await this.findAll({
      where: {
        language_id: userProfile.language_id,
        is_public: true,
        is_closed: false,
        distribution_started: true,
      },
      relations: { taskRequirement: true },
      order: { created_date: 'DESC' },
    });
    const scoreTasks: { task: Task; score: number }[] = [];
    for (const task of tasks) {
      const taskRequirement: TaskRequirement = task.taskRequirement;
      let score = 0;
      if (
        !taskRequirement.is_dialect_specific ||
        taskRequirement.dialects?.some((d) => d.id === userProfile.dialect_id)
      ) {
        score += 1;
      }
      if (
        taskRequirement.is_dialect_specific &&
        !taskRequirement.dialects?.some((d) => d.id === userProfile.dialect_id)
      ) {
        continue;
      }
      // Requires Some logic
      // if (!taskRequirement.is_gender_specific || taskRequirement.gender?.[user.gender] > 0) {
      //   score += 1;
      // }
      const age =
        new Date().getFullYear() - userProfile.birth_date.getFullYear();
      if (
        !taskRequirement.is_age_specific ||
        (age >= (taskRequirement.age?.min || 0) &&
          age <= (taskRequirement.age?.max || 100))
      ) {
        score += 1;
      }
      if (
        !taskRequirement.is_sector_specific ||
        taskRequirement.sectors?.some((s) => userProfile.sector?.includes(s))
      ) {
        score += 1;
      }
      scoreTasks.push({ task: task, score: score });
    }
    return scoreTasks.sort((a, b) => b.score - a.score);
  }

  /**
   * Finds reviewer tasks with pagination.
   * @param user_id - The user id to find reviewer tasks for.
   * @param paginationDto - The pagination options.
   * @returns A promise resolving to a paginated result of reviewer tasks.
   */
  async findReviewerTasks(
    user_id: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Task>> {
    const [userTasks, total] = await this.userTaskService.findAndCount(
      {
        where: {
          user_id: user_id,
          role: RoleEnum.REVIEWER,
          task: { is_archived: false },
        },
        relations: { task: { taskType: true } },
        order: { created_date: 'DESC' },
      },
      paginationDto,
    );

    return {
      result: userTasks.map((userTask: UserTask) => userTask.task),
      page: paginationDto.page || 1,
      limit: paginationDto.limit || 10,
      total: total,
      totalPages: Math.ceil(total / (paginationDto.limit || 10)),
    };
  }
  /**
   * Finds facilitator tasks with pagination.
   * @param user_id - The user id to find facilitator tasks for.
   * @param paginationDto - The pagination options.
   * @returns A promise resolving to a paginated result of facilitator tasks.
   */
  async findFacilitatorTasks(
    user_id: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Task>> {
    const userTasks: UserTask[] = await this.userTaskService.findAll({
      where: { user_id: user_id, role: RoleEnum.FACILITATOR },
      relations: { task: true },
    });
    const task_ids: string[] = userTasks.map(
      (userTask: UserTask) => userTask.task_id,
    );
    return this.findPaginate(
      { where: { id: In(task_ids), is_archived: false } },
      paginationDto,
    );
  }
  /**
   * Finds contributor submissions with pagination.
   * @param contributor_id - The contributor id to find submissions for.
   * @param paginationDto - The pagination options.
   * @returns A promise resolving to a paginated result of contributor submissions.
   */
  async getContributorSubmissions(
    contributor_id: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<any>> {
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;

    // GET COMPLETED CONTRI
    const qb = this.taskRepository
      .createQueryBuilder('task')
      .innerJoin('task.microTasks', 'microTask')
      .innerJoin('task.taskType', 'taskType')
      .innerJoin('microTask.dataSets', 'dataset')
      .andWhere('microTask.is_test=false')
      .where('dataset.contributor_id = :cid', { cid: contributor_id })
      .andWhere(
        'EXISTS (' +
          'SELECT 1 FROM data_set ds ' +
          'WHERE ds.micro_task_id = microTask.id ' +
          'AND ds.contributor_id = :cid ' +
          'AND ds.is_test = false ' +
          'AND ds.status = :approvedStatus' +
          ')',
        {
          cid: contributor_id,
          approvedStatus: DataSetStatus.APPROVED,
        },
      )
      .andWhere(
        'NOT EXISTS (' +
          'SELECT 1 FROM micro_task mt ' +
          'WHERE mt.task_id = task.id ' +
          'AND NOT EXISTS (' +
          'SELECT 1 FROM data_set ds2 ' +
          'WHERE ds2.micro_task_id = mt.id ' +
          'AND ds2.is_test = false ' +
          'AND ds2.contributor_id = :cid ' +
          'AND ds2.status = :approvedStatus' +
          ') ' +
          'AND EXISTS (' +
          'SELECT 1 FROM data_set ds3 ' +
          'WHERE ds3.micro_task_id = mt.id ' +
          'AND ds3.is_test = false ' +
          'AND ds3.contributor_id = :cid' +
          ')' +
          ')',
        {
          cid: contributor_id,
          approvedStatus: DataSetStatus.APPROVED,
        },
      )
      .select('task.id', 'id')
      .addSelect('task.name', 'name')
      .addSelect('taskType.task_type', 'task_type')
      // include task type ,
      .addSelect('COUNT(DISTINCT microTask.id)', 'total_count') // count datasets
      .addSelect('MAX(dataset.created_date)', 'last_submission_date')
      .groupBy('task.id')
      .addGroupBy('task.name')
      .addGroupBy('taskType.task_type')
      .orderBy('last_submission_date', 'DESC');

    const results = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany();
    const countQb = this.taskRepository
      .createQueryBuilder('task')
      .innerJoin('task.microTasks', 'microTask', 'microTask.is_test=false')
      .innerJoin('microTask.dataSets', 'dataset')
      .where('dataset.contributor_id = :cid', { cid: contributor_id })
      // .andWhere(
      //   'NOT EXISTS (' +
      //     'SELECT 1 FROM data_set ds ' +
      //     'WHERE ds.micro_task_id = microTask.id ' +
      //     'AND ds.contributor_id = :cid ' +
      //     'AND ds.status IN (:...badStatuses)' +
      //   ')',
      //   {
      //     cid: contributor_id,
      //     badStatuses: [
      //       DataSetStatus.PENDING,
      //       DataSetStatus.Flagged,
      //       DataSetStatus.REJECTED,
      //     ],
      //   },
      // )
      .andWhere(
        'EXISTS (' +
          'SELECT 1 FROM data_set ds ' +
          'WHERE ds.micro_task_id = microTask.id ' +
          'AND ds.contributor_id = :cid ' +
          'AND ds.status = :approvedStatus' +
          ')',
        {
          cid: contributor_id,
          approvedStatus: DataSetStatus.APPROVED,
        },
      )
      .andWhere(
        'NOT EXISTS (' +
          'SELECT 1 FROM micro_task mt ' +
          'WHERE mt.task_id = task.id ' +
          'AND NOT EXISTS (' +
          'SELECT 1 FROM data_set ds2 ' +
          'WHERE ds2.micro_task_id = mt.id ' +
          'AND ds2.contributor_id = :cid ' +
          'AND ds2.status = :approvedStatus' +
          ') ' +
          'AND EXISTS (' +
          'SELECT 1 FROM data_set ds3 ' +
          'WHERE ds3.micro_task_id = mt.id ' +
          'AND ds3.contributor_id = :cid' +
          ')' +
          ')',
        {
          cid: contributor_id,
          approvedStatus: DataSetStatus.APPROVED,
        },
      )
      .select('COUNT(DISTINCT task.id)', 'total');
    const { total } = await countQb.getRawOne();
    return paginate(results, total, page, limit);
  }
  /**
   * Retrieves the contributor submissions for a given contributor.
   * @param {string} contributor_id - the id of the contributor
   * @param {PaginationDto} paginationDto - pagination info
   * @returns A promise resolving to a paginated result of contributor submissions.
   */
  async getContributorSubmissionsV2(
    contributor_id: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<ContributorSubmissionsDto>> {
    // 1. get user active status
    const memberTasks = await this.userTaskService.findAll({
      where: {
        user_id: contributor_id,
        status: 'Active',
      },
    });
    const memberTaskIds = memberTasks.map((m) => m.task_id);
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const tasks = await this.taskRepository.find({
      where: {
        id: In(memberTaskIds),
        microTasks: {
          is_test: false,
          dataSets: {
            contributor_id,
          },
        },
      },
      relations: {
        taskType: true,
        taskRequirement: true,
        taskInstructions: true,
        microTasks: { dataSets: true },
      },
      order: { created_date: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    const taskStatus: TaskStatus[] = getTaskStatus(tasks);
    const completedContributorTasks: ContributorSubmissionsDto[] = [];
    for (const contributorTask of taskStatus) {
      if (!contributorTask.hasPendingOrUndoneMicroTasks) {
        completedContributorTasks.push({
          id: contributorTask.id,
          name: contributorTask.name,
          task_type: contributorTask.taskType.task_type,
          total_count: contributorTask.microTasks.length,
          last_submission_date:
            contributorTask.microTasks[contributorTask.microTasks.length - 1]
              .created_date,
        });
      }
    }
    const total = completedContributorTasks.length;
    return paginate(completedContributorTasks, total, page, limit);
  }
  // async findContributor

  /**
   * Finds tasks that are compatible with the given micro task type.
   * @param {string} target_task_id - the id of the task to be imported
   * @returns A promise resolving to an array of compatible tasks
   */
  async findCompatibleTaskForImportMicroTask(
    target_task_id: string,
  ): Promise<Task[]> {
    const task: Task | null = await this.findOne({
      where: { id: target_task_id },
      relations: { taskRequirement: true, taskType: true },
    });
    if (!task) {
      throw new NotFoundException(`Task with id ${target_task_id} not found`);
    }
    const taskRequirement: TaskRequirement = task.taskRequirement;
    if (!taskRequirement) {
      throw new NotFoundException(
        `Task Requirement for task with id ${target_task_id} not found`,
      );
    }
    const task_type = task.taskType;
    const micro_task_type = task_type.task_type.split('-')[0];
    const data_set_type = task_type.task_type.split('-')[1];
    const compatibile_task_type = [
      `${micro_task_type}-${data_set_type}`,
      `${data_set_type}-${micro_task_type}`,
    ];
    if (micro_task_type == 'text') {
      compatibile_task_type.push('text-text');
    }

    const taskTypes: TaskType[] = await this.taskTypeService.findAll({
      where:
        task_type.task_type == 'text-text'
          ? {}
          : { task_type: In(compatibile_task_type) },
    });
    const taskTypeIds = taskTypes.map((taskType: TaskType) => taskType.id);
    const tasks: Task[] = await this.findAll({
      where: {
        task_type_id: In(taskTypeIds),
        project_id: task.project_id,
      },
      relations: { taskType: true },
    });
    const taskFilter = tasks.filter((task: Task) => task.id != target_task_id);
    return taskFilter;
    // return tasks.filter((task:Task)=>{task.id!=target_task_id});
  }
  async count(queryOption: QueryOptions<Task>): Promise<number> {
    const total_projects: number = await this.taskRepository.count(queryOption);
    return total_projects;
  }
  async updateTaskPayment(task_id: string, payment: UpdateTaskPaymentDto) {
    const task = await this.taskRepository.findOne({ where: { id: task_id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.distribution_started) {
      throw new BadRequestException(
        'Payment rates cannot be changed after task distribution starts',
      );
    }
    return await this.taskPaymentService.update(task_id, payment);
  }
  /**
   * Finds users with a given role that are not assigned to a task
   * @param taskId The id of the task
   * @param role The role of the users to find ('Contributor', 'Facilitator', or 'Reviewer')
   * @param userFilterDto A filter to apply to the users
   * @param paginationDto A pagination object to control the number of results returned
   * @returns A promise that resolves to a paginated result of users
   */
  async findTaskUnAssignedUsers(
    taskId: string,
    role: 'Contributor' | 'Facilitator' | 'Reviewer',
    userFilterDto: FindOptionsWhere<User> | FindOptionsWhere<User>[],
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<User>> {
    const members = await this.userTaskService.findAll({
      where: { task_id: taskId, role: role },
    });
    const memberUserIds = members.map((member) => member.user_id);
    let filter = userFilterDto;
    // Normalize filters into an array (so we can safely modify them)
    if (memberUserIds.length > 0) {
      // Apply "exclude members" to EACH filter
      if (!Array.isArray(userFilterDto)) {
        filter = { ...userFilterDto, id: Not(In(memberUserIds)) };
      } else {
        const userFilter: FindOptionsWhere<User>[] = [];
        for (const filter of userFilterDto) {
          const d = { ...filter, id: Not(In(memberUserIds)) };
          userFilter.push(d);
        }

        // userFilterDto=userFilterDto.map((filter) => ({
        //   ...filter,
        //   id: Not(In(memberUserIds)),  //  Exclude members
        // }));
      }
    }
    if (role == 'Contributor') {
      return this.userService.findContributorsPaginate(
        {
          where: userFilterDto,
        },
        paginationDto,
      );
    } else if (role == 'Facilitator') {
      return this.userService.findFacilitatorPaginate(
        {
          where: userFilterDto,
        },
        paginationDto,
      );
    } else if (role == 'Reviewer') {
      return this.userService.findReviewersPaginate(
        {
          where: userFilterDto,
        },
        paginationDto,
      );
    } else {
      return paginate([], 0, 0, 0);
    }
  }

  async archiveToggle(id: string): Promise<Task | null> {
    const task = await this.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    task.is_archived = !task.is_archived;
    return await this.taskRepository.save(task);
  }
  /**
   * Get tasks without a contributor assigned to them.
   * @param {string[]} filteredTaskIds task ids to filter by
   * @param {string} contributorId contributor id to exclude
   * @param {number} page pagination page number
   * @param {number} limit pagination limit
   * @returns {Promise<PaginatedResult<Task>>} tasks without contributors
   */
  async getTasksWithoutContributor(
    filteredTaskIds: string[],
    contributorId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Task>> {
    const skip = (page - 1) * limit;

    const [tasks, count] = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.taskRequirement', 'taskRequirement')
      .leftJoinAndSelect('task.taskType', 'taskType')
      .leftJoinAndSelect('task.taskInstructions', 'taskInstructions')
      .where('task.id IN (:...filteredTaskIds)', { filteredTaskIds })
      .andWhere(
        `NOT EXISTS (
        SELECT 1
        FROM data_set ds
        INNER JOIN micro_task mt ON ds.micro_task_id = mt.id
        WHERE mt.task_id = task.id
        AND ds.contributor_id = :contributorId
      )`,
        { contributorId },
      )
      .orderBy('task.created_date', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return paginate(tasks, count, page, limit);
  }
}
