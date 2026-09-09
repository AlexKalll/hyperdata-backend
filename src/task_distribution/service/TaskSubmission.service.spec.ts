jest.mock('./ContributorMicroTask.service', () => ({
  ContributorMicroTaskService: class {},
}));
jest.mock('src/project/service/Task.service', () => ({
  TaskService: class {},
}));
jest.mock('src/auth/service/User.service', () => ({ UserService: class {} }));
jest.mock('src/data_set/service/MicroTask.service', () => ({
  MicroTaskService: class {},
}));
jest.mock('src/project/service/UserTask.service', () => ({
  UserTaskService: class {},
}));
jest.mock('src/cache/CacheService.service', () => ({ CacheService: class {} }));
jest.mock('src/data_set/service/RejectionReason.service', () => ({
  RejectionReasonService: class {},
}));
jest.mock('src/common/service/File.service', () => ({ FileService: class {} }));
jest.mock('src/base_data/service/DataSetAnnotation.service', () => ({
  DataSetAnnotationService: class {},
}));
jest.mock('./ReviewerTasks.service', () => ({ ReviewerTaskService: class {} }));

import { TaskSubmissionService } from './TaskSubmission.service';
import { DataSetService } from 'src/data_set/service/DataSet.service';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';
import { taskTypes, UserTaskStatus } from 'src/utils/constants/Task.constant';
import { ContributorMicroTasksConstantStatus } from 'src/utils/constants/ContributorMicroTasks.constant';

