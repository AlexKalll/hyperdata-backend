import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { MicroTaskStatistics } from '../enitities/MicroTaskStatistics.entity';
import { MicroTaskStatisticsService } from './MicroTaskStatistics.service';
import { ContributorMicroTaskService } from './ContributorMicroTask.service';
import { ContributorMicroTasks } from '../enitities/ContributorMicroTasks.entity';
import { TaskService } from 'src/project/service/Task.service';
import { UserService } from 'src/auth/service/User.service';
import { Role } from 'src/auth/decorators/roles.enum';
import { Task } from 'src/project/entities/Task.entity';
import { DataSetService } from 'src/data_set/service/DataSet.service';
import { ContributorMicroTasksConstantStatus } from 'src/utils/constants/ContributorMicroTasks.constant';
import { GENDER_CONSTANT } from 'src/utils/constants/Gender.constant';
import { NotificationService } from 'src/common/service/Notification.service';

import { ReviewerTaskService } from './ReviewerTasks.service';
import { CacheService } from 'src/cache/CacheService.service';

const percent_required = 0.4;

@Injectable()
/**
 * The TaskDistributionService class is responsible for managing task distribution and redistribution
 * among contributors. It provides methods to initialize task redistribution and to handle events
 * related to contributor creation. The service interacts with various other services such as
 * MicroTaskStatisticsService, ContributorMicroTaskService, TaskService, and UserService to achieve
 * its goals.
 */
