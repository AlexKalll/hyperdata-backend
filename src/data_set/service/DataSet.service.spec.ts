jest.mock('./MicroTask.service', () => ({
  MicroTaskService: class MicroTaskService {},
}));

jest.mock('src/project/service/Task.service', () => ({
  TaskService: class TaskService {},
}));

jest.mock('src/project/service/UserTask.service', () => ({
  UserTaskService: class UserTaskService {},
}));

jest.mock('./RejectionReason.service', () => ({
  RejectionReasonService: class RejectionReasonService {},
}));

jest.mock('src/common/service/File.service', () => ({
  FileService: class FileService {},
}));

jest.mock('src/base_data/service/DataSetAnnotation.service', () => ({
  DataSetAnnotationService: class DataSetAnnotationService {},
}));

jest.mock('src/cache/CacheService.service', () => ({
  CacheService: class CacheService {},
}));

jest.mock('src/task_distribution/service/ReviewerTasks.service', () => ({
  ReviewerTaskService: class ReviewerTaskService {},
}));

import { QueryRunner } from 'typeorm';
import { DataSetService } from './DataSet.service';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';
import { DataSetType } from 'src/utils/constants/Task.constant';

describe('DataSetService', () => {
  let service: DataSetService;
  let dataSetRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let paginateService: { paginateWithOptionQuery: jest.Mock };
  let fileService: {
    getPreSignedUrl: jest.Mock;
    getPreSignedDatasets: jest.Mock;
  };
  let dataSetAnnotationService: { findOne: jest.Mock };
  let cacheService: {
    updateDataSetFilPathAndQueueStatus: jest.Mock;
    updateDataSetStatus: jest.Mock;
  };
  let rejectionReasonService: { createBulk: jest.Mock };

  beforeEach(() => {
    dataSetRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    paginateService = { paginateWithOptionQuery: jest.fn() };
    fileService = {
      getPreSignedUrl: jest.fn(),
      getPreSignedDatasets: jest.fn(),
    };
    dataSetAnnotationService = { findOne: jest.fn() };
    cacheService = {
      updateDataSetFilPathAndQueueStatus: jest.fn(),
      updateDataSetStatus: jest.fn(),
    };
    rejectionReasonService = { createBulk: jest.fn() };

    service = new DataSetService(
      dataSetRepository as any,
      {} as any,
      {} as any,
      {} as any,
      paginateService as any,
      rejectionReasonService as any,
      fileService as any,
      dataSetAnnotationService as any,
      cacheService as any,
      { assertAssignedDataSet: jest.fn().mockResolvedValue({}) } as any,
    );
    (service as any).paginateService = paginateService;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should generate a dataset code and save through the repository', async () => {
      dataSetRepository.create.mockImplementation((data) => data);
      dataSetRepository.save.mockImplementation(async (data) => data);

      const created = await service.create({ text_data_set: 'hello' });

      expect(dataSetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          text_data_set: 'hello',
          code: expect.stringMatching(/^DAT-/),
        }),
      );
      expect(created).toEqual(
        expect.objectContaining({
          text_data_set: 'hello',
          code: expect.stringMatching(/^DAT-/),
        }),
      );
    });

    it('should save through the query runner when one is provided', async () => {
      const manager = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation(async (_entity, data) => data),
      };
      const queryRunner = { manager } as unknown as QueryRunner;

      const created = await service.create(
        { text_data_set: 'hello' },
        queryRunner,
      );

      expect(manager.create).toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalled();
      expect(created.code).toMatch(/^DAT-/);
    });
  });

  describe('createMultipleTextDataSet', () => {
    it('should no-op when the input is empty', async () => {
      const queryRunner = {
        manager: { save: jest.fn() },
      } as unknown as QueryRunner;

      await expect(
        service.createMultipleTextDataSet([], 'contributor-1', queryRunner),
      ).resolves.toBeUndefined();
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('should assign dataset metadata before saving', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const queryRunner = {
        manager: { save },
      } as unknown as QueryRunner;

      await service.createMultipleTextDataSet(
        [
          {
            micro_task_id: 'mt-1',
            text_data_set: 'sample',
            dialect_id: 'dialect-1',
            language_id: 'language-1',
            is_test: false,
          },
        ],
        'contributor-1',
        queryRunner,
      );

      expect(save).toHaveBeenCalledWith(expect.anything(), [
        expect.objectContaining({
          micro_task_id: 'mt-1',
          contributor_id: 'contributor-1',
          type: DataSetType.TEXT,
          code: expect.stringMatching(/^DAT-/),
        }),
      ]);
    });
  });

  describe('createMultipleAudioDataSet', () => {
    it('should assign audio dataset metadata and queue status', async () => {
      dataSetRepository.create.mockImplementation((data) => data);
      const save = jest.fn().mockResolvedValue([{ id: 'ds-1' }]);
      const queryRunner = { manager: { save } } as unknown as QueryRunner;

      await service.createMultipleAudioDataSet(
        [
          {
            micro_task_id: 'mt-1',
            file_path: 'audio.wav',
            dialect_id: 'dialect-1',
            language_id: 'language-1',
            is_test: true,
            audio_duration: 12,
          },
        ],
        'contributor-1',
        queryRunner,
      );

      expect(dataSetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          file_path: 'audio.wav',
          contributor_id: 'contributor-1',
          type: DataSetType.AUDIO,
          queue_status: 'pending',
          code: expect.stringMatching(/^DAT-/),
        }),
      );
      expect(save).toHaveBeenCalled();
    });
  });

  describe('createAudioDataSet', () => {
    it('should persist a single audio dataset with contributor metadata', async () => {
      const manager = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation(async (_entity, data) => data),
      };
      const queryRunner = { manager } as unknown as QueryRunner;

      const created = await service.createAudioDataSet(
        {
          micro_task_id: 'mt-1',
          file_path: 'audio.wav',
          audio_duration: 12,
          dialect_id: 'dialect-1',
          language_id: 'language-1',
          is_test: true,
        },
        'contributor-1',
        queryRunner,
      );

      expect(manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          micro_task_id: 'mt-1',
          file_path: 'audio.wav',
          contributor_id: 'contributor-1',
          type: DataSetType.AUDIO,
          is_test: true,
          code: expect.stringMatching(/^DAT-/),
        }),
      );
      expect(created.code).toMatch(/^DAT-/);
    });
  });

  describe('validateSubmission', () => {
    it('should reject when a contributor already has a non-rejected submission', async () => {
      await expect(
        service.validateSubmission(
          [{ status: DataSetStatus.PENDING } as any],
          'contributor-1',
          1,
        ),
      ).rejects.toThrow('You already have contributed to this micro task');
    });

    it('should reject when the retry limit has been exceeded', async () => {
      await expect(
        service.validateSubmission(
          [
            { status: DataSetStatus.REJECTED } as any,
            { status: DataSetStatus.Flagged } as any,
          ],
          'contributor-1',
          1,
        ),
      ).rejects.toThrow('Maximum retry amount reached !');
    });

    it('should allow valid retry cases', async () => {
      await expect(
        service.validateSubmission(
          [{ status: DataSetStatus.REJECTED } as any],
          'contributor-1',
          1,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should query the repository with normalized options', async () => {
      dataSetRepository.find.mockResolvedValue(['dataset']);

      await expect(
        service.findAll({ where: { contributor_id: 'user-1' } } as any),
      ).resolves.toEqual(['dataset']);

      expect(dataSetRepository.find).toHaveBeenCalledWith({
        where: { contributor_id: 'user-1' },
        order: {},
        relations: [],
      });
    });

    it('should query through the query runner when provided', async () => {
      const find = jest.fn().mockResolvedValue(['dataset']);
      const queryRunner = { manager: { find } } as unknown as QueryRunner;

      await expect(
        service.findAll(
          { where: { contributor_id: 'user-1' } } as any,
          queryRunner,
        ),
      ).resolves.toEqual(['dataset']);
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contributor_id: 'user-1' } }),
      );
    });
  });

  describe('findPaginate', () => {
    it('should presign audio file paths and normalize dataset results', async () => {
      const paginated = {
        result: [
          { id: 'ds-1', type: 'audio', file_path: 'audio.wav' },
          { id: 'ds-2', type: 'text', file_path: 'text.txt' },
        ],
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      paginateService.paginateWithOptionQuery.mockResolvedValue(paginated);
      fileService.getPreSignedUrl.mockImplementation(
        async (path) => `signed:${path}`,
      );
      fileService.getPreSignedDatasets.mockImplementation(
        async (datasets) => datasets,
      );

      const result = await service.findPaginate(
        { where: { contributor_id: 'user-1' } },
        { page: 1, limit: 10 },
      );

      expect(paginateService.paginateWithOptionQuery).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        'data_set',
        { where: { contributor_id: 'user-1' } },
      );
      expect(fileService.getPreSignedUrl).toHaveBeenCalledWith('audio.wav');
      expect(fileService.getPreSignedDatasets).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ file_path: 'signed:audio.wav' }),
        ]),
      );
      expect(result.result[0].file_path).toBe('signed:audio.wav');
    });
  });

  describe('findOne', () => {
    it('should presign audio datasets returned from the repository', async () => {
      dataSetRepository.findOne.mockResolvedValue({
        id: 'ds-1',
        type: 'audio',
        file_path: 'audio.wav',
      });
      fileService.getPreSignedUrl.mockResolvedValue('signed:audio.wav');

      const result = await service.findOne({ where: { id: 'ds-1' } });

      expect(fileService.getPreSignedUrl).toHaveBeenCalledWith('audio.wav');
      expect(result).toMatchObject({ file_path: 'signed:audio.wav' });
    });

    it('should delegate to the query runner manager when provided', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValue({ id: 'ds-2', type: 'audio' });
      const queryRunner = { manager: { findOne } } as unknown as QueryRunner;

      await expect(
        service.findOne({ where: { id: 'ds-2' } } as any, queryRunner),
      ).resolves.toEqual({ id: 'ds-2', type: 'audio' });
      expect(findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ where: { id: 'ds-2' } }),
      );
      expect(fileService.getPreSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('updateQueueStatus', () => {
    it('should update the dataset and refresh cache metadata when found', async () => {
      dataSetRepository.update.mockResolvedValue(undefined);
      dataSetRepository.findOne.mockResolvedValue({
        id: 'ds-1',
        contributor_id: 'user-1',
        micro_task_id: 'mt-1',
        microTask: { task_id: 'task-1' },
      });

      await service.updateQueueStatus('ds-1', 'completed', 'uploads/audio.wav');

      expect(dataSetRepository.update).toHaveBeenCalledWith('ds-1', {
        queue_status: 'completed',
        file_path: 'uploads/audio.wav',
      });
      expect(
        cacheService.updateDataSetFilPathAndQueueStatus,
      ).toHaveBeenCalledWith(
        'user-1',
        'task-1',
        'ds-1',
        'mt-1',
        'uploads/audio.wav',
      );
    });

    it('should skip cache updates when the dataset can no longer be found', async () => {
      dataSetRepository.update.mockResolvedValue(undefined);
      dataSetRepository.findOne.mockResolvedValue(null);

      await service.updateQueueStatus('ds-1', 'failed', 'missing.wav');

      expect(
        cacheService.updateDataSetFilPathAndQueueStatus,
      ).not.toHaveBeenCalled();
    });
  });

  describe('approveDataSet', () => {
    it('should reject unknown annotations', async () => {
      dataSetAnnotationService.findOne.mockResolvedValue(null);
      const queryRunner = {
        manager: { update: jest.fn() },
      } as unknown as QueryRunner;

      await expect(
        service.approveDataSet('ds-1', 'reviewer-1', queryRunner, 'bad-label'),
      ).rejects.toThrow("Annotation with name  bad-label doesn't exist");
    });

    it('should reject missing datasets', async () => {
      const queryRunner = {
        manager: { update: jest.fn() },
      } as unknown as QueryRunner;
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(
        service.approveDataSet('ds-1', 'reviewer-1', queryRunner),
      ).rejects.toThrow('Data set not found');
    });

    it('should reject datasets that are already approved', async () => {
      const queryRunner = {
        manager: { update: jest.fn() },
      } as unknown as QueryRunner;
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'ds-1',
        status: DataSetStatus.APPROVED,
      } as any);

      await expect(
        service.approveDataSet('ds-1', 'reviewer-1', queryRunner),
      ).rejects.toThrow('Data set already approved');
    });

    it('should update approval state and cache when the dataset is valid', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const queryRunner = { manager: { update } } as unknown as QueryRunner;
      dataSetAnnotationService.findOne.mockResolvedValue({ name: 'approved' });
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'ds-1',
        status: DataSetStatus.PENDING,
        contributor_id: 'user-1',
        micro_task_id: 'mt-1',
        microTask: { task_id: 'task-1', task: { payment: {} } },
        contributor: { userDeviceTokens: [] },
      } as any);

      await expect(
        service.approveDataSet('ds-1', 'reviewer-1', queryRunner, 'approved'),
      ).resolves.toBeUndefined();

      expect(cacheService.updateDataSetStatus).toHaveBeenCalledWith(
        'user-1',
        'task-1',
        'mt-1',
        'Approved',
      );
      expect(update).toHaveBeenCalledWith(expect.anything(), 'ds-1', {
        status: DataSetStatus.APPROVED,
        reviewer_id: 'reviewer-1',
        annotation: 'approved',
      });
    });
  });

  describe('checkMicroTaskOpenForDataSet', () => {
    it('should allow submissions when there is no task requirement', async () => {
      await expect(service.checkMicroTaskOpenForDataSet('mt-1')).resolves.toBe(
        true,
      );
    });

    it('should return false when the microtask is already full', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([{}, {}] as any);

      await expect(
        service.checkMicroTaskOpenForDataSet('mt-1', {
          max_contributor_per_micro_task: 2,
        } as any),
      ).resolves.toBe(false);
    });

    it('should return true when the microtask still has available capacity', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([{}] as any);

      await expect(
        service.checkMicroTaskOpenForDataSet('mt-1', {
          max_contributor_per_micro_task: 2,
        } as any),
      ).resolves.toBe(true);
    });
  });
});
