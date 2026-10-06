import { Module } from '@nestjs/common';
import { Project } from './entities/Project.entity';
import { Task } from './entities/Task.entity';

import { TaskType } from './entities/TaskType.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './controller/Project.controller';
import { ProjectService } from './service/Project.service';
import { AuthModule } from 'src/auth/auth.module';
import { TaskController } from './controller/Task.controller';
import { TaskTypeController } from './controller/TaskType.controller';
import { TaskTypeService } from './service/TaskType.service';
import { TaskService } from './service/Task.service';
import { BaseDataModule } from 'src/base_data/base_data.module';
import { UserTaskService } from './service/UserTask.service';
import { UserTask } from './entities/UserTask.entity';
import { EmailModule } from 'src/email/email.module';
import { TaskInstructionService } from './service/TaskInstruction.service';
import { TaskInstruction } from './entities/TaskInstruction.entity';
import { TaskRequirement } from './entities/TaskRequirement.entity';
import { TaskRequirementService } from './service/TaskRequirement.service';
import { InvitationLink } from './entities/InvitationLink.entity';
import { InvitationLinkService } from './service/InvitationLink.service';
import { InivitationController } from './controller/InvitationLink.controller';
import { FacilitatorContributorService } from './service/FacilitatorContributor.service';
import { FacilitatorContributor } from './entities/FacilitatorContributor.entity';
import { TaskPaymentService } from './service/TaskPayment.service';
import { TaskPayment } from './entities/TaskPayment.entity';
import { FacilitatorController } from './controller/Facilitator.controller';
import { TaskServiceHelperService } from './service/TaskServiceHelper.service';
import { ProjectScopeGuard } from './guard/ProjectScope.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Task,
      TaskType,
      UserTask,
      TaskInstruction,
      TaskPayment,
      TaskRequirement,
      InvitationLink,
      FacilitatorContributor,
    ]),
    BaseDataModule,
    EmailModule,
    AuthModule,
    // FinanceModule,
  ],
  providers: [
    ProjectService,
    TaskTypeService,
    TaskService,
    TaskServiceHelperService,
    TaskPaymentService,
    UserTaskService,
    TaskInstructionService,
    TaskRequirementService,
    InvitationLinkService,
    FacilitatorContributorService,
    ProjectScopeGuard,
  ],
  controllers: [
    ProjectController,
    TaskController,
    TaskTypeController,
    InivitationController,
    FacilitatorController,
  ],
  exports: [
    TaskService,
    UserTaskService,
    ProjectService,
    ProjectScopeGuard,
    TypeOrmModule,
  ],
})
export class ProjectModule {}
