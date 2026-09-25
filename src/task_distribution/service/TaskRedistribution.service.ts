import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { MicroTaskStatistics } from '../enitities/MicroTaskStatistics.entity';
import { MicroTaskStatisticsService } from './MicroTaskStatistics.service';
import { ContributorMicroTaskService } from './ContributorMicroTask.service';
import { ContributorMicroTasks } from '../enitities/ContributorMicroTasks.entity';
import { TaskService } from 'src/project/service/Task.service';
import { UserService } from 'src/auth/service/User.service';
import { Role } from 'src/auth/decorators/roles.enum';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContributorMicroTasksConstantStatus } from 'src/utils/constants/ContributorMicroTasks.constant';
import { TaskRequirement } from 'src/project/entities/TaskRequirement.entity';
import {
  distributeTaskAmongNewContributors,
  distributeTaskAmongNewContributorsGenderBased,
} from 'src/utils/TaskDistribution.util';
import { UserScoreService } from 'src/auth/service/UserScore.service';
@Injectable()
/**
 * The TaskDistributionService class is responsible for managing task distribution and redistribution
 * among contributors. It provides methods to initialize task redistribution and to handle events
 * related to contributor creation. The service interacts with various other services such as
 * MicroTaskStatisticsService, ContributorMicroTaskService, TaskService, and UserService to achieve
 * its goals.
 */
