jest.mock('./MicroTaskStatistics.service', () => ({
  MicroTaskStatisticsService: class {},
}));
jest.mock('./ContributorMicroTask.service', () => ({
  ContributorMicroTaskService: class {},
}));
jest.mock('src/project/service/Task.service', () => ({
  TaskService: class {},
}));
jest.mock('src/auth/service/User.service', () => ({ UserService: class {} }));
jest.mock('src/auth/service/UserScore.service', () => ({
  UserScoreService: class {},
}));
jest.mock('src/cache/CacheService.service', () => ({ CacheService: class {} }));

import { TaskRedistributionService } from './TaskRedistribution.service';

describe('TaskRedistributionService cache consistency', () => {
  let service: TaskRedistributionService;
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
  };
  let cacheService: { clearContributorTaskCache: jest.Mock };

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    cacheService = { clearContributorTaskCache: jest.fn() };

    service = new TaskRedistributionService(
      { findAll: jest.fn().mockResolvedValue([]) } as any,
      {
        findAll: jest
          .fn()
          .mockResolvedValue([{ contributor_id: 'existing-contributor' }]),
      } as any,
      {
        findAll: jest.fn().mockResolvedValue([
          {
            id: 'task-id',
            is_public: false,
            require_contributor_test: false,
            max_expected_no_of_contributors: 2,
            contributor_completion_time_limit: 24,
            taskRequirement: {
              batch: 2,
              max_micro_task_per_contributor: 2,
              max_contributor_per_micro_task: 1,
              is_gender_specific: false,
            },
          },
        ]),
        findAllTaskMembers: jest
          .fn()
          .mockResolvedValue([
            { user: { id: 'existing-contributor', gender: 'female' } },
            { user: { id: 'new-contributor', gender: 'male' } },
          ]),
      } as any,
      {} as any,
      {} as any,
      { createQueryRunner: jest.fn().mockReturnValue(queryRunner) } as any,
      cacheService as any,
    );
  });

  it('clears list and detail caches for affected contributors after commit', async () => {
    jest.spyOn(service, 'reDistributeTask').mockResolvedValue();

    await service.initializeTaskRedistribution();

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(cacheService.clearContributorTaskCache).toHaveBeenCalledTimes(2);
    expect(cacheService.clearContributorTaskCache).toHaveBeenCalledWith(
      'existing-contributor',
      'task-id',
    );
    expect(cacheService.clearContributorTaskCache).toHaveBeenCalledWith(
      'new-contributor',
      'task-id',
    );
  });

  it('does not clear caches when redistribution rolls back', async () => {
    jest
      .spyOn(service, 'reDistributeTask')
      .mockRejectedValue(new Error('redistribution failed'));
    jest.spyOn(console, 'error').mockImplementation();

    await service.initializeTaskRedistribution();

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(cacheService.clearContributorTaskCache).not.toHaveBeenCalled();
  });
});