describe.each(['text', 'audio'] as const)('%s submissions', (kind) => {
  let service: TaskSubmissionService;
  let history: { id: string; micro_task_id: string; status: string }[];
  let assignment: {
    id: string;
    micro_task_ids: string[];
    current_batch: number;
    batch: number;
    total_micro_tasks: number;
  };
  let dataSets: {
    findAll: jest.Mock;
    validateSubmission: jest.Mock;
    createMultipleTextDataSet: jest.Mock;
    createMultipleAudioDataSet: jest.Mock;
  };
  let contributorTasks: { findOne: jest.Mock; update: jest.Mock };
  let taskService: {
    findOne: jest.Mock;
    updateOrCreateUserToPending: jest.Mock;
  };
  let microTasks: { id: string; is_test: boolean }[];
  let runner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
  };
  let task: {
    taskType: { task_type: string };
    taskRequirement: { max_retry_per_task: number };
  };

  beforeEach(() => {
    history = [];
    assignment = {
      id: 'assignment',
      micro_task_ids: ['mt-1', 'mt-2', 'mt-3'],
      current_batch: 0,
      batch: 3,
      total_micro_tasks: 3,
    };
    microTasks = assignment.micro_task_ids.map((id) => ({
      id,
      is_test: false,
    }));
    task = {
      taskType: {
        task_type:
          kind === 'text' ? taskTypes.TEXT_TO_TEXT : taskTypes.TEXT_TO_AUDIO,
      },
      taskRequirement: { max_retry_per_task: 1 },
    };
    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    dataSets = {
      // Honor the projection so missing status/micro_task_id regressions fail.
      findAll: jest
        .fn()
        .mockImplementation(async ({ select }) =>
          history.map((row) =>
            Object.fromEntries(
              Object.keys(select).map((key) => [key, row[key]]),
            ),
          ),
        ),
      validateSubmission: jest.fn(DataSetService.prototype.validateSubmission),
      createMultipleTextDataSet: jest.fn(),
      createMultipleAudioDataSet: jest.fn(),
    };
    contributorTasks = {
      findOne: jest.fn().mockImplementation(async () => assignment),
      update: jest.fn(),
    };
    taskService = {
      findOne: jest.fn().mockResolvedValue(task),
      updateOrCreateUserToPending: jest.fn(),
    };
    service = new TaskSubmissionService(
      dataSets as any,
      contributorTasks as any,
      taskService as any,
      { createQueryRunner: () => runner } as any,
      {
        findOne: jest.fn().mockResolvedValue({
          dialect_id: 'dialect',
          language_id: 'language',
        }),
      } as any,
      {
        findAll: jest
          .fn()
          .mockImplementation(async ({ where }) =>
            where.id.value.map((id: string) =>
              microTasks.find((microTask) => microTask.id === id),
            ),
          ),
      } as any,
      { findOneOrCreate: jest.fn() } as any,
      { clearContributorTaskCache: jest.fn() } as any,
    );
  });

  const submit = (ids: string[]) =>
    kind === 'text'
      ? service.submitMultipleTextDatasets(
          'user',
          ids.map((micro_task_id) => ({
            micro_task_id,
            text_data_set: 'text',
          })),
          'task',
        )
      : service.submitMultipleAudioDatasets(
          'user',
          ids.map((micro_task_id) => ({
            micro_task_id,
            file_path: 'audio.wav',
            audio_duration: 1,
          })),
          'task',
        );

  it('counts a partial fresh request, not the configured batch size', async () => {
    await submit(['mt-1']);
    expect(contributorTasks.update).toHaveBeenCalledWith(
      'assignment',
      expect.objectContaining({
        current_batch: 1,
        status: ContributorMicroTasksConstantStatus.IN_PROGRESS,
      }),
      runner,
    );
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('creates a pending contributor task for a text test submission', async () => {
    if (kind !== 'text') return;

    microTasks[0].is_test = true;
    await service.submitMultipleTextDatasets(
      'user',
      [{ micro_task_id: 'mt-1', text_data_set: 'test response' }],
      'task',
      true,
    );

    expect(taskService.updateOrCreateUserToPending).toHaveBeenCalledWith(
      {
        task_id: 'task',
        user_id: 'user',
        role: 'Contributor',
        status: UserTaskStatus.PENDING,
      },
      runner,
    );
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('marks the assignment completed after the final fresh submissions', async () => {
    assignment.current_batch = 1;
    await submit(['mt-2', 'mt-3']);
    expect(contributorTasks.update).toHaveBeenCalledWith(
      'assignment',
      expect.objectContaining({
        current_batch: 3,
        status: ContributorMicroTasksConstantStatus.COMPLETED,
      }),
      runner,
    );
  });

  it.each([1, 3])(
    'preserves progress and deadline on a rejected retry at progress %s',
    async (progress) => {
      assignment.current_batch = progress;
      history.push({
        id: 'old',
        micro_task_id: 'mt-1',
        status: DataSetStatus.REJECTED,
      });
      await submit(['mt-1']);
      expect(contributorTasks.update).not.toHaveBeenCalled();
      expect(
        dataSets[
          kind === 'text'
            ? 'createMultipleTextDataSet'
            : 'createMultipleAudioDataSet'
        ],
      ).toHaveBeenCalled();
      expect(runner.commitTransaction).toHaveBeenCalled();
    },
  );

  it('validates retry limits separately for each microtask', async () => {
    assignment.current_batch = 2;
    history.push(
      ...['mt-1', 'mt-2'].map((micro_task_id) => ({
        id: micro_task_id,
        micro_task_id,
        status: DataSetStatus.REJECTED,
      })),
    );
    await submit(['mt-1', 'mt-2']);
    expect(dataSets.validateSubmission).toHaveBeenNthCalledWith(
      1,
      [history[0]],
      'user',
      1,
    );
    expect(dataSets.validateSubmission).toHaveBeenNthCalledWith(
      2,
      [history[1]],
      'user',
      1,
    );
    expect(contributorTasks.update).not.toHaveBeenCalled();
  });

  it('counts only fresh microtasks in a mixed retry request', async () => {
    assignment.current_batch = 1;
    history.push({
      id: 'old',
      micro_task_id: 'mt-1',
      status: DataSetStatus.REJECTED,
    });
    await submit(['mt-1', 'mt-2']);
    expect(contributorTasks.update).toHaveBeenCalledWith(
      'assignment',
      expect.objectContaining({ current_batch: 2 }),
      runner,
    );
  });

  it.each([DataSetStatus.PENDING, DataSetStatus.APPROVED])(
    'rejects an existing %s attempt before writing any requested datasets',
    async (status) => {
      history.push({ id: 'old', micro_task_id: 'mt-1', status });
      await expect(submit(['mt-1', 'mt-2'])).rejects.toThrow(
        'You already have contributed',
      );
      expect(runner.startTransaction).not.toHaveBeenCalled();
      expect(dataSets.createMultipleTextDataSet).not.toHaveBeenCalled();
      expect(dataSets.createMultipleAudioDataSet).not.toHaveBeenCalled();
    },
  );

  it('rejects retries beyond the per-microtask limit', async () => {
    history.push(
      ...['old-1', 'old-2'].map((id) => ({
        id,
        micro_task_id: 'mt-1',
        status: DataSetStatus.REJECTED,
      })),
    );
    await expect(submit(['mt-1'])).rejects.toThrow(
      'Maximum retry amount reached',
    );
    expect(runner.startTransaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate microtask IDs within a request', async () => {
    await expect(submit(['mt-1', 'mt-1'])).rejects.toThrow(
      'only be submitted once per request',
    );
    expect(runner.startTransaction).not.toHaveBeenCalled();
  });

  it('rolls back without updating progress when dataset creation fails', async () => {
    dataSets[
      kind === 'text'
        ? 'createMultipleTextDataSet'
        : 'createMultipleAudioDataSet'
    ].mockRejectedValue(new Error('save failed'));
    await expect(submit(['mt-1'])).rejects.toThrow('save failed');
    expect(contributorTasks.update).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });
});