export class TaskRedistributionService {
  constructor(
    private readonly microTaskStatisticsService: MicroTaskStatisticsService,
    private readonly contributorMicroTaskService: ContributorMicroTaskService,
    private readonly taskService: TaskService,
    private readonly userService: UserService,
    private readonly userScoreService: UserScoreService,
    private readonly dataSource: DataSource,
  ) {}
  /**
   * This method is responsible for redistributing the tasks among contributors who have not yet
   * received tasks. It will be called when a new contributor is created. It works by finding all
   * open tasks, their micro tasks and the contributors who have not yet received tasks. It then
   * redistribute the tasks among the contributors based on the task requirement of the task.
   * It also handles the case where a contributor has already received a task but the task is
   * not yet completed. It will redistribute the task to another contributor if the task is
   * not yet completed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async initializeTaskRedistribution() {
    const tasks = await this.taskService.findAll({
      where: { is_closed: false, distribution_started: true },
      relations: { taskRequirement: true },
    });

    for (const task of tasks) {
      const taskRequirement = task.taskRequirement;
      const taskId = task.id;

      try {
        // Fetch micro-task stats and current contributors
        const [microTaskStats, contributorMicroTasks] = await Promise.all([
          this.microTaskStatisticsService.findAll({
            where: { task_id: taskId },
          }),
          this.contributorMicroTaskService.findAll({
            where: { task_id: taskId },
          }),
        ]);

        // Get all eligible contributors
        const allContributors: { id: string; gender: string; score: number }[] =
          [];
        if (!task.is_public || task.require_contributor_test) {
          const userTasks = await this.taskService.findAllTaskMembers(taskId, {
            where: { role: Role.CONTRIBUTOR },
          });
          const contributorIds = userTasks.map((userTask) => {
            return {
              id: userTask.user.id,
              gender: userTask.user.gender,
              score: 0,
            };
          });
          allContributors.push(...contributorIds);
        } else {
          const contributorIds =
            await this.userService.filterUserByTaskRequirement(
              taskRequirement,
              task.language_id,
            );
          allContributors.push(...contributorIds);
        }

        // Filter out contributors who have already contributed
        const existingContributorIds = new Set(
          contributorMicroTasks.map((cmt) => cmt.contributor_id),
        );

        let newContributors = allContributors.filter(
          (contributor) => !existingContributorIds.has(contributor.id),
        );
        const totalContributors =
          newContributors.length + existingContributorIds.size;
        const expectedTotalContributor = task.max_expected_no_of_contributors;
        if (expectedTotalContributor) {
          const diff = expectedTotalContributor - totalContributors;
          if (diff > 0) {
            newContributors = newContributors.slice(0, diff);
          }
        }
        // Create a transaction
        const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const batchSize = taskRequirement.batch
            ? taskRequirement.batch
            : taskRequirement.max_micro_task_per_contributor;
          const deadlineHr =
            task?.contributor_completion_time_limit || undefined;
          if (taskRequirement?.is_gender_specific) {
            await this.reDistributeTaskGenderBased(
              contributorMicroTasks,
              newContributors,
              taskId,
              microTaskStats,
              taskRequirement.max_micro_task_per_contributor,
              taskRequirement.max_contributor_per_micro_task,
              batchSize,
              taskRequirement,
              queryRunner,
              deadlineHr,
            );
          } else {
            await this.reDistributeTask(
              contributorMicroTasks,
              newContributors.map((c) => c.id),
              taskId,
              microTaskStats,
              taskRequirement.max_micro_task_per_contributor,
              taskRequirement.max_contributor_per_micro_task,
              batchSize,
              queryRunner,
              deadlineHr,
            );
          }

          await queryRunner.commitTransaction();
        } catch (error) {
          console.error(
            `[Redistribution] Task ID ${taskId}: Error during redistribution`,
            error,
          );
          await queryRunner.rollbackTransaction();
        } finally {
          try {
            await queryRunner.release();
          } catch (releaseError) {
            console.error(
              `[Redistribution] Task ID ${taskId}: Error releasing queryRunner`,
              releaseError,
            );
          }
        }
      } catch (outerError) {
        console.error(
          `[Redistribution] Task ID ${task.id}: Outer error`,
          outerError,
        );
      }
    }
  }

  /**
   * Re-distributes micro-tasks among new and existing contributors for a given task.
   * Ensures fair allocation based on max tasks per contributor, max contributors per micro-task,
   * and optionally a waiting deadline. Handles revoking or reassigning contributors when needed.
   *
   * @param {ContributorMicroTasks[]} existingAssignments - Existing contributor task assignments.
   * @param {string[]} newContributorIds - List of new contributor IDs to distribute tasks to.
   * @param {string} taskId - The ID of the task for which redistribution is happening.
   * @param {MicroTaskStatistics[]} microTaskStats - Statistics for all micro-tasks in the task.
   * @param {number} maxPerContributor - Maximum micro-tasks that can be assigned to a contributor.
   * @param {number} maxContributorsPerMicroTask - Maximum contributors that can work on a single micro-task.
   * @param {number} batch - Number of micro-tasks in a single batch.
   * @param {QueryRunner} queryRunner - TypeORM QueryRunner used for transactional operations.
   * @param {number} [maxWaitingHours] - Optional maximum hours to set a deadline for task completion.
   *
   * @returns {Promise<void>} - Resolves when task redistribution and persistence are completed.
   *
   * @remarks
   * - Filters unfinished micro-tasks and distributes them among new contributors.
   * - Revokes assignments below the minimum threshold for effective contribution.
   * - Reassigns leftover micro-tasks from contributors who didn’t start or fully complete their assignments.
   * - Updates deadlines for contributors if `maxWaitingHours` is provided.
   * - Reduce contributors who don't done their assigned task on time
   * - Persists final assignments and updates micro-task statistics using the relevant services.
   */
  async reDistributeTask(
    existingAssignments: ContributorMicroTasks[],
    newContributorIds: string[],
    taskId: string,
    microTaskStats: MicroTaskStatistics[],
    maxPerContributor: number,
    maxContributorsPerMicroTask: number,
    batch: number,
    queryRunner: QueryRunner,
    maxWaitingHours?: number,
  ): Promise<void> {
    const deadline = maxWaitingHours
      ? new Date(Date.now() + maxWaitingHours * 60 * 60 * 1000)
      : undefined;
    const percentRequired = 0.5; // Assumed value — adjust as needed

    // Filter unfinished microtasks
    const undoneMicroTasks = microTaskStats.filter(
      (stat) => stat.no_of_contributors < stat.expected_no_of_contributors,
    );

    const { contributor_micro_tasks, micro_task_statistics } =
      distributeTaskAmongNewContributors(
        newContributorIds,
        undoneMicroTasks,
        taskId,
        maxPerContributor,
        maxContributorsPerMicroTask,
        batch,
        deadline,
      );

    // Revoke assignments below threshold
    for (const assignment of contributor_micro_tasks) {
      if (assignment.total_micro_tasks < percentRequired * maxPerContributor) {
        for (const microTaskId of assignment.micro_task_ids) {
          const stat = micro_task_statistics.find(
            (s) => s.micro_task_id === microTaskId,
          );
          if (stat) stat.no_of_contributors--;
        }
        assignment.micro_task_ids = [];
      }
    }

    // Filter contributors with actual assignments
    const validNewAssignments = contributor_micro_tasks.filter(
      (c) => c.micro_task_ids.length > 0,
    );
    const invalidNewAssignments = contributor_micro_tasks.filter(
      (c) => c.micro_task_ids.length === 0,
    );
    // Find reusable contributors (who didn't start their task)
    const reusableContributors = existingAssignments.filter(
      (c) =>
        c.status === ContributorMicroTasksConstantStatus.NEW &&
        c.dead_line >= new Date(),
    );
    const completeButNotFullyAssignedContributors = existingAssignments.filter(
      (c) =>
        c.status === ContributorMicroTasksConstantStatus.COMPLETED &&
        c.micro_task_ids.length < maxPerContributor,
    );

    const contributorsToRevoke: { contributor_id: string; task_id: string }[] =
      [];

    for (
      let i = 0;
      i < invalidNewAssignments.length && i < reusableContributors.length;
      i++
    ) {
      const reusable = reusableContributors[i];
      const assignment = invalidNewAssignments[i];

      const startIdx = Math.min(
        reusable.current_batch,
        reusable.micro_task_ids.length,
      );
      const reassignedMicroTasks = reusable.micro_task_ids.slice(startIdx);

      if (reassignedMicroTasks.length === 0) continue;

      assignment.micro_task_ids = reassignedMicroTasks;
      assignment.status = ContributorMicroTasksConstantStatus.NEW;
      assignment.total_micro_tasks = reassignedMicroTasks.length;
      assignment.batch = reusable.batch;
      assignment.dead_line = deadline;

      contributorsToRevoke.push({
        contributor_id: reusable.contributor_id,
        task_id: taskId,
      });
    }
    for (let i = 0; i < completeButNotFullyAssignedContributors.length; i++) {
      const newIds: string[] = [];
      for (const microTask of microTaskStats) {
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
          maxPerContributor
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
      }
    }
    const revokedAndAssignedAssignments = invalidNewAssignments.filter(
      (c) => c.micro_task_ids.length > 0,
    );

    // Remove revoked contributors from original list
    const remainingAssignments = existingAssignments.filter(
      (c) =>
        !contributorsToRevoke.find(
          (r) => r.contributor_id === c.contributor_id,
        ),
    );
    // update the deadline for the remaining assignments
    if (deadline) {
      remainingAssignments.forEach((c) => {
        c.dead_line = deadline;
      });
    }

    // Build final list
    const finalAssignments = [
      ...remainingAssignments,
      ...validNewAssignments,
      ...completeButNotFullyAssignedContributors,
      ...revokedAndAssignedAssignments,
    ].map((c) => ({
      ...c,
      expected_micro_task_for_contributor: maxPerContributor,
      task_id: taskId,
    }));
    // Persist data
    await this.contributorMicroTaskService.upsertMany(
      finalAssignments,
      queryRunner,
    );
    await this.microTaskStatisticsService.upsertMany(
      microTaskStats,
      queryRunner,
    );
    await this.contributorMicroTaskService.removeMany(
      contributorsToRevoke,
      queryRunner,
    );
    await this.userScoreService.reduceNoneSubmitScore(
      contributorsToRevoke.map((c) => c.contributor_id),
      queryRunner,
    );
  }

