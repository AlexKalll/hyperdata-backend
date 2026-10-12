import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { ContributorMicroTaskService } from './ContributorMicroTask.service';
import { ContributorMicroTasks } from '../enitities/ContributorMicroTasks.entity';
import { TaskService } from 'src/project/service/Task.service';
import { UserService } from 'src/auth/service/User.service';
import { Task } from 'src/project/entities/Task.entity';
import { MicroTaskService } from 'src/data_set/service/MicroTask.service';
import { ContributorMicroTasksConstantStatus } from 'src/utils/constants/ContributorMicroTasks.constant';
import { MicroTask } from 'src/data_set/entities/MicroTask.entity';
import { UserTaskService } from 'src/project/service/UserTask.service';
import { UserTask } from 'src/project/entities/UserTask.entity';
import { UserTaskStatus } from 'src/utils/constants/Task.constant';
import { paginate, PaginatedResult } from 'src/utils/paginate.util';
import {
  checkIfMicroTasIskRejectedAndTotalAttempts,
  getMicroTaskStatus,
  getTaskStatus,
} from 'src/utils/MicroTask.util';
import {
  ContributorDataSetRto,
  ContributorMicroTaskRto,
  ContributorTaskRto,
  TaskInstructionRto,
  TaskMicroTasksResponse,
} from '../rto/Task.rto';
import { GetContributorTasksDto } from '../dto/Task.dto';
import { DataSetSanitize } from 'src/data_set/sanitize';
import { CacheService } from 'src/cache/CacheService.service';

@Injectable()
/**
 * The TaskDistributionService class is responsible for managing task distribution and redistribution
 * among contributors. It provides methods to initialize task redistribution and to handle events
 * related to contributor creation. The service interacts with various other services such as
 * MicroTaskStatisticsService, ContributorMicroTaskService, TaskService, and UserService to achieve
 * its goals.
 */