export class TaskDistributionService {
  constructor(
    private readonly microTaskStatisticsService: MicroTaskStatisticsService,
    private readonly dataSetService: DataSetService,
    private readonly contributorMicroTaskService: ContributorMicroTaskService,
    private readonly taskService: TaskService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly reviewerTaskService: ReviewerTaskService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Initialize the task distribution process.
   * This method will distribute the tasks to contributors. If the task is not public
   * then it will only distribute to the contributors who are already a member of the task.
   * If the task is public then it will distribute to all contributors who satisfy the task requirement.
   * This method will also distribute the micro tasks to contributors. If a contributor has already
   * received a micro task then it will not distribute another one to the same contributor.
   * @param task_id The id of the task
   * @param queryRunner The query runner
   * @returns void
   */
  async processTaskDistribution(task_id: string, queryRunner: QueryRunner) {
    // get the task
    const task = await this.taskService.findOne({
      where: { id: task_id },
      relations: { microTasks: true, taskRequirement: true },
    });
    if (!task) {
      throw new Error('Task not found');
    }
    const requirement = task?.taskRequirement;
    let contributor_ids: string[] = [];
    if (!task.is_public || task.require_contributor_test) {
      const userTasks = await this.taskService.findAllTaskMembers(task_id, {
        where: { role: Role.CONTRIBUTOR },
      });
      contributor_ids = userTasks.map((userTask) => {
        return userTask.user_id;
      });
    } else {
      contributor_ids =
        await this.userService.filterContributorByTaskRequirement(
          requirement,
          task.language_id,
        );
    }
    const filter_non_test_micro_tasks = task.microTasks.filter((micro_task) => {
      return micro_task.is_test == false;
    });
    const micro_task_ids: string[] = filter_non_test_micro_tasks.map(
      (micro_task) => {
        return micro_task.id;
      },
    );
    const contributor_micro_Tasks =
      await this.contributorMicroTaskService.findAll({
        where: { task_id: task_id },
      });
    const microTaskStatistics = await this.microTaskStatisticsService.findAll({
      where: { task_id: task_id },
    });
    // sort microTaskStatistics by distribution amount
    const sortedMicroTaskStatistics = microTaskStatistics.sort(
      (a, b) => b.no_of_contributors - a.no_of_contributors,
    );
    const newContributorIds: string[] = contributor_ids.filter(
      (contributor_id) => {
        return !contributor_micro_Tasks.find((contributor_micro_task) => {
          return contributor_micro_task.contributor_id == contributor_id;
        });
      },
    );
    const newMicroTaskIds: string[] = micro_task_ids.filter((micro_task_id) => {
      return !microTaskStatistics.find((micro_task) => {
        return micro_task.micro_task_id == micro_task_id;
      });
    });
    await this.distributeNewTask(
      {
        task_id,
        micro_task_ids: newMicroTaskIds,
        contributor_ids: newContributorIds,
        microTaskStatistics: sortedMicroTaskStatistics,
        expected_micro_task_for_contributor:
          requirement.max_micro_task_per_contributor,
        expected_no_of_contributors_per_micro_task:
          requirement.max_contributor_per_micro_task,
        batch: requirement.batch || requirement.max_micro_task_per_contributor,
        existingAssignments: contributor_micro_Tasks,
      },
      task,
      queryRunner,
    );
    await this.taskService.update(
      task_id,
      { distribution_started: true },
      queryRunner,
    );
    return;
  }

  /**
   * Processes contributor–microtask distribution using gender-based constraints.
   *
   * This method determines eligible contributors, filters valid micro-tasks,
   * calculates expected male/female participation ratios, and distributes
   * micro-tasks accordingly within a database transaction.
   *
   * Flow overview:
   * - Determines eligible contributors based on task visibility and test requirements
   * - Filters out test micro-tasks
   * - Loads existing contributor–microtask assignments
   * - Computes micro-task statistics to balance workload
   * - Identifies new contributors and unassigned micro-tasks
   * - Calculates expected male/female contribution counts
   * - Enforces maximum expected contributor limits (if configured)
   * - Delegates actual assignment logic to `distributeNewTaskGenderBased`
   * - Marks task distribution as started
   *
   * Gender balancing:
   * - Expected male/female contributors are derived from task requirements
   * - Contributors are sorted and allocated to respect configured gender ratios
   *
   * Transactional behavior:
   * - Uses the provided `QueryRunner` to ensure atomic distribution and updates
   *
   * @param {Task} task
   *  The task for which gender-based distribution is being processed.
   *
   * @param {QueryRunner} queryRunner
   *  TypeORM query runner used to execute all database operations atomically.
   *
   * @returns {Promise<void>}
   *  Resolves once distribution is completed and the task is marked as started.
   */
  async processTaskDistributionGenderBased(
    task: Task,
    queryRunner: QueryRunner,
  ) {
    const task_id = task.id;
    const requirement = task?.taskRequirement;
    let contributor_ids: { id: string; gender: string }[] = [];
    if (!task.is_public || task.require_contributor_test) {
      const userTasks = await this.taskService.findAllTaskMembers(task.id, {
        where: { role: Role.CONTRIBUTOR },
        relations: { user: true },
      });
      contributor_ids = userTasks.map((userTask) => {
        return { id: userTask.user_id, gender: userTask.user.gender };
      });
    } else {
      contributor_ids = await this.userService.filterUserByTaskRequirement(
        requirement,
        task.language_id,
      );
    }
    const filter_non_test_micro_tasks = task.microTasks.filter((micro_task) => {
      return micro_task.is_test == false;
    });
    const micro_task_ids: string[] = filter_non_test_micro_tasks.map(
      (micro_task) => {
        return micro_task.id;
      },
    );
    const contributor_micro_Tasks =
      await this.contributorMicroTaskService.findAll({
        where: { task_id: task_id },
      });
    const microTaskStatistics = await this.microTaskStatisticsService.findAll({
      where: { task_id: task_id },
    });
    const sortedMicroTaskStatistics = microTaskStatistics.sort(
      (a, b) => b.no_of_contributors - a.no_of_contributors,
    );
    let newContributors = contributor_ids.filter((contributor_id) => {
      return !contributor_micro_Tasks.find((contributor_micro_task) => {
        return contributor_micro_task.contributor_id == contributor_id.id;
      });
    });
    const newMicroTaskIds = micro_task_ids.filter((micro_task_id) => {
      return !microTaskStatistics.find((micro_task) => {
        return micro_task.micro_task_id == micro_task_id;
      });
    });
    const expectedMale = Math.ceil(
      requirement.gender.male *
        0.01 *
        requirement.max_micro_task_per_contributor,
    );
    const expectedFemale = Math.ceil(
      requirement.gender.female *
        0.01 *
        requirement.max_micro_task_per_contributor,
    );
    // sort contributors according to gender
    newContributors = newContributors.sort((a, b) => {
      if (a.gender == 'Male') {
        return -1;
      } else {
        return 1;
      }
    });
    const totalContributors =
      newContributors.length + contributor_micro_Tasks.length;
    const expectedTotalContributor = task.max_expected_no_of_contributors;
    if (expectedTotalContributor) {
      const diff = expectedTotalContributor - totalContributors;
      if (diff > 0) {
        newContributors = newContributors.slice(0, diff);
      }
    }
    await this.distributeNewTaskGenderBased(
      {
        task_id,
        newMicroTaskIds,
        microTaskStatistics: sortedMicroTaskStatistics,
        contributor_ids: newContributors,
        expected_micro_task_for_contributor:
          requirement.max_micro_task_per_contributor,
        expected_no_of_contributors_per_micro_task:
          requirement.max_contributor_per_micro_task,
        batch: requirement.batch || requirement.max_micro_task_per_contributor,
        expected_male: expectedMale,
        expected_female: expectedFemale,
        existingAssignments: contributor_micro_Tasks,
      },
      task,
      queryRunner,
    );
    await this.taskService.update(
      task_id,
      { distribution_started: true },
      queryRunner,
    );
    return;
  }

  /**
   * Starts a new distribution process for a task, validating prerequisites
   * and delegating to the appropriate distribution strategy.
   *
   * This method performs the following steps:
   * 1. Loads the task and its requirements & micro-tasks.
   * 2. Validates that the task exists and is not closed.
   * 3. Checks that sufficient micro-tasks are available:
   *    - If no contributor test is required, ensures minimum micro-tasks meet a required percentage.
   *    - If a contributor test is required, ensures test micro-tasks exist.
   * 4. Delegates distribution:
   *    - If the task is gender-specific, calls `processTaskDistributionGenderBased`.
   *    - Otherwise, calls `processTaskDistribution`.
   *
   * @param {string} task_id
   *   The ID of the task to start distribution for.
   *
   * @param {QueryRunner} queryRunner
   *   The TypeORM query runner used to execute all distribution operations
   *   within a transaction.
   *
   * @throws {BadRequestException}
   *   Throws if the task is not found, closed, or does not have sufficient micro-tasks.
   *
   * @returns {Promise<void>}
   *   Resolves once task distribution is successfully initiated.
   */
  async startNewTaskDistribution(
    task_id: string,
    queryRunner: QueryRunner, // Adjust type as needed, e.g., QueryRunner if using TypeORM
  ) {
    // Initialize the task distribution
    const task = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskRequirement: true, microTasks: true },
    });
    if (!task) {
      throw new BadRequestException('Task not found');
    }
    if (task.is_closed) {
      throw new BadRequestException('Task is closed !');
    }
    const microTasksLength = task.microTasks.length;
    if (!task.require_contributor_test) {
      const minMicroTaskRequired = parseFloat(
        (
          task.taskRequirement.max_micro_task_per_contributor * percent_required
        ).toString(),
      );
      if (minMicroTaskRequired > microTasksLength) {
        throw new BadRequestException(
          `At least ${minMicroTaskRequired} micro tasks are required to distribute `,
        );
      }
    } else {
      const testMicroTasks = task.microTasks.filter((m) => m.is_test);
      if (testMicroTasks.length == 0) {
        throw new BadRequestException('Test micro tasks are required');
      }
    }
    if (task.taskRequirement.is_gender_specific) {
      await this.processTaskDistributionGenderBased(task, queryRunner);
      return;
    }

    await this.processTaskDistribution(task_id, queryRunner);

    return;
  }

  /**
   * Distributes new micro-tasks to contributors based on expected task load and existing assignments.
   * Handles round-robin assignment, contributor limits, and incomplete contributors.
   *
   * @param {Object} data - Data required for task distribution.
   * @param {string} data.task_id - ID of the task.
   * @param {string[]} data.micro_task_ids - List of new micro-task IDs to be assigned.
   * @param {MicroTaskStatistics[]} data.microTaskStatistics - Existing micro-task statistics to consider during distribution.
   * @param {string[]} data.contributor_ids - List of contributor IDs eligible for assignment.
   * @param {number} data.expected_micro_task_for_contributor - Number of micro-tasks each contributor is expected to complete.
   * @param {number} data.expected_no_of_contributors_per_micro_task - Maximum number of contributors per micro-task.
   * @param {number} [data.batch] - Optional batch size for assignment; defaults to expected_micro_task_for_contributor.
   * @param {ContributorMicroTasks[]} data.existingAssignments - Existing contributor task assignments.
   * @param {Task} task - Task entity containing task details and requirements.
   * @param {QueryRunner} queryRunner - Database query runner for transactional operations.
   *
   * @returns {Promise<void>} - Resolves when the distribution is complete, including updating statistics, assignments, and notifications.
   *
   * @throws {Error} Throws an error if any database operation fails.
   *
   * @remarks
   * - Contributors with insufficient assignments are excluded and their micro-task contribution counts are rolled back.
   * - Incomplete contributors (COMPLETED status but not fully assigned) are reassigned remaining micro-tasks up to the expected limit.
   * - Clears cache for newly assigned contributors before persisting assignments.
   * - Updates micro-task statistics and notifies contributors of new assignments.
   */
  async distributeNewTask(
    data: {
      task_id: string;
      micro_task_ids: string[];
      microTaskStatistics: MicroTaskStatistics[];
      contributor_ids: string[];
      expected_micro_task_for_contributor: number;
      expected_no_of_contributors_per_micro_task: number;
      batch?: number;
      existingAssignments: ContributorMicroTasks[];
    },
    task: Task,
    queryRunner: QueryRunner, // Adjust type as needed, e.g., QueryRunner if using TypeORM
  ) {
    data.batch = data.batch
      ? data.batch
      : data.expected_micro_task_for_contributor;
    const contributor_micro_tasks: {
      contributor_id: string;
      micro_task_ids: string[];
      status: string;
      expected_micro_task_for_contributor: number;
    }[] = [];
    let microTaskStatics: {
      id: string;
      micro_task_id: string;
      task_id: string;
      no_of_contributors: number;
      expected_no_of_contributors: number;
      total_male: number;
      total_female: number;
    }[] = [];

    for (let index = 0; index < data.micro_task_ids.length; index++) {
      microTaskStatics.push({
        id: crypto.randomUUID(),
        micro_task_id: data.micro_task_ids[index],
        no_of_contributors: 0,
        task_id: data.task_id,
        total_male: 0,
        total_female: 0,
        expected_no_of_contributors:
          data.expected_no_of_contributors_per_micro_task,
      });
    }
    microTaskStatics = [...microTaskStatics, ...data.microTaskStatistics];
    let micro_task_index = 0;
    for (let index = 0; index < data.contributor_ids.length; index++) {
      let iterator = 0;
      const contributorMicroTaskIds: string[] = [];
      const contributor = data.contributor_ids[index];
      while (iterator < microTaskStatics.length) {
        const microTask = microTaskStatics[micro_task_index];
        // let microTask = findMicroTask(micro_task_id);
        if (
          contributorMicroTaskIds.length >=
          data.expected_micro_task_for_contributor
        ) {
          break;
        }
        if (
          microTask.no_of_contributors < microTask.expected_no_of_contributors
        ) {
          contributorMicroTaskIds.push(microTask.micro_task_id);
          microTask.no_of_contributors++;
        }
        micro_task_index++;
        iterator++;
        if (micro_task_index >= microTaskStatics.length) {
          micro_task_index = 0;
        }
      }
      contributor_micro_tasks.push({
        contributor_id: contributor,
        micro_task_ids: contributorMicroTaskIds,
        status: ContributorMicroTasksConstantStatus.NEW,
        expected_micro_task_for_contributor:
          data.expected_micro_task_for_contributor,
      });
    }

    // await this.contributorMicroTaskService.createMany(contributor_micro_tasks,task_id,batch,queryRunner);

    contributor_micro_tasks.map((contributor_task) => {
      if (
        contributor_task.micro_task_ids.length <
        percent_required * data.expected_micro_task_for_contributor
      ) {
        // decrease the contributor number for each microtask
        contributor_task.micro_task_ids.map((micro_task_id) => {
          // console.log( " Reducing Micro task ",micro_task_id);
          const micro_task = microTaskStatics.find((micro_task_stat) => {
            return micro_task_stat.micro_task_id == micro_task_id;
          });
          if (micro_task) {
            micro_task.no_of_contributors--;
          }
        });
        contributor_task.micro_task_ids = [];
      }
    });
    // remove contributors with no microtasks
    const validContributorTasks = contributor_micro_tasks.filter(
      (contributor_task) => {
        return contributor_task.micro_task_ids.length > 0;
      },
    );

    const completeButNotFullyAssignedContributors =
      data.existingAssignments.filter(
        (c) =>
          c.status === ContributorMicroTasksConstantStatus.COMPLETED &&
          c.micro_task_ids.length <
            data.expected_micro_task_for_contributor * (1 - percent_required),
      );

    const waiting_hr = task.contributor_completion_time_limit || undefined;
    const dead_line = waiting_hr
      ? new Date(Date.now() + waiting_hr * 60 * 60 * 1000)
      : undefined;

    for (let i = 0; i < completeButNotFullyAssignedContributors.length; i++) {
      const newIds: string[] = [];
      for (const microTask of data.microTaskStatistics) {
        if (
          microTask.no_of_contributors <
            microTask.expected_no_of_contributors &&
          !completeButNotFullyAssignedContributors[i].micro_task_ids.includes(
            microTask.micro_task_id,
          )
        ) {
          newIds.push(microTask.micro_task_id);
          microTask.no_of_contributors++;
        }
        if (
          newIds.length +
            completeButNotFullyAssignedContributors[i].micro_task_ids.length >=
          data.expected_micro_task_for_contributor
        ) {
          break;
        }
      }
      if (newIds.length > 0) {
        completeButNotFullyAssignedContributors[i].total_micro_tasks =
          completeButNotFullyAssignedContributors[i].micro_task_ids.length +
          newIds.length;
        completeButNotFullyAssignedContributors[i].micro_task_ids =
          completeButNotFullyAssignedContributors[i].micro_task_ids = [
            ...new Set([
              ...completeButNotFullyAssignedContributors[i].micro_task_ids,
              ...newIds,
            ]),
          ];
        completeButNotFullyAssignedContributors[i].status =
          ContributorMicroTasksConstantStatus.IN_PROGRESS;
        if (dead_line) {
          completeButNotFullyAssignedContributors[i].dead_line = dead_line;
        }
      }
    }
    if (validContributorTasks.length > 0) {
      await Promise.all(
        validContributorTasks.map(async (contributor_task) => {
          return this.cacheService.clearContributorTaskCache(
            contributor_task.contributor_id,
          );
        }),
      );
    }
    await this.contributorMicroTaskService.createMany(
      validContributorTasks,
      data.task_id,
      data.batch,
      queryRunner,
      dead_line,
    );
    if (completeButNotFullyAssignedContributors.length > 0) {
      await this.contributorMicroTaskService.upsertMany(
        completeButNotFullyAssignedContributors,
        queryRunner,
      );
    }
    await this.microTaskStatisticsService.upsertMany(
      microTaskStatics,
      queryRunner,
    );
    await this.notifyContributorAssignment(
      validContributorTasks,
      task,
      queryRunner,
    );
    return;
  }

  /**
   * Distributes new micro-tasks to contributors based on gender-specific requirements.
   * Handles assignment, contributor limits, and incomplete contributors while respecting gender constraints.
   *
   * @param {Object} data - Data required for gender-based task distribution.
   * @param {string} data.task_id - ID of the task.
   * @param {string[]} data.newMicroTaskIds - List of new micro-task IDs to assign.
   * @param {MicroTaskStatistics[]} data.microTaskStatistics - Existing micro-task statistics to consider during distribution.
   * @param {{ id: string; gender: string }[]} data.contributor_ids - List of contributors with their gender.
   * @param {number} data.expected_micro_task_for_contributor - Number of micro-tasks each contributor is expected to complete.
   * @param {number} data.expected_no_of_contributors_per_micro_task - Maximum number of contributors per micro-task.
   * @param {number} data.expected_male - Maximum male contributors per micro-task.
   * @param {number} data.expected_female - Maximum female contributors per micro-task.
   * @param {number} [data.batch] - Optional batch size for assignment; defaults to expected_micro_task_for_contributor.
   * @param {ContributorMicroTasks[]} data.existingAssignments - Existing contributor task assignments.
   * @param {Task} task - Task entity containing task details and requirements.
   * @param {QueryRunner} queryRunner - Database query runner for transactional operations.
   *
   * @returns {Promise<void>} - Resolves when the gender-based distribution is complete, including updating statistics, assignments, and notifications.
   *
   * @throws {Error} Throws an error if any database operation fails.
   *
   * @remarks
   * - Assigns micro-tasks respecting expected male/female contributor distribution.
   * - Contributors below the minimum required assignment are excluded and counts are rolled back.
   * - Incomplete contributors (COMPLETED status but not fully assigned) are reassigned remaining micro-tasks up to the expected limit respecting gender.
   * - Clears cache for newly assigned contributors before persisting assignments.
   * - Updates micro-task statistics and notifies contributors of new assignments.
   */
  async distributeNewTaskGenderBased(
    data: {
      task_id: string;
      newMicroTaskIds: string[];
      microTaskStatistics: MicroTaskStatistics[];
      contributor_ids: { id: string; gender: string }[];
      expected_micro_task_for_contributor: number;
      expected_no_of_contributors_per_micro_task: number;
      expected_male: number;
      expected_female: number;
      batch?: number;
      existingAssignments: ContributorMicroTasks[];
    },
    task: Task,
    queryRunner: QueryRunner, // Adjust type as needed, e.g., QueryRunner if using TypeORM
  ) {
    data.batch = data.batch
      ? data.batch
      : data.expected_micro_task_for_contributor;
    let contributor_micro_tasks: {
      contributor_id: string;
      micro_task_ids: string[];
      status: string;
      gender: string;
      expected_micro_task_for_contributor: number;
    }[] = [];
    let microTaskStatics: {
      id: string;
      micro_task_id: string;
      task_id: string;
      no_of_contributors: number;
      total_male: number;
      total_female: number;
      expected_no_of_contributors: number;
    }[] = [];
    for (let index = 0; index < data.newMicroTaskIds.length; index++) {
      microTaskStatics.push({
        id: crypto.randomUUID(),
        micro_task_id: data.newMicroTaskIds[index],
        no_of_contributors: 0,
        task_id: data.task_id,
        total_male: 0,
        total_female: 0,
        expected_no_of_contributors:
          data.expected_no_of_contributors_per_micro_task,
      });
    }
    microTaskStatics = [...microTaskStatics, ...data.microTaskStatistics];
    let micro_task_index = 0;
    for (let index = 0; index < data.contributor_ids.length; index++) {
      let iterator = 0;
      const contributorMicroTaskIds: string[] = [];
      let totalAssignedMicroTasks = 0;
      const contributor = data.contributor_ids[index];
      while (iterator < microTaskStatics.length) {
        const microTask = microTaskStatics[iterator];
        if (
          totalAssignedMicroTasks >= data.expected_micro_task_for_contributor
        ) {
          console.log('It is greater than expected ');
          break;
        }
        if (
          microTask.no_of_contributors <
          data.expected_no_of_contributors_per_micro_task
        ) {
          if (
            microTask.total_male < data.expected_male &&
            contributor.gender == GENDER_CONSTANT.MALE
          ) {
            contributorMicroTaskIds.push(microTask.micro_task_id);
            microTask.no_of_contributors++;
            microTask.total_male++;
            totalAssignedMicroTasks++;
          } else if (
            microTask.total_female < data.expected_female &&
            contributor.gender == GENDER_CONSTANT.FEMALE
          ) {
            contributorMicroTaskIds.push(microTask.micro_task_id);
            microTask.no_of_contributors++;
            microTask.total_female++;
            totalAssignedMicroTasks++;
          }
          micro_task_index++;
          if (micro_task_index >= microTaskStatics.length) {
            micro_task_index = 0;
          }
        }

        micro_task_index++;
        iterator++;
        if (micro_task_index >= microTaskStatics.length) {
          micro_task_index = 0;
        }
      }
      contributor_micro_tasks.push({
        contributor_id: contributor.id,
        gender: contributor.gender,
        micro_task_ids: contributorMicroTaskIds,
        status: ContributorMicroTasksConstantStatus.NEW,
        expected_micro_task_for_contributor:
          data.expected_micro_task_for_contributor,
      });
    }

    // await this.contributorMicroTaskService.createMany(contributor_micro_tasks,task_id,batch,queryRunner);
    const minRequiredContributorTasks =
      percent_required * data.expected_micro_task_for_contributor;
    contributor_micro_tasks.map((contributor_task) => {
      if (
        contributor_task.micro_task_ids.length < minRequiredContributorTasks
      ) {
        // decrease the contributor number for each microtask
        contributor_task.micro_task_ids.map((micro_task_id) => {
          const micro_task = microTaskStatics.find((micro_task_stat) => {
            return micro_task_stat.micro_task_id == micro_task_id;
          });
          if (micro_task) {
            micro_task.no_of_contributors--;
            if (contributor_task.gender == GENDER_CONSTANT.MALE) {
              micro_task.total_male--;
            } else {
              micro_task.total_female--;
            }
          }
        });
        contributor_task.micro_task_ids = [];
      }
    });
    // remove contributors with no microtasks
    contributor_micro_tasks = contributor_micro_tasks.filter(
      (contributor_task) => {
        return contributor_task.micro_task_ids.length > 0;
      },
    );
    const completeButNotFullyAssignedContributors =
      data.existingAssignments.filter(
        (c) =>
          c.status === ContributorMicroTasksConstantStatus.COMPLETED &&
          c.micro_task_ids.length <
            data.expected_micro_task_for_contributor * (1 - percent_required),
      );
    const waiting_hr = task?.contributor_completion_time_limit || undefined;
    const dead_line = waiting_hr
      ? new Date(Date.now() + waiting_hr * 60 * 60 * 1000)
      : undefined;
    for (let i = 0; i < completeButNotFullyAssignedContributors.length; i++) {
      const contributor = completeButNotFullyAssignedContributors[i];
      const newIds: string[] = [];
      for (const microTask of microTaskStatics) {
        if (contributor.gender == 'Male') {
          if (
            microTask.total_male < data.expected_male &&
            !completeButNotFullyAssignedContributors[i].micro_task_ids.includes(
              microTask.micro_task_id,
            )
          ) {
            newIds.push(microTask.micro_task_id);
            microTask.no_of_contributors++;
            microTask.total_male++;
          }
        } else if (contributor.gender == 'Female') {
          if (
            microTask.total_female < data.expected_female &&
            !completeButNotFullyAssignedContributors[i].micro_task_ids.includes(
              microTask.micro_task_id,
            )
          ) {
            newIds.push(microTask.micro_task_id);
            microTask.no_of_contributors++;
            microTask.total_female++;
          }
        }
        if (
          newIds.length +
            completeButNotFullyAssignedContributors[i].micro_task_ids.length >=
          data.expected_micro_task_for_contributor
        ) {
          break;
        }
      }
      if (newIds.length > 0) {
        completeButNotFullyAssignedContributors[i].total_micro_tasks =
          completeButNotFullyAssignedContributors[i].micro_task_ids.length +
          newIds.length;
        completeButNotFullyAssignedContributors[i].micro_task_ids =
          completeButNotFullyAssignedContributors[i].micro_task_ids = [
            ...new Set([
              ...completeButNotFullyAssignedContributors[i].micro_task_ids,
              ...newIds,
            ]),
          ];
        completeButNotFullyAssignedContributors[i].status =
          ContributorMicroTasksConstantStatus.IN_PROGRESS;
        if (dead_line) {
          completeButNotFullyAssignedContributors[i].dead_line = dead_line;
        }
      }
    }

    if (contributor_micro_tasks.length > 0) {
      await Promise.all(
        contributor_micro_tasks.map(async (contributor_task) => {
          return this.cacheService.clearContributorTaskCache(
            contributor_task.contributor_id,
          );
        }),
      );
    }

    await this.contributorMicroTaskService.createMany(
      contributor_micro_tasks,
      data.task_id,
      data.batch,
      queryRunner,
      dead_line,
    );
    if (completeButNotFullyAssignedContributors.length > 0) {
      await this.contributorMicroTaskService.upsertMany(
        completeButNotFullyAssignedContributors,
        queryRunner,
      );
    }
    // console.log("Micro Task stats ",microTaskStatics)
    await this.microTaskStatisticsService.upsertMany(
      microTaskStatics,
      queryRunner,
    );
    await this.notifyContributorAssignment(
      contributor_micro_tasks,
      task,
      queryRunner,
    );
    return;
  }

  async assignMicroTasksToContributor(
    contributor_id: string,
    task_id: string,
    expected_micro_task_for_contributor: number,
    batch: number,
    micro_task_stat: MicroTaskStatistics[],
    queryRunner: QueryRunner,
  ) {
    const contributor_micro_tasks: {
      contributor_id: string;
      task_id: string;
      expected_micro_task_for_contributor: number;
      batch: number;
      total_micro_tasks: number;
      micro_task_ids: string[];
      status: string;
    } = {
      contributor_id: contributor_id,
      micro_task_ids: [],
      status: 'new',
      task_id: task_id,
      expected_micro_task_for_contributor: expected_micro_task_for_contributor,
      total_micro_tasks: 0,
      batch: batch,
    };

    // iterator ON microtask stat
    for (let index = 0; index < micro_task_stat.length; index++) {
      const micro_task = micro_task_stat[index];
      if (
        micro_task.no_of_contributors < micro_task.expected_no_of_contributors
      ) {
        contributor_micro_tasks.micro_task_ids.push(micro_task.micro_task_id);
        contributor_micro_tasks.total_micro_tasks++;
        micro_task.no_of_contributors++;
      }
    }
    const has_meet_expected_microtask_for_contributor =
      contributor_micro_tasks.total_micro_tasks >=
      percent_required * expected_micro_task_for_contributor;
    if (has_meet_expected_microtask_for_contributor) {
      await this.contributorMicroTaskService.create(
        contributor_micro_tasks,
        queryRunner,
      );
      await this.microTaskStatisticsService.upsertMany(
        micro_task_stat,
        queryRunner,
      );
    }
  }

  async notifyContributorAssignment(
    contributorMicroTasks: Partial<ContributorMicroTasks>[],
    task: Task,
    queryRunner: QueryRunner,
  ) {
    const title = 'New Task Assignment';
    const message = `You have been assigned a new task on ${task.name}. Please complete the task as soon as possible.`;
    await Promise.all(
      contributorMicroTasks.map(async (contributorMicroTask) => {
        if (contributorMicroTask.contributor_id) {
          await this.notificationService.create({
            user_id: contributorMicroTask.contributor_id,
            title,
            message,
            type: 'task-assign',
          });
        }
      }),
    );
  }
  /**
   * Distributes pending micro-task data sets of a task to its assigned reviewers.
   * Fetches all data sets of the task, separates pending and reviewed sets,
   * and delegates assignment to the reviewer task service.
   *
   * @param {string} taskId - The ID of the task to distribute to reviewers.
   *
   * @returns {Promise<void>} - Resolves when the distribution process is completed.
   *
   * @throws {NotFoundException} Throws if the task is not found or is archived.
   *
   * @remarks
   * - Fetches the task along with its requirements and user assignments.
   * - Filters all data sets of the task into pending and reviewed.
   * - Identifies reviewers from the task's user assignments.
   * - Calls `reviewerTaskService.distributeTaskForReviewers` to handle the actual assignment.
   */
  async distributeTaskForReviewers(taskId: string) {
    const task = await this.taskService.findOne({
      where: { id: taskId, is_archived: false },
      relations: { taskRequirement: true, userToTasks: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found or it is deleted');
    }
    const dataSets = await this.dataSetService.findAll({
      where: {
        microTask: {
          task: {
            id: taskId,
          },
        },
      },
    });
    const pendingDataSets = dataSets.filter((dS) => dS.status === 'Pending');
    const reviewedDataSets = dataSets.filter((dS) => dS.status !== 'Pending');
    const taskReviewers = task.userToTasks
      .filter((tM) => tM.role === 'Reviewer')
      .map((tM) => tM.user_id);
    const pendingDataSetIds = pendingDataSets.map((pd) => pd.id);
    await this.reviewerTaskService.distributeTaskForReviewers(
      task,
      pendingDataSetIds,
      reviewedDataSets,
      taskReviewers,
    );
  }
}
