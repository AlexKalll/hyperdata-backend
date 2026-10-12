import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';
import { UserTaskStatus } from 'src/utils/constants/Task.constant';
import { GetTasksService } from './GetTask.service';

describe('GetTasksService contributor exam flow', () => {
  let service: GetTasksService;
  let taskService: { findOne: jest.Mock };
  let microTaskService: {
    findAllTestMicroTasks: jest.Mock;
  };

  const makeTask = (is_public: boolean) => ({
    id: 'task-1',
    name: 'Contributor exam task',
    description: 'Complete the exam first',
    is_public,
    require_contributor_test: true,
    taskType: { task_type: 'text-text' },
    taskRequirement: {
      max_retry_per_task: 3,
      minimum_seconds: 0,
      maximum_seconds: 0,
      minimum_characters_length: 1,
      maximum_characters_length: 100,
      max_micro_task_per_contributor: 1,
      appriximate_time_per_batch: 1,
    },
    taskInstructions: [],
    payment: { contributor_credit_per_microtask: 1 },
  });

  const examMicroTask = {
    id: 'test-1',
    instruction: 'Answer the exam question',
    file_path: '',
    text: 'Exam question',
    type: 'text',
    dataSets: [],
  };
  const secondExamMicroTask = {
    ...examMicroTask,
    id: 'test-2',
    text: 'Second exam question',
  };

  beforeEach(() => {
    taskService = { findOne: jest.fn() };
    microTaskService = {
      findAllTestMicroTasks: jest
        .fn()
        .mockResolvedValue([examMicroTask, secondExamMicroTask]),
    };
    service = new GetTasksService(
      { findOne: jest.fn() } as never,
      taskService as never,
      { findOne: jest.fn() } as never,
      microTaskService as never,
      {
        findOne: jest
          .fn()
          .mockResolvedValue({ status: UserTaskStatus.PENDING }),
      } as never,
      {
        getContributorTaskMicroTasks: jest.fn().mockResolvedValue(null),
        writeContributorTaskMicroTasks: jest.fn(),
      } as never,
    );
  });

  it.each([
    { visibility: 'private', isPublic: false },
    { visibility: 'public', isPublic: true },
  ])(
    'returns the exam for a pending $visibility task before submission',
    async ({ isPublic }) => {
      taskService.findOne.mockResolvedValue(makeTask(isPublic));

      const response = await service.getContributorTaskMicroTasks(
        'contributor-1',
        'task-1',
      );

      expect(response.is_test).toBe(true);
      expect(response.has_passed).toBe('PENDING');
      expect(response.contributorMicroTask.map(({ id }) => id)).toEqual([
        'test-1',
        'test-2',
      ]);
    },
  );

  it('keeps submitted public exam work in the test-review state', async () => {
    taskService.findOne.mockResolvedValue(makeTask(true));
    microTaskService.findAllTestMicroTasks.mockResolvedValue([
      {
        ...examMicroTask,
        dataSets: [
          {
            id: 'dataset-1',
            status: DataSetStatus.PENDING,
            contributor_id: 'contributor-1',
            text_data_set: 'Answer',
            rejectionReasons: [],
            flagReason: [],
          },
        ],
      },
      secondExamMicroTask,
    ]);

    const response = await service.getContributorTaskMicroTasks(
      'contributor-1',
      'task-1',
    );

    expect(response.is_test).toBe(true);
    expect(response.has_passed).toBe('UNDER_REVIEW');
    expect(response.contributorMicroTask).toHaveLength(2);
    expect(
      response.contributorMicroTask.find(({ id }) => id === 'test-1')
        ?.acceptance_status,
    ).toBe('PENDING');
    expect(
      response.contributorMicroTask.find(({ id }) => id === 'test-2')
        ?.acceptance_status,
    ).toBe('NOT_STARTED');
  });

  it('lets a contributor continue an exam after a partial submission is approved', async () => {
    taskService.findOne.mockResolvedValue(makeTask(false));
    microTaskService.findAllTestMicroTasks.mockResolvedValue([
      {
        ...examMicroTask,
        dataSets: [
          {
            id: 'dataset-1',
            status: DataSetStatus.APPROVED,
            contributor_id: 'contributor-1',
            text_data_set: 'Answer',
            rejectionReasons: [],
            flagReason: [],
          },
        ],
      },
      secondExamMicroTask,
    ]);

    const response = await service.getContributorTaskMicroTasks(
      'contributor-1',
      'task-1',
    );

    expect(response.has_passed).toBe('PENDING');
    expect(response.contributorMicroTask).toHaveLength(2);
    expect(
      response.contributorMicroTask.find(({ id }) => id === 'test-1')
        ?.acceptance_status,
    ).toBe('APPROVED');
    expect(
      response.contributorMicroTask.find(({ id }) => id === 'test-2')
        ?.acceptance_status,
    ).toBe('NOT_STARTED');
  });
});
