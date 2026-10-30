import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { ProjectStatisticsService } from '../services/ProjectStatistics.service';
import {
  DataSetStatisticsPerProjectDto,
  ProjectStatisticsDto,
  TaskStatisticsDto,
} from '../dto/Project.dto';
@ApiTags('Statistics')
@ApiBearerAuth()
@Controller('statistics/project')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROJECT_MANAGER)
export class ProjectStatisticsController {
  constructor(
    private readonly projectStatisticsService: ProjectStatisticsService,
  ) {}
  @Get('project')
  @ApiQuery({ name: 'project_id', required: false })
  async getAllProjectStatistics(
    @Query('project_id') project_id,
    @Request() req,
  ) {
    return await this.projectStatisticsService.getAllStatistics(
      req.user.id,
      project_id,
    );
  }

  @Get('task/:task_id')
  async getAllTaskStatistics(
    @Param('task_id', ParseUUIDPipe) task_id: string,
    @Request() req,
  ) {
    return await this.projectStatisticsService.getAllTaskStatistics(
      req.user.id,
      task_id,
    );
  }

  @Get('project-dataset')
  async getProjectDatasetStatistics(
    @Query() projectDto: ProjectStatisticsDto,
    @Request() req,
  ) {
    return await this.projectStatisticsService.getDataSetStatisticsByProject(
      projectDto.view_type,
      projectDto.project_id,
      req.user.id,
    );
  }

  @Get('task-dataset/:task_id')
  async getTaskDatasetStatistics(
    @Param('task_id') task_id,
    @Query() taskDto: TaskStatisticsDto,
    @Request() req,
  ) {
    return await this.projectStatisticsService.getDataSetStatisticsByTask(
      taskDto.view_type,
      task_id,
    );
  }

  @Get('project')
  @ApiQuery({ name: 'project_id', required: false })
  async getAllStatistics(@Query('project_id') project_id, @Request() req) {
    return await this.projectStatisticsService.getAllStatistics(
      req.user.id,
      project_id,
    );
  }
  @Get('/dataset-language')
  async getDataSetsPerLanguageAndDialect(
    @Query() dataSetDto: DataSetStatisticsPerProjectDto,
    @Request() req,
  ) {
    const user_id = req.user.id;
    console.log('data ');
    return await this.projectStatisticsService.getDataSetByDialectAndLanguage(
      dataSetDto.view_type,
      dataSetDto.project_id,
      user_id,
    );
  }
}
