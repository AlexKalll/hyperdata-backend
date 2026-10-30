import {
  Controller,
  Query,
  UseGuards,
  Request,
  Param,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { TaskDistributionMonitoringService } from '../service/TaskDistributionMonitoring.service';
import {
  TaskDataSetReviewerDistributionRto,
  TaskReviewersProgressRto,
} from '../rto/TaskMonitoring.rto';
@Controller('task-distribution-monitoring')
@ApiTags('Task Distribution Monitoring')
@ApiBearerAuth()
export class TaskDistributionMonitoringController {
  constructor(
    private readonly taskDistributionMonitoringService: TaskDistributionMonitoringService,
  ) {}

  @Get('statistics/:task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER, Role.ADMIN)
  async getTaskDistributionStatistics(
    @Param('task_id') task_id: string,
    @Request() req,
  ) {
    const user_id = req.user.id;
    return this.taskDistributionMonitoringService.getTaskDistributionStatistics(
      task_id,
    );
  }
  @Get('statistics/:task_id/contributors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER, Role.ADMIN)
  @ApiQuery({ name: 'page', required: false, default: 1 })
  @ApiQuery({ name: 'limit', required: false, default: 10 })
  getTaskAssignedContributors(
    @Param('task_id') task_id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.taskDistributionMonitoringService.getTaskAssignedContributors(
      task_id,
      paginationDto,
    );
  }
  @Get('statistics/:task_id/micro-task')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER, Role.ADMIN)
  @ApiProperty({
    description:
      'The api returns the distribution status of each microtask in the task ',
  })
  getMicroTaskStatisticsByTaskId(
    @Param('task_id') task_id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.taskDistributionMonitoringService.getMicroTaskStatisticsByTaskId(
      task_id,
      paginationDto,
    );
  }

  @Get('statistics/:task_id/data-set-assignment-for-reviewers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER, Role.ADMIN)
  @ApiProperty({
    description:
      'The api returns the distribution status of each datasets  in the task  for reviewers',
  })
  @ApiResponse({ type: TaskDataSetReviewerDistributionRto })
  getTaskDataSetDistributionStatusForReviewers(
    @Param('task_id') task_id: string,
  ) {
    return this.taskDistributionMonitoringService.getTaskDataSetDistributionStatusForReviewers(
      task_id,
    );
  }

  @Get('statistics/:task_id/reviewers-task-progress')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER, Role.ADMIN)
  @ApiProperty({
    description: 'The api returns the reviewer task progress stats',
  })
  @ApiResponse({ type: [TaskReviewersProgressRto] })
  getTaskReviewerStats(
    @Param('task_id') task_id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.taskDistributionMonitoringService.getTaskReviewerStats(
      task_id,
      paginationDto,
    );
  }
}
