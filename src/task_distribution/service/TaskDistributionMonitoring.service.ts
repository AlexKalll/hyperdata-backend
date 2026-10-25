import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MicroTaskStatisticsService } from './MicroTaskStatistics.service';
import { ContributorMicroTaskService } from './ContributorMicroTask.service';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { DataSetService } from 'src/data_set/service/DataSet.service';
import { ReviewerTaskService } from './ReviewerTasks.service';
import { paginate, PaginatedResult } from 'src/utils/paginate.util';
import { UserTaskService } from 'src/project/service/UserTask.service';
import {
  TaskDataSetReviewerDistributionRto,
  TaskReviewersProgressRto,
} from '../rto/TaskMonitoring.rto';

@Injectable()
export class TaskDistributionMonitoringService {
  constructor(
    private readonly microTaskStatisticsService: MicroTaskStatisticsService,
    private readonly contributorMicroTaskService: ContributorMicroTaskService,
    private readonly dataSetService: DataSetService,
    private readonly userTaskService: UserTaskService,
    private readonly reviewerTaskService: ReviewerTaskService,
    private readonly dataSource: DataSource,
  ) {}
  async findCurrentTaskAssignedContributors(task_id: string) {}
  async getTaskDistributionStatistics(task_id: string) {
    // get total contributor microtask grouped by their status
    const contributorMicroTasksGroupedByStatus =
      await this.contributorMicroTaskService.getTotalContributorsGroupedByStatus(
        task_id,
      );

    // get language statistics and dialect statistics
    const languageStatistics =
      await this.contributorMicroTaskService.getContributorLanguageAndDialectDistributionStatistics(
        task_id,
      );
    // get gender statistics
    const genderStatistics =
      await this.contributorMicroTaskService.getContributorGenderDistributionStatistics(
        task_id,
      );
    // get total distributed and undestributed microtasks
    const microTaskGroupedStatistics =
      await this.microTaskStatisticsService.getGroupedMicroTaskStatisticsByNumberOfContributors(
        task_id,
      );
    return {
      total_contributor_micro_tasks: contributorMicroTasksGroupedByStatus,
      total_micro_tasks: microTaskGroupedStatistics,
      language_statistics: languageStatistics,
      gender_statistics: genderStatistics,
    };
  }
  async getTaskAssignedContributors(
    task_id: string,
    paginationDto: PaginationDto,
  ) {
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const offset = (page - 1) * limit;
    return this.contributorMicroTaskService.getTaskContributors(
      task_id,
      paginationDto,
    );
  }
  async getMicroTaskStatisticsByTaskId(
    task_id: string,
    paginationDto: PaginationDto,
  ) {
    return this.microTaskStatisticsService.getMicroTaskStatisticsByTaskId(
      task_id,
      paginationDto,
    );
  }
  /**
   * Retrieves the distribution status of a task's data sets for reviewers.
   * This method returns the total number of data sets assigned to reviewers,
   * the total number of data sets reviewed by reviewers, and the total number
   * of data sets remaining to be assigned to reviewers.
   * @param {string} task_id - Unique identifier of the task.
   * @returns {Promise<TaskDataSetReviewerDistributionRto>} - Task data set distribution status for reviewers.
   */
  async getTaskDataSetDistributionStatusForReviewers(
    task_id: string,
  ): Promise<TaskDataSetReviewerDistributionRto> {
    const allDataSets = await this.dataSetService.findAll({
      where: {
        microTask: {
          task: {
            id: task_id,
          },
        },
      },
    });
    const assignedIds = new Set(
      await this.reviewerTaskService.getAssignedTasks(task_id),
    );
    const totalReviewedDataSets = allDataSets.filter(
      (dS) => dS.status !== 'Pending',
    ).length;
    const pendingDataSets = allDataSets.filter((dS) => dS.status === 'Pending');
    // Count actual pending datasets, not duplicate, expired or reviewed IDs
    // left in assignment records.
    const totalAssignedDataSets = pendingDataSets.filter((dataSet) =>
      assignedIds.has(dataSet.id),
    ).length;
    const totalUnAssignedDataSets = pendingDataSets.filter(
      (dataSet) => !assignedIds.has(dataSet.id),
    ).length;

    return {
      totalAssignedDataSets,
      totalReviewedDataSets,
      totalUnAssignedDataSets,
    };
  }
  /**
   * Retrieves reviewer progress statistics for a given task.
   * @param {string} task_id - Task ID
   * @param {PaginationDto} paginationDto - Pagination parameters
   * @returns {Promise<PaginatedResult<TaskReviewersProgressRto>>} - Paginated reviewer progress statistics
   */
  async getTaskReviewerStats(
    task_id: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<TaskReviewersProgressRto>> {
    const taskMembers = await this.userTaskService.findPaginate(
      {
        where: { task_id: task_id, role: 'Reviewer' },
        relations: { user: true },
      },
      paginationDto,
    );
    if (!taskMembers) {
      throw new BadRequestException('Task not found');
    }
    if (taskMembers.result.length === 0) {
      return paginate([], 0, 1, 10);
    }
    const reviewerIds = taskMembers.result.map((r) => r.user_id);
    const reviewerStat = await this.dataSource.query(
      `
        SELECT 
            u.id AS reviewer_id,
            u.first_name AS first_name,  -- optional, if you have a name column
            u.last_name AS last_name,    -- optional, if you have a name column
            u.phone_number AS phone_number,
            COALESCE(d.reviewed_count, 0) AS reviewed_count,
            COALESCE(rt.pending_count, 0) AS pending_count
          FROM users u
          LEFT JOIN (
            SELECT 
              rt.reviewer_id,
              COUNT(DISTINCT ds.id) AS pending_count
            FROM task_distribution.reviewer_tasks rt
            CROSS JOIN LATERAL unnest(rt.data_set_ids) AS assigned(data_set_id)
            INNER JOIN data_set ds ON ds.id::text = assigned.data_set_id
            INNER JOIN micro_task mt ON mt.id = ds.micro_task_id
            WHERE rt.task_id = $2 AND mt.task_id = $2
              AND rt.expire_date > NOW() AND ds.status = 'Pending'
            GROUP BY rt.reviewer_id
          ) rt ON rt.reviewer_id = u.id
          LEFT JOIN (
  SELECT 
    ds.reviewer_id, 
    COUNT(*) AS reviewed_count
  FROM data_set ds
  INNER JOIN micro_task mt ON mt.id = ds.micro_task_id 
  WHERE mt.task_id = $2 AND ds.status <> 'Pending'
  GROUP BY ds.reviewer_id
) d ON d.reviewer_id = u.id
          WHERE u.id = ANY($1);
        `,
      [reviewerIds, task_id],
    );
    return paginate(
      reviewerStat,
      taskMembers.total,
      taskMembers.page,
      taskMembers.limit,
    );
  }
}
