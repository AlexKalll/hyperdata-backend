import { ApiProperty } from '@nestjs/swagger';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { TaskInstruction } from 'src/project/entities/TaskInstruction.entity';

export class ContributorDataSetRto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  text_data_set: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  audio_duration: number;

  @ApiProperty()
  file_path: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  annotation: string;

  @ApiProperty({ type: 'array', isArray: true })
  rejectionReasons: string[];

  @ApiProperty({ isArray: true })
  flagReasons: string[];

  @ApiProperty({})
  comment: string;

  @ApiProperty({})
  isQueued: boolean;
  static from(dataSet: DataSet): ContributorDataSetRto {
    return {
      id: dataSet.id,
      text_data_set: dataSet.text_data_set,
      status: dataSet.status,
      audio_duration: dataSet.audio_duration,
      file_path: dataSet.file_path,
      type: dataSet.type,
      annotation: dataSet.annotation,
      rejectionReasons: dataSet.rejectionReasons
        ? dataSet?.rejectionReasons.map(
            (rejectionReason) => rejectionReason.rejectionType?.name,
          )
        : [],
      flagReasons: dataSet.flagReason
        ? dataSet?.flagReason.map(
            (flagReason) => flagReason.reason || flagReason.comment,
          )
        : [],
      isQueued: dataSet.queue_status === 'pending',
      comment:
        dataSet.rejectionReasons && dataSet.rejectionReasons.length > 0
          ? dataSet.rejectionReasons[0].comment
          : '',
    };
  }
}
export class ContributorMicroTaskRto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  instruction: string;

  @ApiProperty()
  file_path: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  current_retry: number;

  @ApiProperty()
  allowed_retry: number;

  @ApiProperty()
  acceptance_status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'NOT_STARTED';

  @ApiProperty()
  can_retry: boolean;

  @ApiProperty({ type: ContributorDataSetRto })
  dataSet?: ContributorDataSetRto;

  static from(
    microTask: {
      id: string;
      instruction: string;
      file_path: string;
      text: string;
      type: string;
      dataSets?: DataSet[];
    },
    metadata: {
      current_retry: number;
      allowed_retry: number;
      acceptance_status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'NOT_STARTED';
      can_retry: boolean;
    },
  ): ContributorMicroTaskRto {
    const hasDataSet = false;
    let dataSet: DataSet | undefined = undefined;
    if (microTask.dataSets && microTask.dataSets.length > 0) {
      dataSet = microTask.dataSets[microTask.dataSets.length - 1];
    }
    return {
      id: microTask.id,
      instruction: microTask.instruction,
      file_path: microTask.file_path,
      text: microTask.text,
      type: microTask.type,
      dataSet: dataSet ? ContributorDataSetRto.from(dataSet) : undefined,
      current_retry: metadata.current_retry,
      allowed_retry: metadata.allowed_retry,
      acceptance_status: metadata.acceptance_status,
      can_retry: metadata.can_retry,
    };
  }
  static fromSelf(data: any): ContributorMicroTaskRto {
    return {
      id: data.id,
      instruction: data.instruction,
      file_path: data.file_path,
      text: data.text,
      type: data.type,
      current_retry: data.current_retry,
      allowed_retry: data.allowed_retry,
      acceptance_status: data.acceptance_status,
      can_retry: data.can_retry,
      dataSet: data.dataSet,
    };
  }
}
export class ContributorTaskRTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  is_public: boolean;

  @ApiProperty()
  require_contributor_test: boolean;

  @ApiProperty()
  is_closed: boolean;

  @ApiProperty()
  is_archived: boolean;

  @ApiProperty()
  distribution_started: boolean;

  @ApiProperty()
  project_id: string;
  @ApiProperty()
  task_type: string;
  @ApiProperty({ type: [ContributorMicroTaskRto] })
  microTasks: ContributorMicroTaskRto[];
  @ApiProperty()
  taskInstruction: string;
}
export class TaskInstructionRto {
  @ApiProperty()
  title: string;
  @ApiProperty()
  content: string;
  @ApiProperty()
  image_instruction_url: string;
  @ApiProperty()
  video_instruction_url: string;
  @ApiProperty()
  audio_instruction_url: string;

