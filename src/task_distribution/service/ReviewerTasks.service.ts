import { InjectRepository } from '@nestjs/typeorm';
import { ReviewerTasks } from '../enitities/ReviewerTasks.entity';
import { LessThan, MoreThan, QueryRunner, Repository } from 'typeorm';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task } from 'src/project/entities/Task.entity';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { randomUUID } from 'crypto';
import { NotificationService } from 'src/common/service/Notification.service';

@Injectable()
export class ReviewerTaskService {
  constructor(
    @InjectRepository(ReviewerTasks)
    private readonly reviewerTaskRepository: Repository<ReviewerTasks>,
    private readonly notificationService: NotificationService,
  ) {}

  async getReviewerTasks(
    reviewerId: string,
    taskId: string,
  ): Promise<string[]> {
    const tasks: ReviewerTasks | null =
      await this.reviewerTaskRepository.findOne({
        where: {
          reviewer_id: reviewerId,
          task_id: taskId,
          expire_date: MoreThan(new Date()),
        },
      });
    if (tasks) {
      return tasks.data_set_ids;
    }
    return [];
  }
  /**
   * Returns all the tasks assigned to a reviewer
   * @param reviewerId the id of the reviewer
   * @returns an array of tasks assigned to the reviewer
   */
  async getAssignedTasks(taskId: string) {
    const tasks: ReviewerTasks[] = await this.reviewerTaskRepository.find({
      where: { task_id: taskId },
    });
    if (tasks) {
      let assignedDataSets: string[] = [];
      for (const task of tasks) {
        assignedDataSets = [...assignedDataSets, ...task.data_set_ids];
      }
      return assignedDataSets;
    }
    return [];
  }

  /**
   * Removes a data set from the reviewer's tasks and updates the reviewer's wallet and the contributor's user task status.
   * @throws UnauthorizedException If the reviewer is not assigned to this task.
   * @throws UnauthorizedException If the reviewer is not assigned to this data set.
   */
  async checkAndRemoveDataSetFromReviewer(
    reviewerId: string,
    taskId: string,
    dataSetId: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const manager = queryRunner.manager;
    const reviewerTask = await this.assertAssignedDataSet(
      reviewerId,
      taskId,
      dataSetId,
      queryRunner,
    );
    const leftDataSets = reviewerTask.data_set_ids.filter(
      (d) => d !== dataSetId,
    );
    await manager.update(
      ReviewerTasks,
      { id: reviewerTask.id },
      { data_set_ids: leftDataSets },
    );
    return;
  }

  async assertAssignedDataSet(
    reviewerId: string,
    taskId: string,
    dataSetId: string,
    queryRunner: QueryRunner,
  ): Promise<ReviewerTasks> {
    const reviewerTask = await queryRunner.manager
      .createQueryBuilder(ReviewerTasks, 'reviewer_task')
      .setLock('pessimistic_write')
      .where('reviewer_task.reviewer_id = :reviewerId', { reviewerId })
      .andWhere('reviewer_task.task_id = :taskId', { taskId })
      .andWhere(':dataSetId = ANY(reviewer_task.data_set_ids)', { dataSetId })
      .andWhere('reviewer_task.expire_date > NOW()')
      .getOne();
    if (!reviewerTask) {
      throw new UnauthorizedException(
        'Reviewer is not assigned to this dataset',
      );
    }
    return reviewerTask;
  }

