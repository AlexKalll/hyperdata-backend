jest.mock('./MicroTaskStatistics.service', () => ({
  MicroTaskStatisticsService: class {},
}));
jest.mock('src/data_set/service/DataSet.service', () => ({
  DataSetService: class {},
}));
jest.mock('./ContributorMicroTask.service', () => ({
  ContributorMicroTaskService: class {},
}));
jest.mock('src/project/service/Task.service', () => ({
  TaskService: class {},
}));
jest.mock('src/auth/service/User.service', () => ({ UserService: class {} }));
jest.mock('src/common/service/Notification.service', () => ({
  NotificationService: class {},
}));
jest.mock('./ReviewerTasks.service', () => ({ ReviewerTaskService: class {} }));
jest.mock('src/cache/CacheService.service', () => ({ CacheService: class {} }));

import { Role } from 'src/auth/decorators/roles.enum';
import { TaskDistributionService } from './TaskDistribution.service';

describe('TaskDistributionService reviewer selection', () => {
  it('loads active reviewer memberships directly before distribution', async () => {
    const taskService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'task-id',
        name: 'Review task',
        taskRequirement: { max_dataset_per_reviewer: 4 },
      }),
      findAllTaskMembers: jest
        .fn()
        .mockResolvedValue([{ user_id: 'reviewer-id' }]),
    };
    const dataSetService = {
      findAll: jest
        .fn()
        .mockResolvedValue([{ id: 'dataset-id', status: 'Pending' }]),
    };
    const reviewerTaskService = {
      distributeTaskForReviewers: jest.fn(),
    };
    const service = new TaskDistributionService(
      {} as any,
      dataSetService as any,
      {} as any,
      taskService as any,
      {} as any,
      {} as any,
      reviewerTaskService as any,
      {} as any,
    );

    await service.distributeTaskForReviewers('task-id');

    expect(taskService.findAllTaskMembers).toHaveBeenCalledWith('task-id', {
      where: { role: Role.REVIEWER },
    });
    expect(reviewerTaskService.distributeTaskForReviewers).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-id' }),
      ['dataset-id'],
      [],
      ['reviewer-id'],
    );
  });
});