export class GetTasksService {
  constructor(
    private readonly contributorMicroTaskService: ContributorMicroTaskService,
    private readonly taskService: TaskService,
    private readonly userService: UserService,
    private readonly microTaskService: MicroTaskService,
    private readonly userTaskService: UserTaskService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Retrieves contributor tasks for a given user with status filtering,
   * caching, and pagination support.
   *
   * Flow:
   * 1. Validate contributor existence.
   * 2. Attempt to fetch contributor tasks from cache.
   * 3. If cached data exists:
   *    - Apply status filtering
   *    - Paginate and return the result
   * 4. If no cache:
   *    - Resolve matching tasks based on contributor profile
   *    - Fetch assigned, member, and test-required tasks
   *    - Calculate task-level statistics (approved, pending, rejected)
   *    - Derive contributor-facing task statuses
   *    - Cache computed tasks
   *    - Apply status filtering and pagination
   *
   * Supported task statuses:
   * - NEW
   * - UNDER_REVIEW
   * - REJECTED
   * - COMPLETED
   * - TEST_UNDER_REVIEW
   * - TEST_REJECTED
   * - RECENT (mapped to review & rejection states)
   *
   * Pagination:
   * - Defaults: page = 1, limit = 10
   * - Performed in-memory after filtering
   *
   * Caching:
   * - Uses cacheService to read/write contributor task summaries
   * - Cache is keyed by contributor user ID
   *
   * @param {string} user_id
   *  Unique identifier of the contributor.
   *
   * @param {GetContributorTasksDto} contributorTaskDto
   *  Data transfer object containing:
   *  - `status` (optional): Task status filter (`ALL`, `RECENT`, or specific status)
   *  - `page` (optional): Page number for pagination
   *  - `limit` (optional): Maximum number of tasks per page
   *
   * @returns {Promise<PaginatedResult<ContributorTaskRto>>}
   *  Paginated contributor task list including:
   *  - `result`: Array of contributor task summaries
   *  - `total`: Total number of matched tasks
   *  - `totalPages`: Total available pages
   *  - `page`: Current page number
   *  - `limit`: Items per page
   *
   * @throws {NotFoundException}
   *  Thrown when the contributor user does not exist.
   */
  async getContributorTasks(
    user_id: string,
    contributorTaskDto: GetContributorTasksDto,
  ): Promise<PaginatedResult<ContributorTaskRto>> {
    const user = await this.userService.findOne({ where: { id: user_id } });
    if (!user) throw new NotFoundException(`User with id ${user_id} not found`);
    let tasks: any[] = await this.cacheService.getContributorTasks(user_id);
    if (tasks.length > 0) {
      const total = tasks.length;
      if (contributorTaskDto.status && contributorTaskDto.status != 'ALL') {
        if (contributorTaskDto.status == 'RECENT') {
          tasks = tasks.filter((task) =>
            [
              'REJECTED',
              'TEST_REJECTED',
              'UNDER_REVIEW',
              'TEST_UNDER_REVIEW',
            ].includes(task.status),
          );
        } else {
          tasks = tasks.filter(
            (task) => task.status == contributorTaskDto.status,
          );
        }
      }
      const limit = contributorTaskDto.limit || 10;
      const page = contributorTaskDto.page || 1;
      // const take=
      const skip = (page - 1) * limit;
      const lastIndex = Math.min(skip + limit, tasks.length);
      const paginatedContributorTasks = tasks.slice(skip, lastIndex);
      return paginate(paginatedContributorTasks, total, page, limit);
    }
    const matchedTasks = await this.taskService.findMatchingTasks({
      dialect_id: user.dialect_id,
      language_id: user.language_id,
      birth_date: user.birth_date,
      gender: user.gender,
    });
    const memberTasks = await this.userTaskService.findAll({
      where: {
        user_id: user_id,
      },
      order: {
        created_date: 'DESC',
      },
      relations: {
        task: true,
      },
    });
    const memberTaskIds = memberTasks.map((m) => m.task.id);
    const contributorAssignedTasks: ContributorMicroTasks[] =
      await this.contributorMicroTaskService.findAll({
        where: {
          contributor_id: user_id,
        },
        order: {
          created_date: 'DESC',
        },
      });
    const newAssignedTaskIds = contributorAssignedTasks
      .filter((task) => task.status === ContributorMicroTasksConstantStatus.NEW)
      .map((task) => task.task_id);
    const testRequireMatchingTaskIds = matchedTasks
      .filter((task) => task.task.require_contributor_test)
      .map((task) => task.task.id);

    const userTasks = await this.taskService.findAll({
      where: [
        {
          is_closed: false,
          is_archived: false,
          microTasks: {
            dataSets: {
              contributor_id: user_id,
            },
          },
        },
        {
          is_closed: false,
          is_archived: false,
          id: In([
            ...newAssignedTaskIds,
            ...testRequireMatchingTaskIds,
            ...memberTaskIds,
          ]),
        },
      ],
      order: {
        created_date: 'DESC',
      },
      relations: {
        taskType: true,
        taskRequirement: true,
        taskInstructions: true,
        microTasks: { dataSets: true },
        payment: true,
      },
    });
    userTasks.forEach((task) => {
      task.microTasks.forEach((microTask) => {
        microTask.dataSets = microTask.dataSets.filter(
          (ds) => ds.contributor_id === user_id,
        );
      });
    });

    const taskStatus = getTaskStatus(userTasks);
    let contributorRecentTasks: ContributorTaskRto[] = [];

    for (const task of taskStatus) {
      const contributorAssignedTask = contributorAssignedTasks.find(
        (item) => item.task_id == task.id,
      );
      const memberStatus: UserTask | undefined = memberTasks.find(
        (item) => item.task_id == task.id,
      );

      if (contributorAssignedTask) {
        if (
          !memberStatus ||
          (memberStatus.status !== 'InActive' &&
            memberStatus.status !== 'Flagged')
        ) {
          if (
            contributorAssignedTask.status ==
            ContributorMicroTasksConstantStatus.COMPLETED
          ) {
            if (task.totalRejectedMicroTasks > 0) {
              if (task.hasPendingOrUndoneMicroTasks) {
                contributorRecentTasks.push({
                  ...task,
                  status: 'REJECTED',
                  done_count: contributorAssignedTask.total_micro_tasks,
                  total_count: contributorAssignedTask.total_micro_tasks,
                  dead_line: contributorAssignedTask.dead_line,
                  rejected_count: task.totalRejectedMicroTasks,
                  pending_count: task.totalPendingMicroTasks,
                  approved_count: task.totalApprovedMicroTasks,
                  task_type: task.taskType.task_type,
                  average_time: task.taskRequirement.appriximate_time_per_batch,
                  estimated_earning:
                    task.payment.contributor_credit_per_microtask *
                    contributorAssignedTask.total_micro_tasks,
                  earning_per_task:
                    task.payment.contributor_credit_per_microtask,
                });
              }
            } else if (task.totalPendingMicroTasks > 0) {
              contributorRecentTasks.push({
                ...task,
                status: 'UNDER_REVIEW',
                done_count: contributorAssignedTask.total_micro_tasks,
                total_count: contributorAssignedTask.total_micro_tasks,
                dead_line: contributorAssignedTask.dead_line,
                rejected_count: task.totalRejectedMicroTasks,
                pending_count: task.totalPendingMicroTasks,
                approved_count: task.totalApprovedMicroTasks,
                task_type: task.taskType?.task_type,
                average_time: task.taskRequirement.appriximate_time_per_batch,
                estimated_earning:
                  task.payment.contributor_credit_per_microtask *
                  contributorAssignedTask.total_micro_tasks,
                earning_per_task: task.payment.contributor_credit_per_microtask,
              });
            } else {
              // If all are approved
              contributorRecentTasks.push({
                ...task,
                status: 'COMPLETED',
                done_count: contributorAssignedTask.total_micro_tasks,
                total_count: contributorAssignedTask.total_micro_tasks,
                dead_line: contributorAssignedTask.dead_line,
                rejected_count: 0,
                pending_count: 0,
                approved_count: task.totalApprovedMicroTasks,
                task_type: task.taskType?.task_type,
                average_time: task.taskRequirement.appriximate_time_per_batch,
                estimated_earning:
                  task.payment.contributor_credit_per_microtask *
                  contributorAssignedTask.total_micro_tasks,
                earning_per_task: task.payment.contributor_credit_per_microtask,
              });
            }
          } else {
            const totalDoneCount = Math.min(
              task.totalRejectedMicroTasks +
                task.totalPendingMicroTasks +
                task.totalApprovedMicroTasks,
              contributorAssignedTask.total_micro_tasks,
            );
            if (task.totalRejectedMicroTasks > 0) {
              contributorRecentTasks.push({
                ...task,
                status:
                  task.totalRejectedMicroTasks > 0
                    ? 'REJECTED'
                    : 'UNDER_REVIEW',
                done_count: totalDoneCount,
                total_count: contributorAssignedTask.total_micro_tasks,
                dead_line: contributorAssignedTask.dead_line,
                rejected_count: task.totalRejectedMicroTasks,
                pending_count: task.totalPendingMicroTasks,
                approved_count: task.totalApprovedMicroTasks,
                task_type: task.taskType.task_type,
                average_time: task.taskRequirement.appriximate_time_per_batch,
                estimated_earning:
                  task.payment.contributor_credit_per_microtask *
                  contributorAssignedTask.total_micro_tasks,
                earning_per_task: task.payment.contributor_credit_per_microtask,
              });
            } else {
              // If the assignment is new or inprogress
              // if in progress
              if (
                contributorAssignedTask.status ==
                ContributorMicroTasksConstantStatus.IN_PROGRESS
              ) {
                const done_count = contributorAssignedTask.current_batch;
                const total_count =
                  contributorAssignedTask.micro_task_ids.length;
                const dead_line = contributorAssignedTask.dead_line;
                const rejected_count = task.totalRejectedMicroTasks;
                const pending_count = task.totalPendingMicroTasks;
                const approved_count = task.totalApprovedMicroTasks;

                contributorRecentTasks.push({
                  ...task,
                  status: 'UNDER_REVIEW',
                  done_count,
                  total_count,
                  dead_line,
                  rejected_count,
                  pending_count,
                  approved_count,
                  task_type: task.taskType.task_type,
                  average_time: task.taskRequirement.appriximate_time_per_batch,
                  estimated_earning:
                    task.payment.contributor_credit_per_microtask *
                    contributorAssignedTask.total_micro_tasks,
                  earning_per_task:
                    task.payment.contributor_credit_per_microtask,
                });
              }
              if (
                contributorAssignedTask.status ==
                ContributorMicroTasksConstantStatus.NEW
              ) {
                const totalDone =
                  task.totalApprovedMicroTasks +
                  task.totalPendingMicroTasks +
                  task.totalRejectedMicroTasks +
                  task.totalApprovedTestMicroTasks +
                  task.totalPendingTestMicroTasks +
                  task.totalRejectedTestMicroTasks;
                if (totalDone > 0) {
                  const done_count = 0;
                  const maxBatch = Math.min(
                    contributorAssignedTask.batch,
                    contributorAssignedTask.micro_task_ids.length,
                  ); //contributorAssignedTask.batch
                  const total_count =
                    contributorAssignedTask.micro_task_ids.slice(
                      0,
                      maxBatch,
                    ).length;
                  const dead_line = contributorAssignedTask.dead_line;
                  const rejected_count = task.totalRejectedMicroTasks;
                  const pending_count = task.totalPendingMicroTasks;
                  const approved_count = task.totalApprovedMicroTasks;

                  contributorRecentTasks.push({
                    ...task,
                    status: 'UNDER_REVIEW',
                    done_count,
                    total_count,
                    dead_line,
                    rejected_count,
                    pending_count,
                    approved_count,
                    task_type: task.taskType.task_type,
                    average_time:
                      task.taskRequirement.appriximate_time_per_batch,
                    estimated_earning:
                      task.payment.contributor_credit_per_microtask *
                      contributorAssignedTask.total_micro_tasks,
                    earning_per_task:
                      task.payment.contributor_credit_per_microtask,
                  });
                } else {
                  const done_count = 0;
                  const total_count = Math.min(
                    contributorAssignedTask.micro_task_ids.length,
                    contributorAssignedTask.batch,
                  );
                  const dead_line = contributorAssignedTask.dead_line;
                  contributorRecentTasks.push({
                    ...task,
                    status: 'NEW',
                    done_count,
                    total_count,
                    dead_line,
                    rejected_count: 0,
                    pending_count: 0,
                    approved_count: 0,
                    task_type: task.taskType.task_type,
                    average_time:
                      task.taskRequirement.appriximate_time_per_batch,
                    estimated_earning:
                      task.payment.contributor_credit_per_microtask *
                      contributorAssignedTask.total_micro_tasks,
                    earning_per_task:
                      task.payment.contributor_credit_per_microtask,
                  });
                }
              }
            }
          }
        }
      } else {
        if (memberStatus) {
          if (memberStatus.status == 'Active') {
            if (
              task.totalApprovedTestMicroTasks > 0 &&
              task.totalApprovedMicroTasks == 0
            ) {
              contributorRecentTasks.push({
                ...task,
                status: 'TEST_UNDER_REVIEW',
                done_count: task.totalApprovedTestMicroTasks,
                total_count: task.totalApprovedTestMicroTasks,
                // dead_line: '',
                rejected_count: 0,
                pending_count: 0,
                approved_count: task.totalApprovedTestMicroTasks,
                task_type: task.taskType.task_type,
                average_time: task.taskRequirement.appriximate_time_per_batch,
                estimated_earning:
                  task.payment.contributor_credit_per_microtask *
                  task.taskRequirement.max_micro_task_per_contributor,
                earning_per_task: task.payment.contributor_credit_per_microtask,
              });
            } else if (task.totalApprovedMicroTasks > 0) {
              contributorRecentTasks.push({
                ...task,
                status: 'COMPLETED',
                done_count: task.totalApprovedMicroTasks,
                total_count: task.totalApprovedMicroTasks,
                dead_line: undefined,
                rejected_count: 0,
                pending_count: 0,
                approved_count: task.totalApprovedMicroTasks,
                task_type: task.taskType?.task_type,
                average_time: task.taskRequirement.appriximate_time_per_batch,
                estimated_earning:
                  task.payment.contributor_credit_per_microtask *
                  task.taskRequirement.max_micro_task_per_contributor,
                earning_per_task: task.payment.contributor_credit_per_microtask,
              });
            }
          } else if (memberStatus.status == 'Rejected') {
            contributorRecentTasks.push({
              ...task,
              status: 'TEST_REJECTED',
              done_count:
                task.totalApprovedTestMicroTasks +
                task.totalPendingTestMicroTasks +
                task.totalRejectedTestMicroTasks,
              total_count:
                task.totalApprovedTestMicroTasks +
                task.totalPendingTestMicroTasks +
                task.totalRejectedTestMicroTasks,
              rejected_count: task.totalRejectedTestMicroTasks,
              pending_count: task.totalPendingTestMicroTasks,
              approved_count: task.totalApprovedTestMicroTasks,
              task_type: task.taskType?.task_type,
              average_time: task.taskRequirement.appriximate_time_per_batch,
              estimated_earning:
                task.payment.contributor_credit_per_microtask *
                task.taskRequirement.max_micro_task_per_contributor,
              earning_per_task: task.payment.contributor_credit_per_microtask,
            });
          } else if (memberStatus.status == 'Pending') {
            const totalDoneTasks =
              task.totalApprovedTestMicroTasks +
              task.totalPendingTestMicroTasks +
              task.totalRejectedTestMicroTasks;
            const totalTestMicroTasks = task.microTasks.filter(
              (m) => m.is_test,
            ).length;
            contributorRecentTasks.push({
              ...task,
              status:
                task.totalRejectedTestMicroTasks > 0
                  ? 'REJECTED'
                  : totalDoneTasks > 0
                    ? 'UNDER_REVIEW'
                    : 'NEW',
              done_count: totalDoneTasks,
              total_count:
                totalDoneTasks > 0 ? totalDoneTasks : totalTestMicroTasks,
              rejected_count: task.totalRejectedTestMicroTasks,
              pending_count: task.totalPendingTestMicroTasks,
              approved_count: task.totalApprovedTestMicroTasks,
              task_type: task.taskType.task_type,
              average_time: task.taskRequirement.appriximate_time_per_batch,
              estimated_earning:
                task.payment.contributor_credit_per_microtask *
                task.taskRequirement.max_micro_task_per_contributor,
              earning_per_task: task.payment.contributor_credit_per_microtask,
            });
          }
        } else {
          if (task.require_contributor_test) {
            const totalTestMicroTasks = task.microTasks.filter(
              (m) => m.is_test,
            ).length;
            contributorRecentTasks.push({
              ...task,
              status: 'NEW',
              done_count: 0,
              total_count: totalTestMicroTasks,
              rejected_count: 0,
              pending_count: 0,
              approved_count: 0,
              task_type: task.taskType.task_type,
              average_time: task.taskRequirement.appriximate_time_per_batch,
              estimated_earning:
                task.payment.contributor_credit_per_microtask *
                task.taskRequirement.max_micro_task_per_contributor,
              earning_per_task: task.payment.contributor_credit_per_microtask,
            });
          }
        }
      }
    }
    if (contributorRecentTasks.length > 0) {
      console.log('WRITING CACHE');
      await this.cacheService.writeContributorTask(
        user_id,
        contributorRecentTasks,
      );
      console.log('WRITING CACHE DONE');
    }
    if (contributorTaskDto.status && contributorTaskDto.status != 'ALL') {
      if (contributorTaskDto.status == 'RECENT') {
        contributorRecentTasks = contributorRecentTasks.filter((task) =>
          [
            'REJECTED',
            'TEST_REJECTED',
            'UNDER_REVIEW',
            'TEST_UNDER_REVIEW',
          ].includes(task.status),
        );
      } else {
        contributorRecentTasks = contributorRecentTasks.filter(
          (task) => task.status == contributorTaskDto.status,
        );
      }
    }
    const limit = contributorTaskDto.limit || 10;
    const page = contributorTaskDto.page || 1;
    // const take=
    const skip = (page - 1) * limit;
    const lastIndex = Math.min(skip + limit, contributorRecentTasks.length);
    const paginatedContributorTasks = contributorRecentTasks.slice(
      skip,
      lastIndex,
    );
    return {
      result: paginatedContributorTasks,
      total: contributorRecentTasks.length,
      totalPages: Math.ceil(contributorRecentTasks.length / limit),
      page: page,
      limit: limit,
    };
  }
  // async getUserRecentTasksV2(
  //   user_id: string,
  //   paginateDto: PaginationDto,
  // ): Promise<PaginatedResult<ContributorRecentTaskRto>> {
  //   const userParticipatedTasks = await this.taskService.findAll({
  //     where: {
  //       microTasks: {
  //         dataSets: {
  //           contributor_id: user_id,
  //         },
  //       },
  //     },
  //     order: {
  //       created_date: 'DESC',
  //     },
  //     relations: {
  //       taskType: true,
  //       taskRequirement: true,
  //       taskInstructions: true,
  //       microTasks: { dataSets: true },
  //     },
  //   });
  //   const memberTasks = await this.userTaskService.findAll({
  //     where: {
  //       user_id: user_id,
  //     },
  //     order: {
  //       created_date: 'DESC',
  //     },
  //   });
  //   const contributorAssignedTasks: ContributorMicroTasks[] =
  //     await this.contributorMicroTaskService.findAll({
  //       where: {
  //         contributor_id: user_id,
  //       },
  //       order: {
  //         created_date: 'DESC',
  //       },
  //     });
  //   const taskStatus = getTaskStatus(userParticipatedTasks);
  //   let contributorRecentTasks: ContributorRecentTaskRto[] = [];

  //   for (const task of taskStatus) {
  //     const contributorAssignedTask = contributorAssignedTasks.find(
  //       (item) => item.task_id == task.id,
  //     );
  //     const memberStatus: UserTask | undefined = memberTasks.find(
  //       (item) => item.task_id == task.id,
  //     );
  //     if (contributorAssignedTask) {
  //       if (
  //         contributorAssignedTask.status ==
  //         ContributorMicroTasksConstantStatus.COMPLETED
  //       ) {
  //         if (task.totalRejectedMicroTasks > 0) {
  //           if (task.hasPendingOrUndoneMicroTasks) {
  //             contributorRecentTasks.push({
  //               ...task,
  //               status: 'REJECTED',
  //               done_count: contributorAssignedTask.total_micro_tasks,
  //               total_count: contributorAssignedTask.total_micro_tasks,
  //               dead_line: contributorAssignedTask.dead_line,
  //               rejected_count: task.totalRejectedMicroTasks,
  //               pending_count: task.totalPendingMicroTasks,
  //               approved_count: task.totalApprovedMicroTasks,
  //               task_type: task.taskType.task_type,
  //               average_time: task.taskRequirement.appriximate_time_per_batch,
  //             });
  //           }
  //         } else if (task.totalPendingMicroTasks > 0) {
  //           contributorRecentTasks.push({
  //             ...task,
  //             status: 'UNDER_REVIEW',
  //             done_count: contributorAssignedTask.total_micro_tasks,
  //             total_count: contributorAssignedTask.total_micro_tasks,
  //             dead_line: contributorAssignedTask.dead_line,
  //             rejected_count: task.totalRejectedMicroTasks,
  //             pending_count: task.totalPendingMicroTasks,
  //             approved_count: task.totalApprovedMicroTasks,
  //             task_type: task.taskType?.task_type,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //           });
  //         }
  //       } else {
  //         const totalDoneCount = Math.min(
  //           task.totalRejectedMicroTasks +
  //             task.totalPendingMicroTasks +
  //             task.totalApprovedMicroTasks,
  //           contributorAssignedTask.total_micro_tasks,
  //         );
  //         if (task.totalRejectedMicroTasks > 0) {
  //           contributorRecentTasks.push({
  //             ...task,
  //             status:
  //               task.totalRejectedMicroTasks > 0 ? 'REJECTED' : 'UNDER_REVIEW',
  //             done_count: totalDoneCount,
  //             total_count: contributorAssignedTask.total_micro_tasks,
  //             dead_line: contributorAssignedTask.dead_line,
  //             rejected_count: task.totalRejectedMicroTasks,
  //             pending_count: task.totalPendingMicroTasks,
  //             approved_count: task.totalApprovedMicroTasks,
  //             task_type: task.taskType.task_type,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //           });
  //         } else {
  //           // If the assignment is new or inprogress
  //           // if new
  //           if (
  //             contributorAssignedTask.status ==
  //             ContributorMicroTasksConstantStatus.IN_PROGRESS
  //           ) {
  //             const done_count = contributorAssignedTask.current_batch;
  //             const total_count = contributorAssignedTask.micro_task_ids.length;
  //             const dead_line = contributorAssignedTask.dead_line;
  //             const rejected_count = task.totalRejectedMicroTasks;
  //             const pending_count = task.totalPendingMicroTasks;
  //             const approved_count = task.totalApprovedMicroTasks;

  //             contributorRecentTasks.push({
  //               ...task,
  //               status: 'UNDER_REVIEW',
  //               done_count,
  //               total_count,
  //               dead_line,
  //               rejected_count,
  //               pending_count,
  //               approved_count,
  //               task_type: task.taskType.task_type,
  //               average_time: task.taskRequirement.appriximate_time_per_batch,
  //             });
  //           }
  //           const totalDone =
  //             task.totalApprovedMicroTasks +
  //             task.totalPendingMicroTasks +
  //             task.totalRejectedMicroTasks +
  //             task.totalApprovedTestMicroTasks +
  //             task.totalPendingTestMicroTasks +
  //             task.totalRejectedTestMicroTasks;
  //           // console.log("Task Name ",task.name + " Status ",contributorAssignedTask.status)
  //           // console.log("Member Status",memberStatus?.status)
  //           // console.log("Total Done ",totalDone)
  //           if (
  //             contributorAssignedTask.status ==
  //               ContributorMicroTasksConstantStatus.NEW &&
  //             totalDone > 0
  //           ) {
  //             const done_count = 0;
  //             const totalAssigned =
  //               contributorAssignedTask.micro_task_ids.length;
  //             const maxBatch = Math.min(
  //               contributorAssignedTask.batch,
  //               contributorAssignedTask.micro_task_ids.length,
  //             ); //contributorAssignedTask.batch
  //             const total_count = contributorAssignedTask.micro_task_ids.slice(
  //               0,
  //               maxBatch,
  //             ).length;
  //             const dead_line = contributorAssignedTask.dead_line;
  //             const rejected_count = task.totalRejectedMicroTasks;
  //             const pending_count = task.totalPendingMicroTasks;
  //             const approved_count = task.totalApprovedMicroTasks;

  //             contributorRecentTasks.push({
  //               ...task,
  //               status: 'UNDER_REVIEW',
  //               done_count,
  //               total_count,
  //               dead_line,
  //               rejected_count,
  //               pending_count,
  //               approved_count,
  //               task_type: task.taskType.task_type,
  //               average_time: task.taskRequirement.appriximate_time_per_batch,
  //             });
  //           }
  //         }
  //       }
  //     } else {
  //       if (memberStatus) {
  //         if (memberStatus.status == 'Active') {
  //           contributorRecentTasks.push({
  //             ...task,
  //             status: 'TEST_UNDER_REVIEW',
  //             done_count: task.totalApprovedTestMicroTasks,
  //             total_count: task.totalApprovedTestMicroTasks,
  //             // dead_line: '',
  //             rejected_count: 0,
  //             pending_count: 0,
  //             approved_count: task.totalApprovedTestMicroTasks,
  //             task_type: task.taskType.task_type,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //           });
  //         } else if (memberStatus.status == 'Rejected') {
  //           contributorRecentTasks.push({
  //             ...task,
  //             status: 'TEST_REJECTED',
  //             done_count:
  //               task.totalApprovedTestMicroTasks +
  //               task.totalPendingTestMicroTasks +
  //               task.totalRejectedTestMicroTasks,
  //             total_count:
  //               task.totalApprovedTestMicroTasks +
  //               task.totalPendingTestMicroTasks +
  //               task.totalRejectedTestMicroTasks,
  //             // dead_line: '',
  //             rejected_count: task.totalRejectedTestMicroTasks,
  //             pending_count: task.totalPendingTestMicroTasks,
  //             approved_count: task.totalApprovedTestMicroTasks,
  //             task_type: task.taskType?.task_type,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //           });
  //         } else if (memberStatus.status == 'Pending') {
  //           contributorRecentTasks.push({
  //             ...task,
  //             status:
  //               task.totalRejectedTestMicroTasks > 0
  //                 ? 'REJECTED'
  //                 : 'TEST_UNDER_REVIEW',
  //             done_count:
  //               task.totalApprovedTestMicroTasks +
  //               task.totalPendingTestMicroTasks +
  //               task.totalRejectedTestMicroTasks,
  //             total_count:
  //               task.totalApprovedTestMicroTasks +
  //               task.totalPendingTestMicroTasks +
  //               task.totalRejectedTestMicroTasks,
  //             rejected_count: task.totalRejectedTestMicroTasks,
  //             pending_count: task.totalPendingTestMicroTasks,
  //             approved_count: task.totalApprovedTestMicroTasks,
  //             task_type: task.taskType.task_type,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //           });
  //         }
  //       }
  //     }
  //   }
  //   const limit = paginateDto.limit || 10;
  //   const page = paginateDto.page || 1;
  //   // const take=
  //   const skip = (page - 1) * limit;
  //   const lastIndex = Math.min(skip + limit, contributorRecentTasks.length);
  //   const paginatedContributorTasks = contributorRecentTasks.slice(
  //     skip,
  //     lastIndex,
  //   );
  //   return {
  //     result: paginatedContributorTasks,
  //     total: contributorRecentTasks.length,
  //     totalPages: Math.ceil(contributorRecentTasks.length / limit),
  //     page: page,
  //     limit: limit,
  //   };
  // }

  /**
   * Retrieves micro-tasks for a specific contributor and task.
   *
   * Flow:
   * 1. Attempt to load contributor task micro-tasks from cache.
   * 2. If cached data exists, return immediately.
   * 3. Fetch task with all required relations.
   * 4. Validate task existence.
   * 5. Fetch contributor's task membership (`UserTask`).
   * 6. Route handling logic based on contributor task status:
   *    - `REJECTED` → handleRejected
   *    - `ACTIVE` → handleActive
   *    - `PENDING` → handlePending
   *    - Other / Inactive → handlePendingOrInActive
   * 7. Cache the computed response when micro-tasks exist.
   *
   * Caching:
   * - Read: `cacheService.getContributorTaskMicroTasks(taskId, userId)`
   * - Write: `cacheService.writeContributorTaskMicroTasks(userId, taskId, response)`
   *
   * @param {string} userId
   *  Unique identifier of the contributor.
   *
   * @param {string} taskId
   *  Unique identifier of the task.
   *
   * @returns {Promise<TaskMicroTasksResponse>}
   *  Object containing:
   *  - Task metadata
   *  - Contributor-specific micro-tasks
   *  - Assignment status and limits
   *
   * @throws {BadRequestException}
   *  Thrown when the task does not exist.
   */
  async getContributorTaskMicroTasks(
    userId: string,
    taskId: string,
  ): Promise<TaskMicroTasksResponse> {
    const cacheData = await this.cacheService.getContributorTaskMicroTasks(
      taskId,
      userId,
    );
    if (cacheData) {
      console.log('=== FROM CACHE ===');
      return cacheData;
    }
    const task = await this.taskService.findOne({
      where: { id: taskId },
      relations: {
        taskRequirement: true,
        taskType: true,
        microTasks: true,
        taskInstructions: true,
        payment: true,
      },
    });

    if (!task) throw new BadRequestException('Task not found');

    const userTask = await this.userTaskService.findOne({
      where: { user_id: userId, task_id: taskId },
    });
    if (!userTask) return this.handleNewUser(task, userId);
    let response: TaskMicroTasksResponse;
    switch (userTask.status) {
      case UserTaskStatus.REJECTED:
        response = await this.handleRejected(task, userId);
        break;
      case UserTaskStatus.ACTIVE:
        response = await this.handleActive(task, userId);
        break;
      case UserTaskStatus.PENDING:
        response = await this.handlePending(task, userId);
        break;
      default:
        response = await this.handlePendingOrInActive(task, userId);
        break;
    }
    if (response.contributorMicroTask.length > 0) {
      await this.cacheService.writeContributorTaskMicroTasks(
        userId,
        task.id,
        response,
      );
    }
    return response;
  }

  /**
   * Handles a contributor's rejected task micro-tasks.
   *
   * @param task - The task.
   * @param userId - Unique identifier of the contributor.
   *
   * @returns {Promise<TaskMicrotasksResponse>}
   *  Object containing:
   *  - Task metadata
   *  - Contributor-specific micro-tasks
   *  - Assignment status and limits
   *
   */
  private async handleRejected(
    task: Task,
    userId: string,
  ): Promise<TaskMicroTasksResponse> {
    // contributor submitted microtasks
    console.log(' ========== handleRejected ==========');
    const contributorSubmissions = await this.microTaskService.findAll({
      where: {
        task_id: task.id,
        dataSets: { contributor_id: userId },
      },
      relations: {
        dataSets: {
          rejectionReasons: { rejectionType: true },
        },
      },
    });
    let contributorMicroTasks: ContributorMicroTaskRto[] = [];
    for (const microTask of contributorSubmissions) {
      const status = getMicroTaskStatus(
        microTask,
        task.taskRequirement.max_retry_per_task,
      );
      contributorMicroTasks.push({
        ...microTask,
        acceptance_status: status.acceptanceStatus,
        current_retry: status.totalAttempts,
        allowed_retry: task.taskRequirement.max_retry_per_task,
        can_retry: status.canRetry,
        dataSet: status.dataSet
          ? ContributorDataSetRto.from(status.dataSet)
          : undefined,
      });
    }

    contributorMicroTasks = contributorMicroTasks
      .map((microTask) => {
        return ContributorMicroTaskRto.fromSelf(microTask);
      })
      .sort((a, b) => {
        if (a.can_retry === b.can_retry) return 0;
        return a.can_retry ? -1 : 1; // true first
      });
    return TaskMicroTasksResponse.from({
      ...task,
      has_passed: 'REJECTED',
      batch: 0,
      is_test: true,
      contributorMicroTask: contributorMicroTasks,
      taskInstruction:
        task.taskInstructions.length > 0
          ? TaskInstructionRto.from(task.taskInstructions[0])
          : undefined,
      minimum_seconds: task.taskRequirement.minimum_seconds,
      maximum_seconds: task.taskRequirement.maximum_seconds,
      minimum_characters_length: task.taskRequirement.minimum_characters_length,
      maximum_characters_length: task.taskRequirement.maximum_characters_length,
      estimated_earning:
        task.payment.contributor_credit_per_microtask *
        task.taskRequirement.max_micro_task_per_contributor,
      earning_per_task: task.payment.contributor_credit_per_microtask,
      average_time: task.taskRequirement.appriximate_time_per_batch,
      deadline: null,
    });
  }

  /**
   * Handles micro-task retrieval and batching logic for an ACTIVE contributor task.
   *
   * This method builds the contributor-facing micro-task list by:
   * - Resolving assigned contributor micro-task metadata
   * - Merging previously submitted micro-tasks with newly assigned ones
   * - Calculating retry eligibility and acceptance status per micro-task
   * - Applying batch limits and task requirements
   *
   * Behavior:
   * 1. Fetch contributor assignment metadata for the task.
   * 2. Fetch all contributor submissions for the task.
   * 3. If no contributor assignment exists:
   *    - Treat task as already approved
   *    - Return all submitted micro-tasks with retry metadata
   * 4. If assignment exists:
   *    - Determine current and next batch boundaries
   *    - Split micro-tasks into:
   *      - Previously completed micro-tasks
   *      - Newly assigned micro-tasks
   *    - Calculate retry status per micro-task
   *    - Merge, sort, and return contributor-visible micro-tasks
   *
   * Retry Logic:
   * - Retry eligibility is determined using:
   *   - `max_retry_per_task`
   *   - Contributor submission history
   * - Micro-tasks that can be retried are prioritized in ordering
   *
   * Batch Logic:
   * - `current_batch` represents already completed micro-tasks
   * - `batch` size controls how many new micro-tasks are unlocked
   * - Total batch size is capped by `total_micro_tasks`
   *
   * Sorting:
   * - Micro-tasks are sorted with retryable tasks first
   *
   * @param {Task} task
   *  Fully hydrated task entity including:
   *  - task requirements
   *  - instructions
   *  - payment
   *
   * @param {string} userId
   *  Unique identifier of the contributor.
   *
   * @returns {Promise<TaskMicroTasksResponse>}
   *  Response containing:
   *  - Contributor micro-tasks (completed + newly assigned)
   *  - Retry metadata per micro-task
   *  - Batch state and deadline
   *  - Task requirements and earning information
   */
  private async handleActive(
    task: Task,
    userId: string,
  ): Promise<TaskMicroTasksResponse> {
    console.log('=== handleActive ===');
    const contributorMicroTasksAssigned =
      await this.contributorMicroTaskService.findOne({
        where: { contributor_id: userId, task_id: task.id },
      });

    const contributorSubmissions: MicroTask[] =
      await this.microTaskService.findAll({
        where: {
          task_id: task.id,
          dataSets: {
            contributor_id: userId,
          },
        },
        relations: {
          dataSets: {
            rejectionReasons: { rejectionType: true },
          },
        },
      });
    if (!contributorMicroTasksAssigned) {
      const result: ContributorMicroTaskRto[] = [];
      for (const mt of contributorSubmissions) {
        const status = getMicroTaskStatus(
          mt,
          task.taskRequirement.max_retry_per_task,
        );
        result.push({
          ...mt,
          acceptance_status: status.acceptanceStatus,
          current_retry: status.totalAttempts,
          allowed_retry: task.taskRequirement.max_retry_per_task,
          can_retry: status.canRetry,
          dataSet: status.dataSet
            ? ContributorDataSetRto.from(status.dataSet)
            : undefined,
        });
      }
      return TaskMicroTasksResponse.from({
        ...task,
        has_passed: 'APPROVED',
        batch: 0,
        is_test: false,
        contributorMicroTask: result.sort((a, b) => {
          if (a.can_retry === b.can_retry) return 0;
          return a.can_retry ? -1 : 1; // true first
        }),
        taskInstruction:
          task.taskInstructions.length > 0
            ? TaskInstructionRto.from(task.taskInstructions[0])
            : undefined,
        minimum_seconds: task.taskRequirement.minimum_seconds,
        maximum_seconds: task.taskRequirement.maximum_seconds,
        minimum_characters_length:
          task.taskRequirement.minimum_characters_length,
        maximum_characters_length:
          task.taskRequirement.maximum_characters_length,
        estimated_earning:
          task.payment.contributor_credit_per_microtask *
          task.taskRequirement.max_micro_task_per_contributor,
        earning_per_task: task.payment.contributor_credit_per_microtask,
        average_time: task.taskRequirement.appriximate_time_per_batch,
        deadline: null,
      });
    }
    const nextBatch = Math.min(
      contributorMicroTasksAssigned.current_batch +
        contributorMicroTasksAssigned.batch,
      contributorMicroTasksAssigned.total_micro_tasks,
    );
    const current_batch = contributorMicroTasksAssigned.current_batch;
    const prevMicroTasksIds =
      contributorMicroTasksAssigned.micro_task_ids.slice(0, current_batch);
    const nextMicroTasksIds =
      contributorMicroTasksAssigned.micro_task_ids.slice(
        current_batch,
        nextBatch,
      );
    const prevDoneMicroTasks: any[] = contributorSubmissions.filter((mt) =>
      prevMicroTasksIds.includes(mt.id),
    );
    let nextAssignedMicroTasks: any[] = [];
    if (nextMicroTasksIds.length > 0) {
      nextAssignedMicroTasks = await this.microTaskService.findAll({
        where: {
          id: In(nextMicroTasksIds),
        },
      });
    }
    const result: ContributorMicroTaskRto[] = [];
    for (const microTask of prevDoneMicroTasks) {
      const status = checkIfMicroTasIskRejectedAndTotalAttempts(
        microTask,
        task.taskRequirement.max_retry_per_task,
      );
      result.push(
        ContributorMicroTaskRto.from(
          {
            ...microTask,
            dataSets: status.dataSet ? [status.dataSet] : undefined,
          },
          {
            acceptance_status: status.acceptanceStatus,
            current_retry: status.totalAttempts,
            allowed_retry: task.taskRequirement.max_retry_per_task,
            can_retry: status.canRetry,
          },
        ),
      );
    }
    // cons
    for (const microTask of nextAssignedMicroTasks) {
      result.push(
        ContributorMicroTaskRto.from(
          {
            ...microTask,
            dataSets: [],
          },
          {
            current_retry: 0,
            allowed_retry: task.taskRequirement.max_retry_per_task,
            acceptance_status: 'NOT_STARTED',
            can_retry: true,
          },
        ),
      );
    }

    return TaskMicroTasksResponse.from({
      ...task,
      has_passed: 'APPROVED',
      is_test: false,
      contributorMicroTask: result.sort((a, b) => {
        if (a.can_retry === b.can_retry) return 0;
        return a.can_retry ? -1 : 1; // true first
      }),
      batch: current_batch,
      taskInstruction:
        task.taskInstructions.length > 0
          ? TaskInstructionRto.from(task.taskInstructions[0])
          : undefined,
      minimum_seconds: task.taskRequirement.minimum_seconds,
      maximum_seconds: task.taskRequirement.maximum_seconds,
      minimum_characters_length: task.taskRequirement.minimum_characters_length,
      maximum_characters_length: task.taskRequirement.maximum_characters_length,
      estimated_earning:
        task.payment.contributor_credit_per_microtask *
        task.taskRequirement.max_micro_task_per_contributor,
      earning_per_task: task.payment.contributor_credit_per_microtask,
      average_time: task.taskRequirement.appriximate_time_per_batch,
      deadline: contributorMicroTasksAssigned.dead_line,
    });
  }

  /**
   * Handles micro-task retrieval for a contributor whose task membership
   * is in a PENDING state.
   *
   * This method resolves contributor-visible micro-tasks based on:
   * - Task visibility (public / private)
   * - Whether contributor testing is required
   * - Existing contributor submissions
   * - Assigned batch configuration (if applicable)
   *
   * Scenarios handled:
   *
   * 1. Task requires a contributor test (public or private):
   *    - Return all exam micro-tasks with this contributor's submission status
   *    - Keep the contributor pending while any exam submission is under review
   *    - Show unanswered exam items so the contributor can continue
   *
   * 2. Task does NOT require contributor test:
   *    - If contributor has an assignment:
   *      → Load current batch micro-tasks
   *      → Merge submitted and newly assigned micro-tasks
   *      → Calculate retry eligibility per micro-task
   *    - If no assignment:
   *      → Return empty micro-task list under review
   *
   * 3. Fallback:
   *    - Return empty contributor micro-task response under review
   *
   * Retry Logic:
   * - Retry eligibility is calculated using:
   *   - `max_retry_per_task`
   *   - Submission history
   *
   * Batch Logic:
   * - Current batch is derived from contributor assignment
   * - Only micro-tasks within the current batch window are exposed
   *
   * Sorting:
   * - Retryable micro-tasks are prioritized in the response
   *
   * @param {Task} task
   *  Fully hydrated task entity including:
   *  - task requirements
   *  - instructions
   *  - payment
   *
   * @param {string} userId
   *  Unique identifier of the contributor.
   *
   * @returns {Promise<TaskMicroTasksResponse>}
   *  Response containing:
   *  - Contributor micro-tasks
   *  - Test status and batch info
   *  - Retry metadata per micro-task
   *  - Task timing and earning information
   */
  private async handlePending(
    task: Task,
    userId: string,
  ): Promise<TaskMicroTasksResponse> {
    console.log(' ========== handlePending ==========');
    if (task.require_contributor_test) {
      const testMicroTasks = await this.microTaskService.findAllTestMicroTasks({
        where: { task_id: task.id },
        relations: {
          dataSets: { rejectionReasons: { rejectionType: true } },
        },
      });
      const contributorMicroTasks = testMicroTasks.map((microTask) => {
        const contributorDataSets = (microTask.dataSets ?? []).filter(
          (dataSet) => dataSet.contributor_id === userId,
        );
        const status = checkIfMicroTasIskRejectedAndTotalAttempts(
          { ...microTask, dataSets: contributorDataSets },
          task.taskRequirement.max_retry_per_task,
        );

        return ContributorMicroTaskRto.from(
          {
            ...microTask,
            dataSets: status.dataSet ? [status.dataSet] : [],
          },
          {
            current_retry: status.totalAttempts,
            allowed_retry: task.taskRequirement.max_retry_per_task,
            acceptance_status: status.acceptanceStatus,
            can_retry: status.canRetry,
          },
        );
      });
      const hasPendingExamReview = contributorMicroTasks.some(
        (microTask) => microTask.acceptance_status === 'PENDING',
      );

      return TaskMicroTasksResponse.from({
        ...task,
        has_passed: hasPendingExamReview ? 'UNDER_REVIEW' : 'PENDING',
        batch: 0,
        is_test: true,
        contributorMicroTask: contributorMicroTasks.sort((a, b) => {
          if (a.can_retry === b.can_retry) return 0;
          return a.can_retry ? -1 : 1; // true first
        }),
        taskInstruction:
          task.taskInstructions.length > 0
            ? task.taskInstructions[0]
            : undefined,
        minimum_seconds: task.taskRequirement.minimum_seconds,
        maximum_seconds: task.taskRequirement.maximum_seconds,
        minimum_characters_length:
          task.taskRequirement.minimum_characters_length,
        maximum_characters_length:
          task.taskRequirement.maximum_characters_length,
        estimated_earning:
          task.taskRequirement.max_micro_task_per_contributor *
          task.payment.contributor_credit_per_microtask,
        earning_per_task: task.payment.contributor_credit_per_microtask,
        average_time: task.taskRequirement.appriximate_time_per_batch,
        deadline: null,
      });
    } else {
      const contributorMicroTasksAssigned =
        await this.contributorMicroTaskService.findOne({
          where: {
            task_id: task.id,
            contributor_id: userId,
          },
        });
      if (contributorMicroTasksAssigned) {
        const nextBatch =
          contributorMicroTasksAssigned.current_batch +
            contributorMicroTasksAssigned.batch >
          contributorMicroTasksAssigned.total_micro_tasks
            ? contributorMicroTasksAssigned.total_micro_tasks -
              contributorMicroTasksAssigned.current_batch
            : contributorMicroTasksAssigned.current_batch +
              contributorMicroTasksAssigned.batch;
        const current_batch = contributorMicroTasksAssigned.current_batch;
        const nextMicroTasks =
          contributorMicroTasksAssigned.micro_task_ids.slice(
            current_batch,
            nextBatch,
          );
        const contributorSubmissions = await this.microTaskService.findAll({
          where: [
            { id: In(nextMicroTasks) },
            {
              task_id: task.id,
              dataSets: {
                contributor_id: userId,
              },
            },
          ],
          relations: {
            dataSets: { rejectionReasons: { rejectionType: true } },
          },
        });
        const result: ContributorMicroTaskRto[] = [];
        if (contributorSubmissions.length > 0) {
          for (const microTask of contributorSubmissions) {
            const status = checkIfMicroTasIskRejectedAndTotalAttempts(
              microTask,
              task.taskRequirement.max_retry_per_task,
            );
            result.push(
              ContributorMicroTaskRto.from(
                {
                  ...microTask,
                  dataSets: status.dataSet ? [status.dataSet] : undefined,
                },
                {
                  acceptance_status: status.acceptanceStatus,
                  current_retry: status.totalAttempts,
                  allowed_retry: task.taskRequirement.max_retry_per_task,
                  can_retry: status.canRetry,
                },
              ),
            );
          }
        }
        const newTasks: MicroTask[] = contributorSubmissions.filter(
          (microTask) => microTask.dataSets.length === 0,
        );

        for (const microTask of newTasks) {
          result.push(
            ContributorMicroTaskRto.from(
              {
                ...microTask,
                dataSets: [],
              },
              {
                current_retry: 0,
                allowed_retry: task.taskRequirement.max_retry_per_task,
                acceptance_status: 'NOT_STARTED',
                can_retry: true,
              },
            ),
          );
        }
        return TaskMicroTasksResponse.from({
          ...task,
          has_passed: 'APPROVED',
          is_test: false,
          contributorMicroTask: result.sort((a, b) => {
            if (a.can_retry === b.can_retry) return 0;
            return a.can_retry ? -1 : 1; // true first
          }),
          batch: current_batch,
          taskInstruction:
            task.taskInstructions.length > 0
              ? task.taskInstructions[0]
              : undefined,
          minimum_seconds: task.taskRequirement.minimum_seconds,
          maximum_seconds: task.taskRequirement.maximum_seconds,
          minimum_characters_length:
            task.taskRequirement.minimum_characters_length,
          maximum_characters_length:
            task.taskRequirement.maximum_characters_length,
          estimated_earning:
            task.taskRequirement.max_micro_task_per_contributor *
            task.payment.contributor_credit_per_microtask,
          earning_per_task: task.payment.contributor_credit_per_microtask,
          average_time: task.taskRequirement.appriximate_time_per_batch,
          deadline: null,
        });
      } else {
        return TaskMicroTasksResponse.from({
          ...task,
          has_passed: 'UNDER_REVIEW',
          batch: 0,
          is_test: false,
          contributorMicroTask: [],
          taskInstruction: undefined,
          minimum_seconds: task.taskRequirement.minimum_seconds,
          maximum_seconds: task.taskRequirement.maximum_seconds,
          minimum_characters_length:
            task.taskRequirement.minimum_characters_length,
          maximum_characters_length:
            task.taskRequirement.maximum_characters_length,
          estimated_earning:
            task.taskRequirement.max_micro_task_per_contributor *
            task.payment.contributor_credit_per_microtask,
          earning_per_task: task.payment.contributor_credit_per_microtask,
          average_time: task.taskRequirement.appriximate_time_per_batch,
          deadline: null,
        });
      }
    }
  }

  /**
   * Handles micro-task retrieval for a contributor who has no existing
   * `UserTask` record for the given task (new contributor).
   *
   * This method determines what micro-tasks a new contributor can see based on:
   * - Whether the task requires a contributor qualification test
   * - Whether the contributor has already submitted any micro-tasks
   * - Existing contributor micro-task assignment (if any)
   *
   * Scenarios handled:
   *
   * 1. Task does NOT require contributor test:
   *    - If contributor has no assignment:
   *      → Return empty contributor micro-task list (task already approved)
   *    - If contributor has an assignment:
   *      → Load previously completed micro-tasks
   *      → Load the next batch of assigned micro-tasks
   *      → Merge completed and newly assigned micro-tasks
   *
   * 2. Task requires contributor test:
   *    - If contributor has already submitted test micro-tasks:
   *      → Return submitted test micro-tasks under review
   *    - If contributor has not taken the test:
   *      → Return all test micro-tasks in NOT_STARTED state
   *
   * Retry Logic:
   * - Retry eligibility is calculated using:
   *   - `max_retry_per_task`
   *   - Submission history per micro-task
   *
   * Batch Logic (non-test tasks):
   * - Previously completed micro-tasks are derived from `current_batch`
   * - New micro-tasks are derived from `batch` size
   * - Batch boundaries are capped by total assigned micro-tasks
   *
   * Sorting:
   * - Micro-tasks are sorted with retryable tasks first
   *
   * @param {Task} task
   *  Fully hydrated task entity including:
   *  - task requirements
   *  - instructions
   *  - payment
   *
   * @param {string} userId
   *  Unique identifier of the contributor.
   *
   * @returns {Promise<TaskMicroTasksResponse>}
   *  Response containing:
   *  - Contributor micro-tasks
   *  - Test state and batch information
   *  - Retry metadata per micro-task
   *  - Task timing and earning information
   */
  private async handleNewUser(
    task: Task,
    userId: string,
  ): Promise<TaskMicroTasksResponse> {
    console.log(' ========== handleNewUser ==========');
    // return all the test micro tasks
    if (!task.require_contributor_test) {
      const contributorMicroTasksAssigned =
        await this.contributorMicroTaskService.findOne({
          where: {
            task_id: task.id,
            contributor_id: userId,
          },
        });
      if (!contributorMicroTasksAssigned) {
        return TaskMicroTasksResponse.from({
          ...task,
          has_passed: 'APPROVED',
          batch: 0,
          is_test: false,
          contributorMicroTask: [],
          taskInstruction:
            task.taskInstructions.length > 0
              ? task.taskInstructions[0]
              : undefined,
          minimum_seconds: task.taskRequirement.minimum_seconds,
          maximum_seconds: task.taskRequirement.maximum_seconds,
          minimum_characters_length:
            task.taskRequirement.minimum_characters_length,
          maximum_characters_length:
            task.taskRequirement.maximum_characters_length,
          estimated_earning:
            task.taskRequirement.max_micro_task_per_contributor *
            task.payment.contributor_credit_per_microtask,
          earning_per_task: task.payment.contributor_credit_per_microtask,
          average_time: task.taskRequirement.appriximate_time_per_batch,
          deadline: null,
        });
      }
      const prevDoneMicroTaskIds =
        contributorMicroTasksAssigned.micro_task_ids.slice(
          0,
          contributorMicroTasksAssigned.current_batch,
        );
      const prevSubmissions = await this.microTaskService.findAll({
        where: {
          task_id: task.id,
          dataSets: {
            contributor_id: userId,
            micro_task_id: In(prevDoneMicroTaskIds),
          },
        },
        relations: {
          dataSets: { rejectionReasons: { rejectionType: true } },
        },
      });
      const batch = contributorMicroTasksAssigned.batch;
      const currentBatch = contributorMicroTasksAssigned.current_batch;
      const newMicroTaskIds =
        contributorMicroTasksAssigned.micro_task_ids.slice(
          currentBatch,
          currentBatch + batch,
        );

      const contributorTasks: ContributorMicroTaskRto[] = [];
      const newMicroTasks = await this.microTaskService.findAll({
        where: {
          id: In(newMicroTaskIds),
        },
      });
      // Add the new microtasks
      for (const newM of newMicroTasks) {
        contributorTasks.push(
          ContributorMicroTaskRto.from(newM, {
            current_retry: 0,
            allowed_retry: task.taskRequirement.max_retry_per_task,
            acceptance_status: 'NOT_STARTED',
            can_retry: false,
          }),
        );
      }

      for (const prevM of prevSubmissions) {
        const status = checkIfMicroTasIskRejectedAndTotalAttempts(
          prevM,
          task.taskRequirement.max_retry_per_task,
        );
        contributorTasks.push(
          ContributorMicroTaskRto.from(
            {
              ...prevM,
              dataSets: status.dataSet ? [status.dataSet] : undefined,
            },
            {
              acceptance_status: status.acceptanceStatus,
              current_retry: status.totalAttempts,
              allowed_retry: task.taskRequirement.max_retry_per_task,
              can_retry: status.canRetry,
            },
          ),
        );
      }

      return TaskMicroTasksResponse.from({
        ...task,
        contributorMicroTask: contributorTasks.sort((a, b) => {
          if (a.can_retry === b.can_retry) return 0;
          return a.can_retry ? -1 : 1; // true first
        }),
        has_passed: 'APPROVED',
        is_test: false,
        batch: 0,
        taskInstruction:
          task.taskInstructions.length > 0
            ? task.taskInstructions[0]
            : undefined,
        minimum_seconds: task.taskRequirement.minimum_seconds,
        maximum_seconds: task.taskRequirement.maximum_seconds,
        minimum_characters_length:
          task.taskRequirement.minimum_characters_length,
        maximum_characters_length:
          task.taskRequirement.maximum_characters_length,
        estimated_earning:
          task.taskRequirement.max_micro_task_per_contributor *
          task.payment.contributor_credit_per_microtask,
        earning_per_task: task.payment.contributor_credit_per_microtask,
        average_time: task.taskRequirement.appriximate_time_per_batch,
        deadline: contributorMicroTasksAssigned.dead_line,
      });
    } else {
      const contributorSubmissions = await this.microTaskService.findAll({
        where: {
          task_id: task.id,
          dataSets: {
            contributor_id: userId,
          },
        },
        relations: {
          dataSets: { rejectionReasons: { rejectionType: true } },
        },
      });
      const hasTakenTest = contributorSubmissions.length > 0;

      if (hasTakenTest && contributorSubmissions) {
        const contributorMicroTasks: ContributorMicroTaskRto[] = [];
        for (const microTask of contributorSubmissions) {
          const status = checkIfMicroTasIskRejectedAndTotalAttempts(
            microTask,
            task.taskRequirement.max_retry_per_task,
          );
          contributorMicroTasks.push(
            ContributorMicroTaskRto.from(microTask, {
              current_retry: status.totalAttempts,
              allowed_retry: task.taskRequirement.max_retry_per_task,
              acceptance_status: status.acceptanceStatus,
              can_retry: status.canRetry,
            }),
          );
        }
        return TaskMicroTasksResponse.from({
          has_passed: 'UNDER_REVIEW',
          batch: 0,
          is_test: true,
          ...task,
          contributorMicroTask: contributorMicroTasks.sort((a, b) => {
            if (a.can_retry === b.can_retry) return 0;
            return a.can_retry ? -1 : 1; // true first
          }),
          taskInstruction:
            task.taskInstructions.length > 0
              ? task.taskInstructions[0]
              : undefined,
          minimum_seconds: task.taskRequirement.minimum_seconds,
          maximum_seconds: task.taskRequirement.maximum_seconds,
          minimum_characters_length:
            task.taskRequirement.minimum_characters_length,
          maximum_characters_length:
            task.taskRequirement.maximum_characters_length,
          estimated_earning:
            task.payment.contributor_credit_per_microtask *
            task.taskRequirement.max_micro_task_per_contributor,
          earning_per_task: task.payment.contributor_credit_per_microtask,
          average_time: task.taskRequirement.appriximate_time_per_batch,
          deadline: null,
        });
      } else {
        const testMicroTasks =
          await this.microTaskService.findAllTestMicroTasks({
            where: { task_id: task.id },
          });
        return TaskMicroTasksResponse.from({
          has_passed: 'PENDING',
          batch: 0,
          is_test: true,
          ...task,
          contributorMicroTask: testMicroTasks.map((microTask) => {
            return ContributorMicroTaskRto.from(microTask, {
              current_retry: 0,
              allowed_retry: task.taskRequirement.max_retry_per_task,
              acceptance_status: 'NOT_STARTED',
              can_retry: false,
            });
          }),
          taskInstruction:
            task.taskInstructions.length > 0
              ? task.taskInstructions[0]
              : undefined,
          minimum_seconds: task.taskRequirement.minimum_seconds,
          maximum_seconds: task.taskRequirement.maximum_seconds,
          minimum_characters_length:
            task.taskRequirement.minimum_characters_length,
          maximum_characters_length:
            task.taskRequirement.maximum_characters_length,
          estimated_earning:
            task.taskRequirement.max_micro_task_per_contributor *
            task.payment.contributor_credit_per_microtask,
          earning_per_task: task.payment.contributor_credit_per_microtask,
          average_time: task.taskRequirement.appriximate_time_per_batch,
          deadline: null,
        });
      }
    }
  }

  /**
   * Handles micro-task retrieval for contributors whose task membership
   * is in a PENDING or INACTIVE (flagged) state.
   *
   * This method represents a restricted access state where the contributor
   * is not allowed to interact with any micro-tasks for the task.
   *
   * Behavior:
   * - No micro-tasks are returned
   * - Task is marked as FLAGGED
   * - No batching or test logic is applied
   * - Task metadata and earning information are still provided
   *
   * Typical use cases:
   * - Contributor has been flagged
   * - Contributor task access is temporarily suspended
   * - Task membership is inactive or unresolved
   *
   * @param {Task} task
   *  Fully hydrated task entity including:
   *  - task requirements
   *  - instructions
   *  - payment
   *
   * @param {string} userId
   *  Unique identifier of the contributor.
   *
   * @returns {Promise<TaskMicroTasksResponse>}
   *  Response indicating restricted access with no available micro-tasks.
   */
  private async handlePendingOrInActive(
    task: Task,
    userId: string,
  ): Promise<TaskMicroTasksResponse> {
    console.log(' ========== handlePendingOrInActive ==========');
    return TaskMicroTasksResponse.from({
      ...task,
      has_passed: 'FLAGGED',
      batch: 0,
      is_test: false,
      contributorMicroTask: [],
      taskInstruction:
        task.taskInstructions.length > 0 ? task.taskInstructions[0] : undefined,
      minimum_seconds: task.taskRequirement.minimum_seconds,
      maximum_seconds: task.taskRequirement.maximum_seconds,
      minimum_characters_length: task.taskRequirement.minimum_characters_length,
      maximum_characters_length: task.taskRequirement.maximum_characters_length,
      estimated_earning:
        task.taskRequirement.max_micro_task_per_contributor *
        task.payment.contributor_credit_per_microtask,
      earning_per_task: task.payment.contributor_credit_per_microtask,
      average_time: task.taskRequirement.appriximate_time_per_batch,
      deadline: null,
    });
  }

  /**
   * Retrieves and sanitizes all submissions made by a contributor
   * for a specific micro-task.
   *
   * This method:
   * - Fetches the micro-task along with contributor-specific data sets
   * - Includes rejection reasons and their types
   * - Converts raw DataSet entities into a sanitized response format
   *
   * If no submissions exist or the micro-task is not found,
   * an empty array is returned.
   *
   * @param {string} microTaskId
   *  Unique identifier of the micro-task.
   *
   * @param {string} contributorId
   *  Unique identifier of the contributor.
   *
   * @returns {Promise<DataSetSanitize[]>}
   *  List of sanitized contributor submissions, including:
   *  - Submission metadata
   *  - Rejection reasons (if any)
   */
  async getContributorMicroTaskSubmissions(
    microTaskId: string,
    contributorId: string,
  ): Promise<DataSetSanitize[]> {
    const microTask = await this.microTaskService.findOne({
      where: {
        id: microTaskId,
        dataSets: { contributor_id: contributorId },
      },
      relations: {
        dataSets: {
          rejectionReasons: { rejectionType: true },
        },
      },
    });
    const dataSetsSanitized: DataSetSanitize[] = microTask?.dataSets
      ? microTask.dataSets.map((dataSet) => {
          return DataSetSanitize.from(dataSet);
        })
      : [];
    return dataSetsSanitized;
  }

  // async getUserAssignedNewTasks(
  //   user_id: string,
  //   paginateDto: PaginationDto,
  // ): Promise<PaginatedResult<TaskStatus>> {
  //   const user = await this.userService.findOne({ where: { id: user_id } });
  //   if (!user) throw new NotFoundException(`User with id ${user_id} not found`);
  //   // Step 1: Get matching public task IDs
  //   const matchedTasks = await this.taskService.findMatchingTasks({
  //     dialect_id: user.dialect_id,
  //     language_id: user.language_id,
  //     birth_date: user.birth_date,
  //     gender: user.gender,
  //   });

  //   // Step 2: Get pending non started task Ids
  //   const memberTasksWithOutContribution = await this.userTaskService.findAll({
  //     where: {
  //       user_id: user_id,
  //       has_done_task: false,
  //       task: {
  //         is_closed: false,
  //         distribution_started: true,
  //       },
  //     },
  //     relations: { task: true },
  //   });
  //   const memberTasksWithOutContributionIds =
  //     memberTasksWithOutContribution.map((task) => task.task_id);

  //   // Step 3: Get assigned task IDs and done tasks
  //   const assignedTasksIds = await this.contributorMicroTaskService.findAll({
  //     where: {
  //       contributor_id: user_id,
  //       // status: ContributorMicroTasksConstantStatus.NEW,
  //     },
  //   });
  //   //
  //   let newAssignedTaskIds = assignedTasksIds
  //     .filter((task) => task.status === ContributorMicroTasksConstantStatus.NEW)
  //     .map((task) => task.task_id);

  //   const testRequireMatchingTaskIds = matchedTasks
  //     .filter((task) => task.task.require_contributor_test)
  //     .map((task) => task.task.id);

  //   const testRequiredUnAssignedMatchingTaskIds =
  //     testRequireMatchingTaskIds.filter(
  //       (id) => !newAssignedTaskIds.includes(id),
  //     );
  //   const filteredTaskIds = [
  //     ...newAssignedTaskIds,
  //     ...memberTasksWithOutContributionIds,
  //     ...testRequiredUnAssignedMatchingTaskIds,
  //   ];
  //   // Step 4: Fetch paginated tasks with relations
  //   const paginatedTasks = await this.taskService.getTasksWithoutContributor(
  //     filteredTaskIds,
  //     user_id,
  //     paginateDto.page || 1,
  //     paginateDto.limit || 10,
  //   );

  //   // Step 5: Enhance tasks with progress info
  //   const tasksWithStatus: TaskStatus[] = (
  //     await Promise.all(
  //       paginatedTasks.result.map(async (task) => {
  //         const contributorTask = assignedTasksIds.find(
  //           (contributorTask) => contributorTask.task_id === task.id,
  //         );
  //         if (!contributorTask) {
  //           if (task.require_contributor_test) {
  //             const total_count = await this.microTaskService.count({
  //               where: { task_id: task.id, is_test: true },
  //             });
  //             return {
  //               ...task,
  //               done_count: 0,
  //               total_count,
  //               task_type: task.taskType.task_type,
  //               average_time: task.taskRequirement.appriximate_time_per_batch,
  //               taskInstruction:
  //                 task.taskInstructions.length > 0
  //                   ? task.taskInstructions[0].content
  //                   : '',
  //             };
  //           } else {
  //             return;
  //           }
  //         } else {
  //           const done_count = 0;
  //           const total_count = Math.min(
  //             contributorTask.micro_task_ids.length,
  //             contributorTask.batch,
  //           );
  //           const dead_line = contributorTask.dead_line;

  //           return {
  //             ...task,
  //             task_type: task.taskType.task_type,
  //             taskInstruction:
  //               task.taskInstructions.length > 0
  //                 ? task.taskInstructions[0].content
  //                 : '',
  //             done_count,
  //             total_count,
  //             dead_line,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //           };
  //         }
  //       }),
  //     )
  //   ).filter((task) => task !== undefined);

  //   // Step 6: Return structured response
  //   return {
  //     result: tasksWithStatus,
  //     total: paginatedTasks.total,
  //     totalPages: paginatedTasks.totalPages,
  //     page: paginatedTasks.page,
  //     limit: paginatedTasks.limit,
  //   };
  // }
  // async getUserAssignedTaskMicroTasks(
  //   user_id: string,
  //   task_id: string,
  // ): Promise<TaskMicroTasksResponse> {
  //   let task = await this.taskService.findOne({
  //     where: {
  //       id: task_id,
  //     },
  //     relations: {
  //       taskRequirement: true,
  //       taskType: true,
  //       microTasks: true,
  //       taskInstructions: true,
  //       payment: true,
  //     },
  //   });
  //   if (!task) {
  //     throw new BadRequestException('Task not found');
  //   }
  //   // if (task.require_contributor_test) {
  //   let userTask: UserTask | null = await this.userTaskService.findOne({
  //     where: { user_id: user_id, task_id: task_id },
  //   });

  //   if (userTask != null) {
  //     if (userTask.status == UserTaskStatus.REJECTED) {
  //       let contributorTask = await this.taskService.findOne({
  //         where: {
  //           id: task_id,
  //           microTasks: {
  //             dataSets: {
  //               contributor_id: user_id,
  //             },
  //           },
  //         },
  //         relations: {
  //           microTasks: {
  //             dataSets: {
  //               rejectionReasons: { rejectionType: true },
  //             },
  //           },
  //         },
  //       });
  //       if (!contributorTask) {
  //         throw new BadRequestException('Task not found');
  //       }
  //       const microTasks = contributorTask.microTasks;
  //       let contributorMicroTasks: ContributorMicroTaskRto[] = [];
  //       for (const microTask of microTasks) {
  //         const status = getMicroTaskStatus(
  //           microTask,
  //           task.taskRequirement.max_retry_per_task,
  //         );
  //         contributorMicroTasks.push({
  //           ...microTask,
  //           acceptance_status: status.acceptanceStatus,
  //           current_retry: status.totalAttempts,
  //           allowed_retry: task.taskRequirement.max_retry_per_task,
  //           can_retry: status.canRetry,
  //           dataSet: status.dataSet
  //             ? ContributorDataSetRto.from(status.dataSet)
  //             : undefined,
  //         });
  //       }

  //       contributorMicroTasks = contributorMicroTasks
  //         .map((microTask) => {
  //           return ContributorMicroTaskRto.fromSelf(microTask);
  //         })
  //         .sort((a, b) => {
  //           if (a.can_retry === b.can_retry) return 0;
  //           return a.can_retry ? -1 : 1; // true first
  //         });
  //       return TaskMicroTasksResponse.from({
  //         ...task,
  //         has_passed: 'REJECTED',
  //         batch: 0,
  //         is_test: true,
  //         contributorMicroTask: contributorMicroTasks,
  //         taskInstruction:
  //           task.taskInstructions.length > 0
  //             ? TaskInstructionRto.from(task.taskInstructions[0])
  //             : undefined,
  //         minimum_seconds: task.taskRequirement.minimum_seconds,
  //         maximum_seconds: task.taskRequirement.maximum_seconds,
  //         minimum_characters_length:
  //           task.taskRequirement.minimum_characters_length,
  //         maximum_characters_length:
  //           task.taskRequirement.maximum_characters_length,
  //         estimated_earning:
  //           task.payment.contributor_credit_per_microtask *
  //           task.taskRequirement.max_micro_task_per_contributor,
  //         earning_per_task: task.payment.contributor_credit_per_microtask,
  //         average_time: task.taskRequirement.appriximate_time_per_batch,
  //         deadline: null,
  //       });
  //     } else if (userTask.status == UserTaskStatus.ACTIVE) {
  //       const contributorMicroTasksAssigned =
  //         await this.contributorMicroTaskService.findOne({
  //           where: { contributor_id: user_id, task_id: task_id },
  //         });
  //       if (!contributorMicroTasksAssigned) {
  //         let microTasksDone: MicroTask[] = await this.microTaskService.findAll(
  //           {
  //             where: {
  //               task_id: task_id,
  //               dataSets: {
  //                 contributor_id: user_id,
  //               },
  //             },
  //             relations: {
  //               dataSets: {
  //                 rejectionReasons: { rejectionType: true },
  //               },
  //             },
  //           },
  //         );
  //         let result: ContributorMicroTaskRto[] = [];
  //         for (const mt of microTasksDone) {
  //           const status = getMicroTaskStatus(
  //             mt,
  //             task.taskRequirement.max_retry_per_task,
  //           );
  //           result.push({
  //             ...mt,
  //             acceptance_status: status.acceptanceStatus,
  //             current_retry: status.totalAttempts,
  //             allowed_retry: task.taskRequirement.max_retry_per_task,
  //             can_retry: status.canRetry,
  //             dataSet: status.dataSet
  //               ? ContributorDataSetRto.from(status.dataSet)
  //               : undefined,
  //           });
  //         }
  //         return TaskMicroTasksResponse.from({
  //           ...task,
  //           has_passed: 'APPROVED',
  //           batch: 0,
  //           is_test: false,
  //           contributorMicroTask: result.sort((a, b) => {
  //             if (a.can_retry === b.can_retry) return 0;
  //             return a.can_retry ? -1 : 1; // true first
  //           }),
  //           taskInstruction:
  //             task.taskInstructions.length > 0
  //               ? TaskInstructionRto.from(task.taskInstructions[0])
  //               : undefined,
  //           minimum_seconds: task.taskRequirement.minimum_seconds,
  //           maximum_seconds: task.taskRequirement.maximum_seconds,
  //           minimum_characters_length:
  //             task.taskRequirement.minimum_characters_length,
  //           maximum_characters_length:
  //             task.taskRequirement.maximum_characters_length,
  //           estimated_earning:
  //             task.payment.contributor_credit_per_microtask *
  //             task.taskRequirement.max_micro_task_per_contributor,
  //           earning_per_task: task.payment.contributor_credit_per_microtask,
  //           average_time: task.taskRequirement.appriximate_time_per_batch,
  //           deadline: null,
  //         });
  //       }
  //       let nextBatch = Math.min(
  //         contributorMicroTasksAssigned.current_batch +
  //           contributorMicroTasksAssigned.batch,
  //         contributorMicroTasksAssigned.total_micro_tasks,
  //       );
  //       let current_batch = contributorMicroTasksAssigned.current_batch;
  //       let prevMicroTasksIds =
  //         contributorMicroTasksAssigned.micro_task_ids.slice(0, current_batch);
  //       let nextMicroTasksIds =
  //         contributorMicroTasksAssigned.micro_task_ids.slice(
  //           current_batch,
  //           nextBatch,
  //         );
  //       let prevDoneMicroTasks: any[] = [];
  //       let nextAssignedMicroTasks: any[] = [];
  //       if (prevMicroTasksIds.length > 0) {
  //         prevDoneMicroTasks = await this.microTaskService.findAll({
  //           where: {
  //             id: In(prevMicroTasksIds),
  //             dataSets: {
  //               contributor_id: user_id,
  //             },
  //           },
  //           relations: {
  //             dataSets: {
  //               rejectionReasons: { rejectionType: true },
  //               flagReason: true,
  //             },
  //           },
  //         });
  //       }
  //       if (nextMicroTasksIds.length > 0) {
  //         nextAssignedMicroTasks = await this.microTaskService.findAll({
  //           where: {
  //             id: In(nextMicroTasksIds),
  //           },
  //         });
  //       }
  //       let result: ContributorMicroTaskRto[] = [];
  //       for (const microTask of prevDoneMicroTasks) {
  //         const status = checkIfMicroTasIskRejectedAndTotalAttempts(
  //           microTask,
  //           task.taskRequirement.max_retry_per_task,
  //         );
  //         result.push(
  //           ContributorMicroTaskRto.from(
  //             {
  //               ...microTask,
  //               dataSets: status.dataSet
  //                 ? [ContributorDataSetRto.from(status.dataSet)]
  //                 : undefined,
  //             },
  //             {
  //               acceptance_status: status.acceptanceStatus,
  //               current_retry: status.totalAttempts,
  //               allowed_retry: task.taskRequirement.max_retry_per_task,
  //               can_retry: status.canRetry,
  //             },
  //           ),
  //         );
  //       }
  //       // cons
  //       for (const microTask of nextAssignedMicroTasks) {
  //         result.push(
  //           ContributorMicroTaskRto.from(
  //             {
  //               ...microTask,
  //               dataSets: [],
  //             },
  //             {
  //               current_retry: 0,
  //               allowed_retry: task.taskRequirement.max_retry_per_task,
  //               acceptance_status: 'NOT_STARTED',
  //               can_retry: true,
  //             },
  //           ),
  //         );
  //       }

  //       return TaskMicroTasksResponse.from({
  //         ...task,
  //         has_passed: 'APPROVED',
  //         is_test: false,
  //         contributorMicroTask: result.sort((a, b) => {
  //           if (a.can_retry === b.can_retry) return 0;
  //           return a.can_retry ? -1 : 1; // true first
  //         }),
  //         batch: current_batch,
  //         taskInstruction:
  //           task.taskInstructions.length > 0
  //             ? TaskInstructionRto.from(task.taskInstructions[0])
  //             : undefined,
  //         minimum_seconds: task.taskRequirement.minimum_seconds,
  //         maximum_seconds: task.taskRequirement.maximum_seconds,
  //         minimum_characters_length:
  //           task.taskRequirement.minimum_characters_length,
  //         maximum_characters_length:
  //           task.taskRequirement.maximum_characters_length,
  //         estimated_earning:
  //           task.payment.contributor_credit_per_microtask *
  //           task.taskRequirement.max_micro_task_per_contributor,
  //         earning_per_task: task.payment.contributor_credit_per_microtask,
  //         average_time: task.taskRequirement.appriximate_time_per_batch,
  //         deadline: contributorMicroTasksAssigned.dead_line,
  //       });
  //     } else if (userTask.status == UserTaskStatus.PENDING) {
  //       if (!task.is_public && task.require_contributor_test) {
  //         const contributorSubmittedMicroTasks =
  //           await this.microTaskService.findAll({
  //             where: {
  //               task_id: task_id,
  //               dataSets: {
  //                 contributor_id: user_id,
  //               },
  //             },
  //             relations: {
  //               dataSets: { rejectionReasons: { rejectionType: true } },
  //             },
  //           });
  //         if (contributorSubmittedMicroTasks.length > 0) {
  //           let contributorMicroTasks: ContributorMicroTaskRto[] = [];
  //           for (const microTask of contributorSubmittedMicroTasks) {
  //             const status = getMicroTaskStatus(
  //               microTask,
  //               task.taskRequirement.max_retry_per_task,
  //             );
  //             contributorMicroTasks.push(
  //               ContributorMicroTaskRto.from(
  //                 {
  //                   ...microTask,
  //                   dataSets: status.dataSet
  //                     ? [ContributorDataSetRto.from(status.dataSet)]
  //                     : [],
  //                 },
  //                 {
  //                   current_retry: status.totalAttempts,
  //                   allowed_retry: task.taskRequirement.max_retry_per_task,
  //                   acceptance_status: status.acceptanceStatus,
  //                   can_retry: status.canRetry,
  //                 },
  //               ),
  //             );
  //           }
  //           return TaskMicroTasksResponse.from({
  //             ...task,
  //             has_passed: 'UNDER_REVIEW',
  //             batch: 0,
  //             is_test: true,
  //             contributorMicroTask: contributorMicroTasks.sort((a, b) => {
  //               if (a.can_retry === b.can_retry) return 0;
  //               return a.can_retry ? -1 : 1; // true first
  //             }),
  //             taskInstruction:
  //               task.taskInstructions.length > 0
  //                 ? task.taskInstructions[0]
  //                 : undefined,
  //             minimum_seconds: task.taskRequirement.minimum_seconds,
  //             maximum_seconds: task.taskRequirement.maximum_seconds,
  //             minimum_characters_length:
  //               task.taskRequirement.minimum_characters_length,
  //             maximum_characters_length:
  //               task.taskRequirement.maximum_characters_length,
  //             estimated_earning:
  //               task.taskRequirement.max_micro_task_per_contributor *
  //               task.payment.contributor_credit_per_microtask,
  //             earning_per_task: task.payment.contributor_credit_per_microtask,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //             deadline: null,
  //           });
  //         } else {
  //           const testMicroTasks = await this.microTaskService.findAll({
  //             where: {
  //               is_test: true,
  //               task_id: task_id,
  //             },
  //             relations: {
  //               dataSets: true,
  //             },
  //           });
  //           return TaskMicroTasksResponse.from({
  //             ...task,
  //             has_passed: 'PENDING',
  //             batch: 0,
  //             is_test: true,
  //             contributorMicroTask: testMicroTasks.map((microTask) => {
  //               return ContributorMicroTaskRto.from(microTask, {
  //                 current_retry: 0,
  //                 allowed_retry: 1,
  //                 acceptance_status: 'NOT_STARTED',
  //                 can_retry: false,
  //               });
  //             }),
  //             taskInstruction:
  //               task.taskInstructions.length > 0
  //                 ? task.taskInstructions[0]
  //                 : undefined,
  //             minimum_seconds: task.taskRequirement.minimum_seconds,
  //             maximum_seconds: task.taskRequirement.maximum_seconds,
  //             minimum_characters_length:
  //               task.taskRequirement.minimum_characters_length,
  //             maximum_characters_length:
  //               task.taskRequirement.maximum_characters_length,
  //             estimated_earning:
  //               task.taskRequirement.max_micro_task_per_contributor *
  //               task.payment.contributor_credit_per_microtask,
  //             earning_per_task: task.payment.contributor_credit_per_microtask,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //             deadline: null,
  //           });
  //         }
  //       } else if (task.is_public && task.require_contributor_test) {
  //         let microTasksDone: MicroTask[] = await this.microTaskService.findAll(
  //           {
  //             where: {
  //               task_id: task_id,
  //               dataSets: {
  //                 contributor_id: user_id,
  //               },
  //             },
  //             relations: {
  //               dataSets: { rejectionReasons: { rejectionType: true } },
  //             },
  //           },
  //         );
  //         let result: ContributorMicroTaskRto[] = [];
  //         for (const mt of microTasksDone) {
  //           const status = getMicroTaskStatus(
  //             mt,
  //             task.taskRequirement.max_retry_per_task,
  //           );
  //           result.push({
  //             ...mt,
  //             acceptance_status: status.acceptanceStatus,
  //             current_retry: status.totalAttempts,
  //             allowed_retry: task.taskRequirement.max_retry_per_task,
  //             can_retry: status.canRetry,
  //             dataSet: status.dataSet
  //               ? ContributorDataSetRto.from(status.dataSet)
  //               : undefined,
  //           });
  //         }
  //         return TaskMicroTasksResponse.from({
  //           ...task,
  //           has_passed: 'UNDER_REVIEW',
  //           batch: 0,
  //           is_test: false,
  //           contributorMicroTask: result.sort((a, b) => {
  //             if (a.can_retry === b.can_retry) return 0;
  //             return a.can_retry ? -1 : 1; // true first
  //           }),
  //           taskInstruction:
  //             task.taskInstructions.length > 0
  //               ? task.taskInstructions[0]
  //               : undefined,
  //           minimum_seconds: task.taskRequirement.minimum_seconds,
  //           maximum_seconds: task.taskRequirement.maximum_seconds,
  //           minimum_characters_length:
  //             task.taskRequirement.minimum_characters_length,
  //           maximum_characters_length:
  //             task.taskRequirement.maximum_characters_length,
  //           estimated_earning:
  //             task.taskRequirement.max_micro_task_per_contributor *
  //             task.payment.contributor_credit_per_microtask,
  //           earning_per_task: task.payment.contributor_credit_per_microtask,
  //           average_time: task.taskRequirement.appriximate_time_per_batch,
  //           deadline: null,
  //         });
  //       } else if (!task.require_contributor_test) {
  //         const contributorMicroTasksAssigned =
  //           await this.contributorMicroTaskService.findOne({
  //             where: {
  //               task_id: task_id,
  //               contributor_id: user_id,
  //             },
  //           });
  //         if (contributorMicroTasksAssigned) {
  //           let nextBatch =
  //             contributorMicroTasksAssigned.current_batch +
  //               contributorMicroTasksAssigned.batch >
  //             contributorMicroTasksAssigned.total_micro_tasks
  //               ? contributorMicroTasksAssigned.total_micro_tasks -
  //                 contributorMicroTasksAssigned.current_batch
  //               : contributorMicroTasksAssigned.current_batch +
  //                 contributorMicroTasksAssigned.batch;
  //           let current_batch = contributorMicroTasksAssigned.current_batch;
  //           let nextMicroTasks =
  //             contributorMicroTasksAssigned.micro_task_ids.slice(
  //               current_batch,
  //               nextBatch,
  //             );
  //           const contributorTasks = await this.taskService.findOne({
  //             where: {
  //               id: task_id,
  //               microTasks: {
  //                 is_test: false,
  //                 dataSets: {
  //                   contributor_id: user_id,
  //                 },
  //               },
  //             },
  //             relations: {
  //               microTasks: {
  //                 dataSets: true,
  //               },
  //             },
  //           });
  //           let result: ContributorMicroTaskRto[] = [];
  //           if (contributorTasks) {
  //             for (const microTask of contributorTasks.microTasks) {
  //               const status = checkIfMicroTasIskRejectedAndTotalAttempts(
  //                 microTask,
  //                 task.taskRequirement.max_retry_per_task,
  //               );
  //               result.push(
  //                 ContributorMicroTaskRto.from(
  //                   {
  //                     ...microTask,
  //                     dataSets: status.dataSet
  //                       ? [ContributorDataSetRto.from(status.dataSet)]
  //                       : undefined,
  //                   },
  //                   {
  //                     acceptance_status: status.acceptanceStatus,
  //                     current_retry: status.totalAttempts,
  //                     allowed_retry: task.taskRequirement.max_retry_per_task,
  //                     can_retry: status.canRetry,
  //                   },
  //                 ),
  //               );
  //             }
  //           }
  //           let newTasks: MicroTask[] = await this.microTaskService.findAll({
  //             where: { id: In(nextMicroTasks) },
  //             relations: {
  //               dataSets: true,
  //             },
  //           });

  //           for (const microTask of newTasks) {
  //             result.push(
  //               ContributorMicroTaskRto.from(
  //                 {
  //                   ...microTask,
  //                   dataSets: [],
  //                 },
  //                 {
  //                   current_retry: 0,
  //                   allowed_retry: task.taskRequirement.max_retry_per_task,
  //                   acceptance_status: 'NOT_STARTED',
  //                   can_retry: true,
  //                 },
  //               ),
  //             );
  //           }
  //           return TaskMicroTasksResponse.from({
  //             ...task,
  //             has_passed: 'APPROVED',
  //             is_test: false,
  //             contributorMicroTask: result.sort((a, b) => {
  //               if (a.can_retry === b.can_retry) return 0;
  //               return a.can_retry ? -1 : 1; // true first
  //             }),
  //             batch: current_batch,
  //             taskInstruction:
  //               task.taskInstructions.length > 0
  //                 ? task.taskInstructions[0]
  //                 : undefined,
  //             minimum_seconds: task.taskRequirement.minimum_seconds,
  //             maximum_seconds: task.taskRequirement.maximum_seconds,
  //             minimum_characters_length:
  //               task.taskRequirement.minimum_characters_length,
  //             maximum_characters_length:
  //               task.taskRequirement.maximum_characters_length,
  //             estimated_earning:
  //               task.taskRequirement.max_micro_task_per_contributor *
  //               task.payment.contributor_credit_per_microtask,
  //             earning_per_task: task.payment.contributor_credit_per_microtask,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //             deadline: null,
  //           });
  //         } else {
  //           return TaskMicroTasksResponse.from({
  //             ...task,
  //             has_passed: 'UNDER_REVIEW',
  //             batch: 0,
  //             is_test: false,
  //             contributorMicroTask: [],
  //             taskInstruction: undefined,
  //             minimum_seconds: task.taskRequirement.minimum_seconds,
  //             maximum_seconds: task.taskRequirement.maximum_seconds,
  //             minimum_characters_length:
  //               task.taskRequirement.minimum_characters_length,
  //             maximum_characters_length:
  //               task.taskRequirement.maximum_characters_length,
  //             estimated_earning:
  //               task.taskRequirement.max_micro_task_per_contributor *
  //               task.payment.contributor_credit_per_microtask,
  //             earning_per_task: task.payment.contributor_credit_per_microtask,
  //             average_time: task.taskRequirement.appriximate_time_per_batch,
  //             deadline: null,
  //           });
  //         }
  //       } else {
  //         return TaskMicroTasksResponse.from({
  //           ...task,
  //           has_passed: 'UNDER_REVIEW',
  //           batch: 0,
  //           is_test: false,
  //           contributorMicroTask: [],
  //           taskInstruction:
  //             task.taskInstructions.length > 0
  //               ? task.taskInstructions[0]
  //               : undefined,
  //           minimum_seconds: task.taskRequirement.minimum_seconds,
  //           maximum_seconds: task.taskRequirement.maximum_seconds,
  //           minimum_characters_length:
  //             task.taskRequirement.minimum_characters_length,
  //           maximum_characters_length:
  //             task.taskRequirement.maximum_characters_length,
  //           estimated_earning:
  //             task.taskRequirement.max_micro_task_per_contributor *
  //             task.payment.contributor_credit_per_microtask,
  //           earning_per_task: task.payment.contributor_credit_per_microtask,
  //           average_time: task.taskRequirement.appriximate_time_per_batch,
  //           deadline: null,
  //         });
  //       }
  //     } else {
  //       return TaskMicroTasksResponse.from({
  //         ...task,
  //         has_passed: 'FLAGGED',
  //         batch: 0,
  //         is_test: false,
  //         contributorMicroTask: [],
  //         taskInstruction:
  //           task.taskInstructions.length > 0
  //             ? task.taskInstructions[0]
  //             : undefined,
  //         minimum_seconds: task.taskRequirement.minimum_seconds,
  //         maximum_seconds: task.taskRequirement.maximum_seconds,
  //         minimum_characters_length:
  //           task.taskRequirement.minimum_characters_length,
  //         maximum_characters_length:
  //           task.taskRequirement.maximum_characters_length,
  //         estimated_earning:
  //           task.taskRequirement.max_micro_task_per_contributor *
  //           task.payment.contributor_credit_per_microtask,
  //         earning_per_task: task.payment.contributor_credit_per_microtask,
  //         average_time: task.taskRequirement.appriximate_time_per_batch,
  //         deadline: null,
  //       });
  //     }
  //   } else {
  //     // return all the test micro tasks
  //     if (!task.require_contributor_test) {
  //       const contributorMicroTasksAssigned =
  //         await this.contributorMicroTaskService.findOne({
  //           where: {
  //             task_id: task_id,
  //             contributor_id: user_id,
  //           },
  //         });
  //       if (!contributorMicroTasksAssigned) {
  //         return TaskMicroTasksResponse.from({
  //           ...task,
  //           has_passed: 'APPROVED',
  //           batch: 0,
  //           is_test: false,
  //           contributorMicroTask: [],
  //           taskInstruction:
  //             task.taskInstructions.length > 0
  //               ? task.taskInstructions[0]
  //               : undefined,
  //           minimum_seconds: task.taskRequirement.minimum_seconds,
  //           maximum_seconds: task.taskRequirement.maximum_seconds,
  //           minimum_characters_length:
  //             task.taskRequirement.minimum_characters_length,
  //           maximum_characters_length:
  //             task.taskRequirement.maximum_characters_length,
  //           estimated_earning:
  //             task.taskRequirement.max_micro_task_per_contributor *
  //             task.payment.contributor_credit_per_microtask,
  //           earning_per_task: task.payment.contributor_credit_per_microtask,
  //           average_time: task.taskRequirement.appriximate_time_per_batch,
  //           deadline: null,
  //         });
  //       }
  //       let batch = contributorMicroTasksAssigned.batch;
  //       let currentBatch = contributorMicroTasksAssigned.current_batch;
  //       let newMicroTaskIds =
  //         contributorMicroTasksAssigned.micro_task_ids.slice(
  //           currentBatch,
  //           currentBatch + batch,
  //         );
  //       let contributorTasks: ContributorMicroTaskRto[] = [];
  //       const newMicroTasks = await this.microTaskService.findAll({
  //         where: {
  //           id: In(newMicroTaskIds),
  //         },
  //         relations: {
  //           dataSets: true,
  //         },
  //       });
  //       // Add the new microtasks
  //       for (const newM of newMicroTasks) {
  //         contributorTasks.push(
  //           ContributorMicroTaskRto.from(newM, {
  //             current_retry: 0,
  //             allowed_retry: task.taskRequirement.max_retry_per_task,
  //             acceptance_status: 'NOT_STARTED',
  //             can_retry: false,
  //           }),
  //         );
  //       }
  //       return TaskMicroTasksResponse.from({
  //         ...task,
  //         contributorMicroTask: contributorTasks.sort((a, b) => {
  //           if (a.can_retry === b.can_retry) return 0;
  //           return a.can_retry ? -1 : 1; // true first
  //         }),
  //         has_passed: 'APPROVED',
  //         is_test: false,
  //         batch: 0,
  //         taskInstruction:
  //           task.taskInstructions.length > 0
  //             ? task.taskInstructions[0]
  //             : undefined,
  //         minimum_seconds: task.taskRequirement.minimum_seconds,
  //         maximum_seconds: task.taskRequirement.maximum_seconds,
  //         minimum_characters_length:
  //           task.taskRequirement.minimum_characters_length,
  //         maximum_characters_length:
  //           task.taskRequirement.maximum_characters_length,
  //         estimated_earning:
  //           task.taskRequirement.max_micro_task_per_contributor *
  //           task.payment.contributor_credit_per_microtask,
  //         earning_per_task: task.payment.contributor_credit_per_microtask,
  //         average_time: task.taskRequirement.appriximate_time_per_batch,
  //         deadline: contributorMicroTasksAssigned.dead_line,
  //       });
  //     } else {
  //       const contributedTaskBefore = await this.taskService.findOne({
  //         where: {
  //           id: task_id,
  //           microTasks: {
  //             dataSets: {
  //               contributor_id: user_id,
  //             },
  //           },
  //         },
  //         relations: {
  //           microTasks: {
  //             dataSets: true,
  //           },
  //         },
  //       });
  //       const hasTakenTest = contributedTaskBefore
  //         ? contributedTaskBefore.microTasks.length > 0
  //         : false;

  //       if (hasTakenTest && contributedTaskBefore) {
  //         // return all the tasks with the status
  //         const contributedMicroTasksBefore = contributedTaskBefore.microTasks;
  //         let contributorMicroTasks: ContributorMicroTaskRto[] = [];
  //         for (const microTask of contributedMicroTasksBefore) {
  //           const status = checkIfMicroTasIskRejectedAndTotalAttempts(
  //             microTask,
  //             task.taskRequirement.max_retry_per_task,
  //           );
  //           contributorMicroTasks.push(
  //             ContributorMicroTaskRto.from(microTask, {
  //               current_retry: status.totalAttempts,
  //               allowed_retry: task.taskRequirement.max_retry_per_task,
  //               acceptance_status: status.acceptanceStatus,
  //               can_retry: status.canRetry,
  //             }),
  //           );
  //         }
  //         return TaskMicroTasksResponse.from({
  //           has_passed: 'UNDER_REVIEW',
  //           batch: 0,
  //           is_test: true,
  //           ...task,
  //           contributorMicroTask: contributorMicroTasks.sort((a, b) => {
  //             if (a.can_retry === b.can_retry) return 0;
  //             return a.can_retry ? -1 : 1; // true first
  //           }),
  //           taskInstruction:
  //             task.taskInstructions.length > 0
  //               ? task.taskInstructions[0]
  //               : undefined,
  //           minimum_seconds: task.taskRequirement.minimum_seconds,
  //           maximum_seconds: task.taskRequirement.maximum_seconds,
  //           minimum_characters_length:
  //             task.taskRequirement.minimum_characters_length,
  //           maximum_characters_length:
  //             task.taskRequirement.maximum_characters_length,
  //           estimated_earning:
  //             task.payment.contributor_credit_per_microtask *
  //             task.taskRequirement.max_micro_task_per_contributor,
  //           earning_per_task: task.payment.contributor_credit_per_microtask,
  //           average_time: task.taskRequirement.appriximate_time_per_batch,
  //           deadline: null,
  //         });
  //       } else {
  //         let testMicroTasks =
  //           await this.microTaskService.findAllTestMicroTasks({
  //             where: { task_id: task_id },
  //           });
  //         return TaskMicroTasksResponse.from({
  //           has_passed: 'PENDING',
  //           batch: 0,
  //           is_test: true,
  //           ...task,
  //           contributorMicroTask: testMicroTasks.map((microTask) => {
  //             return ContributorMicroTaskRto.from(microTask, {
  //               current_retry: 0,
  //               allowed_retry: task.taskRequirement.max_retry_per_task,
  //               acceptance_status: 'NOT_STARTED',
  //               can_retry: false,
  //             });
  //           }),
  //           taskInstruction:
  //             task.taskInstructions.length > 0
  //               ? task.taskInstructions[0]
  //               : undefined,
  //           minimum_seconds: task.taskRequirement.minimum_seconds,
  //           maximum_seconds: task.taskRequirement.maximum_seconds,
  //           minimum_characters_length:
  //             task.taskRequirement.minimum_characters_length,
  //           maximum_characters_length:
  //             task.taskRequirement.maximum_characters_length,
  //           estimated_earning:
  //             task.taskRequirement.max_micro_task_per_contributor *
  //             task.payment.contributor_credit_per_microtask,
  //           earning_per_task: task.payment.contributor_credit_per_microtask,
  //           average_time: task.taskRequirement.appriximate_time_per_batch,
  //           deadline: null,
  //         });
  //       }
  //     }
  //   }
  // }
}
