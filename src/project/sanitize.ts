import { ApiProperty } from '@nestjs/swagger';
import { FacilitatorContributor } from './entities/FacilitatorContributor.entity';
import { InvitationLink } from './entities/InvitationLink.entity';
import { TaskPayment } from './entities/TaskPayment.entity';
import { TaskInstruction } from './entities/TaskInstruction.entity';
import { TaskRequirement } from './entities/TaskRequirement.entity';
import { TaskType } from './entities/TaskType.entity';
import { UserTask } from './entities/UserTask.entity';
import { UserSanitize } from 'src/auth/sanitize';
import { Project } from './entities/Project.entity';
import { Task } from './entities/Task.entity';

export const FacilitatorContributorSanitizeFields = {
  id: true,
  facilitator_id: true,
  contributor_ids: true,
  task_id: true,
  created_date: true,
};
export class FacilitatorContributorSanitize {
  @ApiProperty()
  id: string;
  @ApiProperty()
  facilitator_id: string;
  @ApiProperty()
  contributor_ids: string[];
  @ApiProperty()
  task_id: string;
  @ApiProperty()
  created_date: Date;
  static from(
    facilitatorContributor: FacilitatorContributor,
  ): FacilitatorContributorSanitize {
    return {
      id: facilitatorContributor.id,
      facilitator_id: facilitatorContributor.facilitator_id,
      contributor_ids: facilitatorContributor.contributor_ids,
      task_id: facilitatorContributor.task_id,
      created_date: facilitatorContributor.created_date,
    };
  }
}
export const InvitationLinkSanitizeFields = {
  id: true,
  project_id: true,
  task_id: true,
  expiry_date: true,
  max_invitations: true,
  current_invitations: true,
  organization_id: true,
  created_date: true,
};
export class InvitationLinkSanitize {
  @ApiProperty()
  id: string;
  @ApiProperty()
  project_id: string;
  @ApiProperty()
  task_id: string;
  @ApiProperty({ type: Date, nullable: true })
  expiry_date: Date | null;
  @ApiProperty()
  max_invitations: number;
  @ApiProperty()
  current_invitations: number;
  @ApiProperty()
  organization_id: string;
  @ApiProperty()
  created_date: Date;
  static from(invitationLink: InvitationLink): InvitationLinkSanitize {
    return {
      id: invitationLink.id,
      project_id: invitationLink.project_id,
      task_id: invitationLink.task_id,
      expiry_date: invitationLink.expiry_date,
      max_invitations: invitationLink.max_invitations,
      current_invitations: invitationLink.current_invitations,
      organization_id: invitationLink.organization_id,
      created_date: invitationLink.created_date,
    };
  }
}
export const ProjectSanitizeFields = {
  id: true,
  name: true,
  description: true,
  cover_image_url: true,
  start_date: true,
  end_date: true,
  status: true,
  is_archived: true,
  created_date: true,
};
export class ProjectSanitize {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  cover_image_url: string;
  @ApiProperty()
  start_date: Date;
  @ApiProperty()
  end_date: Date;
  @ApiProperty()
  status: string;
  @ApiProperty()
  is_archived: boolean;
  @ApiProperty()
  created_date: Date;

  @ApiProperty({ type: [String] })
  tags?: string[];

  @ApiProperty({ type: UserSanitize })
  manager?: UserSanitize;
  static from(project: Project): ProjectSanitize {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      cover_image_url: project.cover_image_url,
      start_date: project.start_date,
      end_date: project.end_date,
      status: project.status,
      is_archived: project.is_archived,
      created_date: project.created_date,
      manager: project.manager && UserSanitize.from(project.manager),
      tags: project.tags,
    };
  }
}
export const TaskSanitizeFields = {
  id: true,
  name: true,
  description: true,
  is_public: true,
  require_contributor_test: true,
  is_closed: true,
  is_archived: true,
  distribution_started: true,
  created_date: true,
};
export class TaskSanitize {
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
  created_date: Date;
  static from(task: Task): TaskSanitize {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      is_public: task.is_public,
      require_contributor_test: task.require_contributor_test,
      is_closed: task.is_closed,
      is_archived: task.is_archived,
      distribution_started: task.distribution_started,
      created_date: task.created_date,
    };
  }
}
export const TaskInstructionSanitizeFields = {
  id: true,
  title: true,
  content: true,
  image_instruction_url: true,
  video_instruction_url: true,
  audio_instruction_url: true,
  task_id: true,
  created_date: true,
};
export class TaskInstructionSanitize {
  @ApiProperty()
  id: string;
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
  @ApiProperty()
  task_id: string;
  @ApiProperty()
  created_date: Date;
  static from(taskInstruction: TaskInstruction): TaskInstructionSanitize {
    return {
      id: taskInstruction.id,
      title: taskInstruction.title,
      content: taskInstruction.content,
      image_instruction_url: taskInstruction.image_instruction_url,
      video_instruction_url: taskInstruction.video_instruction_url,
      audio_instruction_url: taskInstruction.audio_instruction_url,
      task_id: taskInstruction.task_id,
      created_date: taskInstruction.created_date,
    };
  }
}
export const TaskPaymentSanitizeFields = {
  contributor_credit_per_microtask: true,
  reviewer_credit_per_microtask: true,
  created_date: true,
};
export class TaskPaymentSanitize {
  @ApiProperty()
  contributor_credit_per_microtask: number;
  @ApiProperty()
  reviewer_credit_per_microtask: number;
  @ApiProperty()
  created_date: Date;
  static from(taskPayment: TaskPayment): TaskPaymentSanitize {
    return {
      contributor_credit_per_microtask:
        taskPayment.contributor_credit_per_microtask,
      reviewer_credit_per_microtask: taskPayment.reviewer_credit_per_microtask,
      created_date: taskPayment.created_date,
    };
  }
}
export const TaskRequirementSanitizeFields = {
  max_contributor_per_micro_task: true,
  max_contributor_per_facilitator: true,
  max_micro_task_per_contributor: true,
  minimum_seconds: true,
  maximum_seconds: true,
  batch: true,
  appriximate_time_per_batch: true,
  min_retry_per_task: true,
  max_retry_per_task: true,
  max_expected_no_of_contributors: true,
  is_dialect_specific: true,
  dialects: true,
  is_age_specific: true,
  age: true,
  is_sector_specific: true,
  sectors: true,
  is_gender_specific: true,
  gender: true,
  is_language_specific: true,
  locations: true,
  created_date: true,
};
export class AgeDto {
  @ApiProperty()
  min: number;
  @ApiProperty()
  max: number;
}
export class GenderDto {
  @ApiProperty()
  male: number;
  @ApiProperty()
  female: number;
}
export class DialectDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
}
export class Location {
  @ApiProperty()
  name: string;
}
export class TaskRequirementSanitize {
  @ApiProperty()
  max_contributor_per_micro_task: number;
  @ApiProperty()
  max_contributor_per_facilitator: number;
  @ApiProperty()
  max_micro_task_per_contributor: number;
  @ApiProperty()
  minimum_seconds: number;
  @ApiProperty()
  maximum_seconds: number;
  @ApiProperty()
  batch: number;
  @ApiProperty()
  appriximate_time_per_batch: number;

