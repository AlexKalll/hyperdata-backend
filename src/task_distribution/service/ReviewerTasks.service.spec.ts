jest.mock('src/common/service/Notification.service', () => ({
  NotificationService: class {},
}));

import { FindOperator } from 'typeorm';
import { ReviewerTaskService } from './ReviewerTasks.service';
import { Task } from 'src/project/entities/Task.entity';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { ReviewerTasks } from '../enitities/ReviewerTasks.entity';

describe('ReviewerTaskService distribution', () => {
  let repository: {
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let notificationService: { create: jest.Mock };
  let service: ReviewerTaskService;

  const task = {
    id: 'task-id',
    name: 'Review task',
    reviewer_completion_time_limit: 1,
    taskRequirement: { max_dataset_per_reviewer: 4 },
  } as Task;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      save: jest.fn().mockImplementation(async (assignments) => assignments),
      delete: jest.fn(),
    };
    notificationService = { create: jest.fn() };
    service = new ReviewerTaskService(
      repository as any,
      notificationService as any,
    );
  });

  it('reassigns data sets held by a user who is not an eligible reviewer', async () => {
    repository.find.mockResolvedValue([
      {
        id: 'stale-assignment',
        task_id: 'task-id',
        reviewer_id: 'facilitator-id',
        data_set_ids: ['dataset-1', 'dataset-2'],
        expire_date: new Date(Date.now() + 60_000),
      },
    ]);

    await service.distributeTaskForReviewers(
      task,
      ['dataset-1', 'dataset-2'],
      [],
      ['reviewer-id'],
    );

    const savedAssignments = repository.save.mock.calls[0][0];
    expect(savedAssignments).toHaveLength(1);
    expect(savedAssignments[0]).toEqual(
      expect.objectContaining({
        task_id: 'task-id',
        reviewer_id: 'reviewer-id',
        data_set_ids: ['dataset-1', 'dataset-2'],
      }),
    );
    const deleteCriteria = repository.delete.mock.calls[0][0] as {
      id: FindOperator<string>;
    };
    expect(deleteCriteria.id.value).toEqual(['stale-assignment']);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'reviewer-id' }),
    );
  });

  it('assigns every pending data set across three reviewers', async () => {
    repository.find.mockResolvedValue([]);
    const onePerReviewerTask = {
      ...task,
      taskRequirement: { max_dataset_per_reviewer: 1 },
    } as Task;

    await service.distributeTaskForReviewers(
      onePerReviewerTask,
      ['dataset-1', 'dataset-2', 'dataset-3'],
      [],
      ['reviewer-1', 'reviewer-2', 'reviewer-3'],
    );

    const savedAssignments = repository.save.mock.calls[0][0];
    expect(
      savedAssignments.flatMap((assignment) => assignment.data_set_ids),
    ).toEqual(['dataset-1', 'dataset-2', 'dataset-3']);
    expect(notificationService.create).toHaveBeenCalledTimes(3);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('keeps an empty active reviewer assignment for future retries', async () => {
    repository.find.mockResolvedValue([]);

    await service.distributeTaskForReviewers(task, [], [], ['reviewer-id']);

    expect(repository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        reviewer_id: 'reviewer-id',
        data_set_ids: [],
      }),
    ]);
  });

  it('attaches a retry to the reviewer of the rejected attempt', async () => {
    const reviewerTask = {
      id: 'reviewer-task-id',
      task_id: 'task-id',
      reviewer_id: 'reviewer-id',
      data_set_ids: [],
      expire_date: new Date(Date.now() + 60_000),
    };
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(reviewerTask),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      update: jest.fn(),
    };

    await service.assignRetryDataSetsToPreviousReviewers(
      'task-id',
      [{ id: 'retry-dataset-id', micro_task_id: 'micro-task-id' }],
      [
        {
          micro_task_id: 'micro-task-id',
          status: 'Rejected',
          reviewer_id: 'reviewer-id',
        },
      ],
      { manager } as any,
    );

    expect(manager.update).toHaveBeenNthCalledWith(
      1,
      ReviewerTasks,
      { id: 'reviewer-task-id' },
      { data_set_ids: ['retry-dataset-id'] },
    );
    expect(manager.update).toHaveBeenNthCalledWith(
      2,
      DataSet,
      'retry-dataset-id',
      { reviewer_id: 'reviewer-id' },
    );
  });
});
