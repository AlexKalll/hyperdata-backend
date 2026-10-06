jest.mock('src/project/service/Task.service', () => ({
  TaskService: class TaskService {},
}));

jest.mock('src/common/service/File.service', () => ({
  FileService: class FileService {},
}));

jest.mock('src/project/service/UserTask.service', () => ({
  UserTaskService: class UserTaskService {},
}));

jest.mock('src/auth/service/User.service', () => ({
  UserService: class UserService {},
}));

import { MicroTaskService } from './MicroTask.service';
import { taskTypes } from 'src/utils/constants/Task.constant';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';

describe('MicroTaskService', () => {
  let service: MicroTaskService;
  let microTaskRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let taskService: { findOne: jest.Mock };
  let fileService: { getPreSignedUrl: jest.Mock };

  beforeEach(() => {
    microTaskRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    taskService = { findOne: jest.fn() };
    fileService = { getPreSignedUrl: jest.fn() };

    service = new MicroTaskService(
      microTaskRepository as any,
      taskService as any,
      {} as any,
      fileService as any,
      {} as any,
      {} as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createTextMicroTask', () => {
    it('should reject missing tasks', async () => {
      taskService.findOne.mockResolvedValue(null);

      await expect(
        service.createTextMicroTask({ task_id: 'task-1' } as any),
      ).rejects.toThrow('Task not found');
    });

    it('should reject invalid task types', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.AUDIO_TO_TEXT },
      });

      await expect(
        service.createTextMicroTask({ task_id: 'task-1' } as any),
      ).rejects.toThrow('Invalid task type');
    });

    it('should reject test tasks when contributor tests are disabled', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.TEXT_TO_TEXT },
        require_contributor_test: false,
      });

      await expect(
        service.createTextMicroTask({
          task_id: 'task-1',
          is_test: true,
        } as any),
      ).rejects.toThrow('Contributor test is not required for this task');
    });

    it('should save valid text microtasks with generated codes', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.TEXT_TO_TEXT },
        require_contributor_test: true,
      });
      jest.spyOn(service, 'generateCode').mockResolvedValue('PMT-00000001');
      microTaskRepository.create.mockImplementation((data) => data);
      microTaskRepository.save.mockImplementation(async (data) => data);

      await expect(
        service.createTextMicroTask({
          task_id: 'task-1',
          is_test: false,
        } as any),
      ).resolves.toEqual(
        expect.objectContaining({
          task_id: 'task-1',
          code: 'PMT-00000001',
        }),
      );
    });
  });

  describe('createMultipleTextMicroTask', () => {
    it('should reject missing tasks', async () => {
      taskService.findOne.mockResolvedValue(null);

      await expect(
        service.createMultipleTextMicroTask([], 'task-1'),
      ).rejects.toThrow('Task not found');
    });

    it('should reject invalid task types', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.AUDIO_TO_TEXT },
      });

      await expect(
        service.createMultipleTextMicroTask([], 'task-1'),
      ).rejects.toThrow('Invalid task type');
    });
  });

  describe('createAudioMicroTask', () => {
    it('should reject invalid audio task types', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.TEXT_TO_TEXT },
        require_contributor_test: true,
      });

      await expect(
        service.createAudioMicroTask({ task_id: 'task-1' } as any),
      ).rejects.toThrow('Invalid task type');
    });

    it('should reject test audio tasks when contributor tests are disabled', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.AUDIO_TO_TEXT },
        require_contributor_test: false,
      });

      await expect(
        service.createAudioMicroTask({
          task_id: 'task-1',
          is_test: true,
        } as any),
      ).rejects.toThrow('Contributor test is not required for this task');
    });

    it('should save valid audio microtasks with generated codes', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.AUDIO_TO_TEXT },
        require_contributor_test: true,
      });
      jest.spyOn(service, 'generateCode').mockResolvedValue('PMT-00000002');
      microTaskRepository.create.mockImplementation((data) => data);
      microTaskRepository.save.mockImplementation(async (data) => data);

      await expect(
        service.createAudioMicroTask({
          task_id: 'task-1',
          is_test: false,
        } as any),
      ).resolves.toEqual(
        expect.objectContaining({
          task_id: 'task-1',
          type: 'audio',
          code: 'PMT-00000002',
        }),
      );
    });
  });

  describe('getContributorParticipatedDataSets', () => {
    function buildQueryBuilder(result: unknown) {
      return {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue(result),
      };
    }

    it('should reject missing tasks', async () => {
      taskService.findOne.mockResolvedValue(null);

      await expect(
        service.getContributorParticipatedDataSets('user-1', 'task-1', {
          page: 1,
          limit: 10,
        } as any),
      ).rejects.toThrow('Task not found');
    });

    it('should calculate retry state and presign audio microtask files', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.AUDIO_TO_TEXT },
        taskRequirement: { max_retry_per_task: 1 },
      });
      fileService.getPreSignedUrl.mockImplementation(
        async (path) => `signed:${path}`,
      );
      const queryBuilder = buildQueryBuilder([
        [
          {
            id: 'mt-1',
            code: 'PMT-1',
            file_path: 'audio.wav',
            type: 'audio',
            status: 'Open',
            is_test: false,
            instruction: 'Read',
            text: '',
            created_date: new Date(),
            dataSets: [
              {
                id: 'ds-1',
                code: 'DAT-1',
                status: DataSetStatus.REJECTED,
                is_test: false,
                file_path: 'audio.wav',
                type: 'audio',
                created_date: new Date(),
                rejectionReasons: [],
                flagReason: [],
              },
            ],
          },
        ],
        1,
      ]);
      microTaskRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getContributorParticipatedDataSets(
        'user-1',
        'task-1',
        { page: 1, limit: 10 },
      );

      expect(fileService.getPreSignedUrl).toHaveBeenCalledWith('audio.wav');
      expect(result.result[0]).toMatchObject({
        file_path: 'signed:audio.wav',
        current_retry: 1,
        allowed_retry: 1,
        acceptance_status: DataSetStatus.REJECTED,
        can_retry: true,
      });
    });

    it('should presign dataset file paths for text-to-audio tasks', async () => {
      taskService.findOne.mockResolvedValue({
        taskType: { task_type: taskTypes.TEXT_TO_AUDIO },
        taskRequirement: { max_retry_per_task: 1 },
      });
      fileService.getPreSignedUrl.mockImplementation(
        async (path) => `signed:${path}`,
      );
      const queryBuilder = buildQueryBuilder([
        [
          {
            id: 'mt-2',
            code: 'PMT-2',
            file_path: 'prompt.txt',
            type: 'text',
            status: 'Open',
            is_test: false,
            instruction: 'Record',
            text: 'Hello',
            created_date: new Date(),
            dataSets: [
              {
                id: 'ds-2',
                code: 'DAT-2',
                status: DataSetStatus.APPROVED,
                is_test: false,
                file_path: 'output.wav',
                type: 'audio',
                created_date: new Date(),
                rejectionReasons: [],
                flagReason: [],
              },
            ],
          },
        ],
        1,
      ]);
      microTaskRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getContributorParticipatedDataSets(
        'user-1',
        'task-1',
        { page: 1, limit: 10 },
      );

      expect(fileService.getPreSignedUrl).toHaveBeenCalledWith('output.wav');
      expect(result.result[0].dataSets[0]).toMatchObject({
        file_path: 'signed:output.wav',
      });
    });
  });
});