  @ApiProperty()
  max_retry_per_task: number;
  @ApiProperty()
  is_dialect_specific: boolean;
  @ApiProperty({ type: DialectDto, isArray: true })
  dialects: DialectDto[];
  @ApiProperty()
  is_age_specific: boolean;
  @ApiProperty({ type: AgeDto })
  age: AgeDto;
  @ApiProperty()
  is_sector_specific: boolean;
  @ApiProperty()
  sectors: string[];
  @ApiProperty()
  is_gender_specific: boolean;
  @ApiProperty({ type: GenderDto })
  gender: GenderDto;
  @ApiProperty({ type: Location, isArray: true })
  locations: Location[];
  @ApiProperty()
  created_date: Date;
  static from(taskRequirement: TaskRequirement): TaskRequirementSanitize {
    return {
      max_contributor_per_micro_task:
        taskRequirement.max_contributor_per_micro_task,
      max_contributor_per_facilitator:
        taskRequirement.max_contributor_per_facilitator,
      max_micro_task_per_contributor:
        taskRequirement.max_micro_task_per_contributor,
      minimum_seconds: taskRequirement.minimum_seconds,
      maximum_seconds: taskRequirement.maximum_seconds,
      batch: taskRequirement.batch,
      appriximate_time_per_batch: taskRequirement.appriximate_time_per_batch,
      // min_retry_per_task: taskRequirement.min_retry_per_task,
      max_retry_per_task: taskRequirement.max_retry_per_task,
      is_dialect_specific: taskRequirement.is_dialect_specific,
      dialects: taskRequirement.dialects,
      is_age_specific: taskRequirement.is_age_specific,
      age: taskRequirement.age,
      is_sector_specific: taskRequirement.is_sector_specific,
      sectors: taskRequirement.sectors,
      is_gender_specific: taskRequirement.is_gender_specific,
      gender: taskRequirement.gender,
      locations: taskRequirement.locations,
      created_date: taskRequirement.created_date,
    };
  }
}

export const TaskTypeSanitizeFields = {
  id: true,
  task_type: true,
  created_date: true,
};
export class TaskTypeSanitize {
  @ApiProperty()
  id: string;
  @ApiProperty()
  task_type: string;
  @ApiProperty()
  created_date: Date;
  static from(taskType: TaskType): TaskTypeSanitize {
    return {
      id: taskType.id,
      task_type: taskType.task_type,
      created_date: taskType.created_date,
    };
  }
}
export const UserTaskSanitizeFields = {
  id: true,
  role: true,
  status: true,
  is_flagged: true,
  created_date: true,
};
export class UserTaskSanitize {
  @ApiProperty()
  id: string;
  @ApiProperty()
  role: string;
  @ApiProperty()
  status: string;
  @ApiProperty()
  is_flagged: boolean;
  @ApiProperty()
  created_date: Date;

  @ApiProperty()
  task?: TaskSanitize;

  @ApiProperty()
  user?: UserSanitize;
  static from(userTask: UserTask): UserTaskSanitize {
    return {
      id: userTask.id,
      role: userTask.role,
      status: userTask.status,
      is_flagged: userTask.is_flagged,
      created_date: userTask.created_date,
      task: userTask.task && TaskSanitize.from(userTask.task),
      user: userTask.user && UserSanitize.from(userTask.user),
    };
  }
}