  static from(instruction: TaskInstruction): TaskInstructionRto {
    return {
      title: instruction.title,
      content: instruction.content,
      image_instruction_url: instruction.image_instruction_url,
      video_instruction_url: instruction.video_instruction_url,
      audio_instruction_url: instruction.audio_instruction_url,
    };
  }
}
export class TaskMicroTasksResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  task_type: string;

  @ApiProperty({ type: [ContributorMicroTaskRto] })
  contributorMicroTask: ContributorMicroTaskRto[];

  @ApiProperty({
    enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'FLAGGED'],
  })
  has_passed: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

  @ApiProperty()
  is_test: boolean;

  @ApiProperty({ type: TaskInstructionRto })
  taskInstruction?: TaskInstructionRto;

  @ApiProperty()
  minimum_seconds?: number;

  @ApiProperty()
  maximum_seconds?: number;

  @ApiProperty()
  minimum_characters_length?: number;

  @ApiProperty()
  maximum_characters_length?: number;

  @ApiProperty()
  estimated_earning: number | null;

  @ApiProperty()
  earning_per_task: number | null;

  @ApiProperty()
  average_time: number | null;

  @ApiProperty()
  dead_line?: Date;

  @ApiProperty()
  batch: number | null;
  static from(task: {
    id: string;
    name: string;
    description: string;
    taskType: {
      task_type: string;
    };
    contributorMicroTask: ContributorMicroTaskRto[];
    has_passed:
      'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
    is_test: boolean;
    taskInstruction: TaskInstructionRto | undefined;
    minimum_seconds: number;
    maximum_seconds: number;
    minimum_characters_length: number;
    maximum_characters_length: number;
    estimated_earning: number;
    earning_per_task: number;
    average_time: number;
    deadline: Date | null;
    batch: number | null;
  }) {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      task_type: task.taskType.task_type,
      contributorMicroTask: task.contributorMicroTask,
      has_passed: task.has_passed,
      is_test: task.is_test,
      taskInstruction: task.taskInstruction,
      minimum_seconds: task.minimum_seconds,
      maximum_seconds: task.maximum_seconds,
      minimum_characters_length: task.minimum_characters_length,
      maximum_characters_length: task.maximum_characters_length,
      estimated_earning: task.estimated_earning,
      earning_per_task: task.earning_per_task,
      average_time: task.average_time,
      deadline: task.deadline,
      batch: task.batch,
    };
  }
}

export class TaskStatus {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  is_public: boolean;

  @ApiProperty()
  require_contributor_test: boolean;

  @ApiProperty()
  is_closed: boolean;

  @ApiProperty()
  is_archived: boolean;

  @ApiProperty()
  distribution_started: boolean;

  @ApiProperty()
  task_type: string;

  @ApiProperty()
  done_count: number;
  @ApiProperty()
  total_count: number;

  @ApiProperty()
  dead_line?: Date;

  @ApiProperty()
  average_time: number;

