jest.mock('src/config/minio.config', () => ({
  multerAudioS3Storage: {},
  multerCSVS3Storage: {},
  multerImageS3Storage: {},
}));

import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MicroTaskController } from './MicroTask.controller';

describe('MicroTaskController', () => {
  let controller: MicroTaskController;
  let microTaskService: Record<string, jest.Mock>;
  let fileService: Record<string, jest.Mock>;
  let activityLogService: { create: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
  };

  beforeEach(() => {
    microTaskService = {
      createTextMicroTask: jest.fn(),
      importMicroTaskFromOtherTask: jest.fn(),
      importMicroTaskFromOtherTaskDataset: jest.fn(),
      getContributorParticipatedDataSets: jest.fn(),
    };
    fileService = {};
    activityLogService = { create: jest.fn() };
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };

    controller = new MicroTaskController(
      microTaskService as any,
      fileService as any,
      activityLogService as any,
      {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      } as unknown as DataSource,
    );
  });

  it('should create text microtasks and log the action', async () => {
    microTaskService.createTextMicroTask.mockResolvedValue({ id: 'mt-1' });

    await expect(
      controller.create(
        { task_id: 'task-1', instruction: 'Read this' } as any,
        {
          user: { id: 'user-1' },
          ip: '127.0.0.1',
          headers: { 'user-agent': 'jest' },
        } as any,
      ),
    ).resolves.toEqual({ id: 'mt-1' });

    expect(microTaskService.createTextMicroTask).toHaveBeenCalledWith({
      task_id: 'task-1',
      instruction: 'Read this',
      type: 'text',
      created_by: 'user-1',
    });
    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        entity_id: 'mt-1',
      }),
    );
  });

  it('should import microtasks from another task and commit the transaction', async () => {
    microTaskService.importMicroTaskFromOtherTask.mockResolvedValue([
      { id: 'mt-1' },
      { id: 'mt-2' },
    ]);

    await expect(
      controller.importFromOtherTask(
        'task-1',
        { source_task_id: 'task-2', from_micro_task: true, limit: 2 } as any,
        { user: { id: 'user-1' } } as any,
      ),
    ).resolves.toBe('Imported 2 Micro Tasks from Task ID: task-2');

    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(microTaskService.importMicroTaskFromOtherTask).toHaveBeenCalledWith(
      'task-1',
      'task-2',
      'user-1',
      queryRunner,
      2,
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('should rollback and wrap import errors', async () => {
    microTaskService.importMicroTaskFromOtherTaskDataset.mockRejectedValue(
      new Error('boom'),
    );

    await expect(
      controller.importFromOtherTask(
        'task-1',
        { source_task_id: 'task-2', from_micro_task: false, limit: 2 } as any,
        { user: { id: 'user-1' } } as any,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Error importing micro tasks from other task: boom',
      ),
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('should forward contributor submission lookups to the service', async () => {
    microTaskService.getContributorParticipatedDataSets.mockResolvedValue({
      result: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });

    await expect(
      controller.getContributorParticipatedDataSets(
        'task-1',
        { page: 1, limit: 10 } as any,
        { user: { id: 'user-1' } } as any,
      ),
    ).resolves.toEqual({
      result: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });

    expect(
      microTaskService.getContributorParticipatedDataSets,
    ).toHaveBeenCalledWith('user-1', 'task-1', { page: 1, limit: 10 });
  });
});