  /**
   * Re-distributes micro-tasks among contributors for a gender-based task allocation.
   * Ensures tasks are assigned fairly according to contributor gender, max tasks per contributor,
   * and max contributors per micro-task. Handles revoking or reassigning contributors when needed.
   *
   * @param {ContributorMicroTasks[]} existingAssignments - Existing contributor task assignments.
   * @param {{ id: string; gender: string; score: number }[]} newContributorIds - List of new contributors with gender and score.
   * @param {string} taskId - The ID of the task for redistribution.
   * @param {MicroTaskStatistics[]} microTaskStats - Statistics for all micro-tasks in the task.
   * @param {number} maxPerContributor - Maximum micro-tasks that can be assigned to a contributor.
   * @param {number} maxContributorsPerMicroTask - Maximum contributors allowed per micro-task.
   * @param {number} batch - Number of micro-tasks per batch.
   * @param {TaskRequirement} taskRequirement - Task requirement details, including gender distribution.
   * @param {QueryRunner} queryRunner - TypeORM QueryRunner for transactional operations.
   * @param {number} [maxWaitingHours] - Optional maximum hours to set a deadline for task completion.
   *
   * @returns {Promise<void>} - Resolves when gender-based task redistribution and persistence are completed.
   *
   * @remarks
   * - Filters unfinished micro-tasks and distributes them among new contributors based on gender.
   * - Revokes assignments below the minimum threshold (percentRequired).
   * - Reassigns leftover micro-tasks from reusable contributors who didn't start their task.
   * - Ensures the final assignments respect gender quotas defined in task requirements.
   * - Updates deadlines for contributors if `maxWaitingHours` is provided.
   * - Reduce contributors who don't done their assigned task on time
   * - Persists the final assignments and updates micro-task statistics using the relevant services.
   */
  async reDistributeTaskGenderBased(
    existingAssignments: ContributorMicroTasks[],
    newContributorIds: { id: string; gender: string; score: number }[],
    taskId: string,
    microTaskStats: MicroTaskStatistics[],
    maxPerContributor: number,
    maxContributorsPerMicroTask: number,
    batch: number,
    taskRequirement: TaskRequirement,
    queryRunner: QueryRunner,
    maxWaitingHours?: number,
  ): Promise<void> {
    const deadline = maxWaitingHours
      ? new Date(Date.now() + maxWaitingHours * 60 * 60 * 1000)
      : undefined;
    const percentRequired = 0.5; // Assumed value — adjust as needed
    // Filter unfinished microtasks
    const undoneMicroTasks = microTaskStats.filter(
      (stat) => stat.no_of_contributors < stat.expected_no_of_contributors,
    );
    const male_percent_required =
      (taskRequirement.gender.male / 100) * maxContributorsPerMicroTask;
    const female_percent_required =
      (taskRequirement.gender.female / 100) * maxContributorsPerMicroTask;

    const { contributor_micro_tasks, micro_task_statistics } =
      distributeTaskAmongNewContributorsGenderBased(
        newContributorIds,
        undoneMicroTasks,
        taskId,
        maxPerContributor,
        maxContributorsPerMicroTask,
        batch,
        male_percent_required,
        female_percent_required,
        deadline,
      );

    // Revoke assignments below threshold
    for (const assignment of contributor_micro_tasks) {
      if (assignment.total_micro_tasks < percentRequired * maxPerContributor) {
        for (const microTaskId of assignment.micro_task_ids) {
          const stat = micro_task_statistics.find(
            (s) => s.micro_task_id === microTaskId,
          );
          if (stat) {
            stat.no_of_contributors--;
            if (assignment.gender == 'Male') {
              stat.total_male--;
            } else if (assignment.gender == 'Female') {
              stat.total_female--;
            }
          }
        }
        assignment.micro_task_ids = [];
      }
    }
    // contributors with no task
    // Filter contributors with actual assignments
    const validNewAssignments = contributor_micro_tasks.filter(
      (c) => c.micro_task_ids.length > 0,
    );
    const invalidNewAssignments = contributor_micro_tasks.filter(
      (c) => c.micro_task_ids.length === 0,
    );
    // Find reusable contributors (who didn't start their task)
    const reusableContributors = existingAssignments.filter(
      (c) =>
        c.status === ContributorMicroTasksConstantStatus.NEW &&
        c.dead_line >= new Date(),
    );
    // removable contributors
    const contributorsToRevoke: { contributor_id: string; task_id: string }[] =
      [];
    for (
      let i = 0;
      i < invalidNewAssignments.length && i < reusableContributors.length;
      i++
    ) {
      const reusable = reusableContributors[i];
      const assignment = invalidNewAssignments[i];
      const startIdx = Math.min(
        reusable.current_batch,
        reusable.micro_task_ids.length,
      );
      const reassignedMicroTasks = reusable.micro_task_ids.slice(startIdx);
      if (reassignedMicroTasks.length === 0) continue;

      if (reusable.gender == assignment.gender) {
        assignment.micro_task_ids = reassignedMicroTasks;
        assignment.status = ContributorMicroTasksConstantStatus.NEW;
        assignment.total_micro_tasks = reassignedMicroTasks.length;
        assignment.batch = reusable.batch;
        assignment.dead_line = deadline;

        contributorsToRevoke.push({
          contributor_id: reusable.contributor_id,
          task_id: taskId,
        });
      }
    }
    // filter contributors_with_no_task
    const revokedAndAssignedAssignments = invalidNewAssignments.filter(
      (c) => c.micro_task_ids.length > 0,
    );

    // Remove the contributors
    // Remove revoked contributors from original list
    const remainingAssignments = existingAssignments.filter(
      (c) =>
        !contributorsToRevoke.find(
          (r) => r.contributor_id === c.contributor_id,
        ),
    );
    // update the deadline for the remaining assignments
    if (deadline) {
      remainingAssignments.forEach((c) => {
        c.dead_line = deadline;
      });
    }

    //  The new built array
    // Build final list
    const validNewAssignmentWithGender = validNewAssignments.map((c) => ({
      micro_task_ids: c.micro_task_ids,
      status: c.status,
      gender: c.contributor_id.gender,
      total_micro_tasks: c.total_micro_tasks,
      batch: c.batch,
      dead_line: c.dead_line,
      contributor_id: c.contributor_id.id,
    }));
    const revokedAndAssignedAssignmentsWithGender =
      revokedAndAssignedAssignments.map((c) => ({
        micro_task_ids: c.micro_task_ids,
        status: c.status,
        gender: c.contributor_id.gender,
        total_micro_tasks: c.total_micro_tasks,
        batch: c.batch,
        dead_line: c.dead_line,
        contributor_id: c.contributor_id.id,
      }));
    const finalAssignments: Partial<ContributorMicroTasks>[] = [
      ...remainingAssignments,
      ...validNewAssignmentWithGender,
      ...revokedAndAssignedAssignmentsWithGender,
    ].map((c) => ({
      ...c,
      expected_micro_task_for_contributor: maxPerContributor,
      task_id: taskId,
    }));

    // Update or Insert the updated Contributed List
    // Persist data
    await this.contributorMicroTaskService.upsertMany(
      finalAssignments,
      queryRunner,
    );
    await this.microTaskStatisticsService.upsertMany(
      microTaskStats,
      queryRunner,
    );
    await this.contributorMicroTaskService.removeMany(
      contributorsToRevoke,
      queryRunner,
    );
    await this.userScoreService.reduceNoneSubmitScore(
      contributorsToRevoke.map((c) => c.contributor_id),
      queryRunner,
    );
    return;
  }
}