  static fromSelf(data: any) {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      is_public: data.is_public,
      require_contributor_test: data.require_contributor_test,
      is_closed: data.is_closed,
      is_archived: data.is_archived,
      distribution_started: data.distribution_started,
      task_type: data.task_type,
      done_count: data.done_count,
      total_count: data.total_count,
      dead_line: data.dead_line,
      average_time: data.average_time,
    };
  }
}
export class RecentTaskRto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  is_public: boolean;

  @ApiProperty()
  require_contributor_test: boolean;

  @ApiProperty()
  is_closed: boolean;

  @ApiProperty()
  is_archived: boolean;

  @ApiProperty()
  distribution_started: boolean;

  @ApiProperty()
  task_type: string;

  @ApiProperty()
  taskInstruction: string;

  @ApiProperty()
  done_count: number;
  @ApiProperty()
  total_count: number;

  @ApiProperty()
  rejected_count: number;

  @ApiProperty()
  approved_count: number;

  @ApiProperty()
  pending_count: number;

  @ApiProperty()
  dead_line?: Date;

  @ApiProperty()
  status: string;

  static fromSelf(data: any) {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      is_public: data.is_public,
      require_contributor_test: data.require_contributor_test,
      is_closed: data.is_closed,
      is_archived: data.is_archived,
      distribution_started: data.distribution_started,
      task_type: data.task_type,
      taskInstruction: data.taskInstruction,
      done_count: data.done_count,
      total_count: data.total_count,
      rejected_count: data.rejected_count,
      approved_count: data.approved_count,
      pending_count: data.pending_count,
      dead_line: data.dead_line,
      status: data.status,
    };
  }
}
export class ContributorTaskRto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  is_public: boolean;

  @ApiProperty()
  require_contributor_test: boolean;

  @ApiProperty()
  task_type: string;

  @ApiProperty()
  done_count: number;

  @ApiProperty()
  total_count: number;

  @ApiProperty()
  rejected_count: number;

  @ApiProperty()
  approved_count: number;

  @ApiProperty()
  pending_count: number;

  @ApiProperty()
  dead_line?: Date;

  @ApiProperty({
    enum: [
      'REJECTED',
      'TEST_REJECTED',
      'UNDER_REVIEW',
      'TEST_UNDER_REVIEW',
      'NEW',
      'COMPLETED',
    ],
  })
  status:
    | 'REJECTED'
    | 'TEST_REJECTED'
    | 'UNDER_REVIEW'
    | 'TEST_UNDER_REVIEW'
    | 'NEW'
    | 'COMPLETED';

  @ApiProperty()
  average_time: number | null;

  @ApiProperty()
  estimated_earning: number | null;

  @ApiProperty()
  earning_per_task: number | null;
  static fromSelf(data: any) {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      is_public: data.is_public,
      require_contributor_test: data.require_contributor_test,
      is_closed: data.is_closed,
      is_archived: data.is_archived,
      distribution_started: data.distribution_started,
      task_type: data.task_type,
      done_count: data.done_count,
      total_count: data.total_count,
      rejected_count: data.rejected_count,
      approved_count: data.approved_count,
      pending_count: data.pending_count,
      dead_line: data.dead_line,
      status: data.status,
      average_time: data.average_time,
      estimated_earning: data.estimated_earning,
      earning_per_task: data.earning_per_task,
    };
  }
}
export class ContributorRecentTaskRto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  is_public: boolean;

  @ApiProperty()
  require_contributor_test: boolean;

  @ApiProperty()
  is_closed: boolean;

  @ApiProperty()
  is_archived: boolean;

  @ApiProperty()
  distribution_started: boolean;

  @ApiProperty()
  task_type: string;

  @ApiProperty()
  done_count: number;
  @ApiProperty()
  total_count: number;

  @ApiProperty()
  rejected_count: number;

  @ApiProperty()
  approved_count: number;

  @ApiProperty()
  pending_count: number;

  @ApiProperty()
  dead_line?: Date;

  @ApiProperty({
    enum: ['REJECTED', 'TEST_REJECTED', 'UNDER_REVIEW', 'TEST_UNDER_REVIEW'],
  })
  status: 'REJECTED' | 'TEST_REJECTED' | 'UNDER_REVIEW' | 'TEST_UNDER_REVIEW';

  @ApiProperty()
  average_time: number | null;
  static fromSelf(data: any) {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      is_public: data.is_public,
      require_contributor_test: data.require_contributor_test,
      is_closed: data.is_closed,
      is_archived: data.is_archived,
      distribution_started: data.distribution_started,
      task_type: data.task_type,
      done_count: data.done_count,
      total_count: data.total_count,
      rejected_count: data.rejected_count,
      approved_count: data.approved_count,
      pending_count: data.pending_count,
      dead_line: data.dead_line,
      status: data.status,
      average_time: data.average_time,
    };
  }
}
export type MobilePaginatedTaskResponse = {
  result: TaskStatus[];
  total: number;
  page: number;
  limit: number;
};