  /**
   * Distributes pending task data sets among reviewers while respecting
   * reviewer limits, previously reviewed data, and existing active assignments.
   *
   * This method:
   * - Loads existing (non-expired) reviewer assignments for the task
   * - Creates reviewer-task records for reviewers without active assignments
   * - Determines unassigned data sets
   * - Assigns data sets to reviewers up to the maximum allowed per reviewer
   * - Avoids reassigning already reviewed or assigned data sets
   * - Persists reviewer assignments
   * - Sends notifications to reviewers for newly assigned submissions
   *
   * Assignment rules:
   * - A reviewer cannot exceed `max_dataset_per_reviewer`
   * - Previously reviewed submissions count toward the limit
   * - Only pending and unassigned data sets are distributed
   * - Assignments stop once all pending data sets are allocated
   *
   * @param {Task} task
   *  The task for which data sets are being distributed.
   *
   * @param {string[]} allPendingDataSetIds
   *  List of IDs representing all pending (unassigned) data sets.
   *
   * @param {DataSet[]} reviewedDataSets
   *  Data sets that have already been reviewed, used to calculate reviewer capacity.
   *
   * @param {string[]} reviewerIds
   *  List of reviewer user IDs eligible to receive assignments.
   *
   * @returns {Promise<void>}
   *  Resolves once assignments are saved and notifications are sent.
   */
  async distributeTaskForReviewers(
    task: Task,
    allPendingDataSetIds: string[],
    reviewedDataSets: DataSet[],
    reviewerIds: string[],
  ) {
    const allReviewerAssignedDataSets = await this.reviewerTaskRepository.find({
      where: {
        task_id: task.id,
        expire_date: MoreThan(new Date()),
      },
    });
    let reviewerAssignedDataSets: ReviewerTasks[] = [];
    reviewerAssignedDataSets = [...allReviewerAssignedDataSets];
    for (let index = 0; index < reviewerIds.length; index++) {
      if (
        !reviewerAssignedDataSets.find(
          (rT) => rT.reviewer_id == reviewerIds[index],
        )
      ) {
        const reviewerTask = new ReviewerTasks();
        reviewerTask.id = randomUUID();
        reviewerTask.task_id = task.id;
        reviewerTask.reviewer_id = reviewerIds[index];
        reviewerTask.data_set_ids = [];
        reviewerTask.expire_date = new Date(
          Date.now() +
            task.reviewer_completion_time_limit * 24 * 60 * 60 * 1000,
        );
        reviewerAssignedDataSets.push(reviewerTask);
      }
    }

    const allAssignedDataSets = allReviewerAssignedDataSets
      .map((r) => r.data_set_ids)
      .flat();
    const unAssignedDataSets = allPendingDataSetIds.filter(
      (d) => !allAssignedDataSets.includes(d),
    );
    const maxDataSetPerReviewer = task.taskRequirement.max_dataset_per_reviewer;
    let start = 0;
    const title = 'New Task Assignment';
    const notifications: {
      user_id: string;
      message: string;
    }[] = [];
    for (const reviewerAssignedDataSet of reviewerAssignedDataSets) {
      const totalUserReviewedDataSets = reviewedDataSets.filter(
        (dS) => dS.reviewer_id == reviewerAssignedDataSet.reviewer_id,
      ).length;

      const canBeAssigned =
        maxDataSetPerReviewer -
        (totalUserReviewedDataSets +
          reviewerAssignedDataSet.data_set_ids.length);
      if (canBeAssigned <= 0) {
        continue;
      }
      const maxCutIndex = Math.min(
        unAssignedDataSets.length,
        start + canBeAssigned,
      );
      const newDataSetIds = unAssignedDataSets.slice(start, maxCutIndex);
      start += maxCutIndex;
      const dataSetIds = [
        ...new Set([...reviewerAssignedDataSet.data_set_ids, ...newDataSetIds]),
      ];
      reviewerAssignedDataSet.data_set_ids = dataSetIds;

      const message = `You have been assigned ${newDataSetIds.length} submissions to review  on task ${task.name}. Please login to your account to start working on it.`;
      if (start >= unAssignedDataSets.length) break;

      notifications.push({
        user_id: reviewerAssignedDataSet.reviewer_id,
        message: message,
      });
    }
    reviewerAssignedDataSets = reviewerAssignedDataSets.filter(
      (rT) => rT.data_set_ids.length > 0,
    );
    await this.reviewerTaskRepository.save(reviewerAssignedDataSets);
    await Promise.all(
      notifications.map(async (notification) => {
        await this.notificationService.create({
          user_id: notification.user_id,
          title,
          message: notification.message,
          type: 'task-assign',
        });
      }),
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  /**
   * Delete expired tasks from the reviewer task repository.
   * @param {expireDate} the date before which all tasks should be deleted.
   * @return {Promise<void>} The promise that resolves when all tasks are deleted.
   */
  async deleteExpiredTasks() {
    return this.reviewerTaskRepository.delete({
      expire_date: LessThan(new Date()),
    });
  }
}
