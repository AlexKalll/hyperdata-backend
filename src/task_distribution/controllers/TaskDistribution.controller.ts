import {
  Controller,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  Param,
  Get,
  UploadedFiles,
  ParseUUIDPipe,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { TaskDistributionService } from '../service/TaskDistribution.service';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateMultipleDataSetDto } from '../dto/DataSet.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { multerAudioDiskConfig } from 'src/config/minio.config';
import { PaginatedResult } from 'src/utils/paginate.util';
import {
  ContributorTaskRto,
  TaskMicroTasksResponse,
  TaskStatus,
} from '../rto/Task.rto';
import { FileService } from 'src/common/service/File.service';
import { taskTypes } from 'src/utils/constants/Task.constant';
import { GetContributorTasksDto } from '../dto/Task.dto';
import { AudioService } from 'src/common/service/Audio.service';
import { DataSetSanitize } from 'src/data_set/sanitize';
import { GetTasksService } from '../service/GetTask.service';
import { TaskSubmissionService } from '../service/TaskSubmission.service';
import { TaskRedistributionService } from '../service/TaskRedistribution.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('task-distribution')
@ApiTags('Task Distribution')
@ApiBearerAuth()
export class TaskDistributionController {
  constructor(
    private readonly taskDistributionService: TaskDistributionService,
    private readonly taskSubmissionService: TaskSubmissionService,
    private readonly taskRedistributionService: TaskRedistributionService,
    private readonly getTaskService: GetTasksService,
    private readonly fileService: FileService,
    private readonly audioService: AudioService,
    private readonly dataSource: DataSource,
    @InjectQueue('file-upload')
    private readonly fileQueue: Queue,
  ) {}

  // @Get('assigned-tasks')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.CONTRIBUTOR)
  // @ApiOperation({ summary: 'Get my tasks' })
  // @ApiResponse({ status: 200, description: 'My tasks', type: [TaskStatus] })
  // /**
  //  * Get the tasks assigned to the current user
  //  * @param paginateDto Pagination query
  //  * @param req Request object
  //  * @returns The tasks assigned to the current user
  //  */
  // async getUserAssignedTasks(
  //   @Query() paginateDto: PaginationDto,
  //   @Request() req,
  // ): Promise<PaginatedResult<TaskStatus>> {
  //   let user_id = req.user.id;
  //   let data=await this.taskDistributionService.getUserAssignedNewTasks(
  //     user_id,
  //     paginateDto,
  //   );
  //   let results:TaskStatus[]=[];
  //   for (const task of data.result) {
  //     results.push(TaskStatus.fromSelf(task));
  //   }
  //   data.result=results;
  //   return data
  // }

  @Get('my-tasks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiOperation({
    description:
      'Api for getting the tasks assigned to the current user (for contributor)',
    summary: 'Get my tasks',
  })
  @ApiResponse({ status: 200, description: 'My tasks', type: [TaskStatus] })
  /**
   * Get the tasks assigned to the current user
   * @param paginateDto Pagination query
   * @param req Request object
   * @returns The tasks assigned to the current user
   */
  async getContributorTasks(
    @Query() contributorTaskDto: GetContributorTasksDto,
    @Request() req,
  ): Promise<PaginatedResult<ContributorTaskRto>> {
    const user_id = req.user.id;
    const data = await this.getTaskService.getContributorTasks(
      user_id,
      contributorTaskDto,
    );
    const results: ContributorTaskRto[] = [];
    for (const task of data.result) {
      results.push(ContributorTaskRto.fromSelf(task));
    }
    data.result = results;
    return data;
  }

  // @Get('recent-assigned-tasks/all')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.CONTRIBUTOR)
  // @ApiOperation({ summary: 'Get my tasks' })
  // @ApiResponse({ status: 200, description: 'My tasks' })
  // /**
  //  * Get the tasks assigned to the current user
  //  * @param paginateDto Pagination query
  //  * @param req Request object
  //  * @returns The tasks assigned to the current user
  //  */
  // async getAllUserRecentUserAssignedTasks(@Request() req) {
  //   let user_id = req.user.id;
  //   return this.taskDistributionService.getAllUserAssignedRecentTasks(user_id);
  // }
  // @Get('recent-assigned-tasks')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.CONTRIBUTOR)
  // @ApiOperation({ summary: 'Get my tasks' })
  // @ApiResponse({ status: 200, description: 'My tasks',type: [RecentTaskRto] })
  // /**
  //  * Get the tasks assigned to the current user
  //  * @param paginateDto Pagination query
  //  * @param req Request object
  //  * @returns The tasks assigned to the current user
  //  */
  // async getRecentUserAssignedTasks(
  //    @Query() paginateDto: PaginationDto,
  //   @Request() req,
  // ) : Promise<PaginatedResult<RecentTaskRto>> {
  //   let user_id = req.user.id;
  //   let data= await this.taskDistributionService.getUserRecentTasks(user_id, paginateDto);
  //   let results:RecentTaskRto[]=[];
  //   for (const task of data.result) {
  //     results.push(RecentTaskRto.fromSelf(task));
  //   }
  //   data.result=results;
  //   return data
  // }

  //  @Get('recent-assigned-tasks')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.CONTRIBUTOR)
  // @ApiOperation({ summary: 'Get my tasks' })
  // @ApiResponse({ status: 200, description: 'My tasks',type: [RecentTaskRto] })
  // /**
  //  * Get the tasks assigned to the current user
  //  * @param paginateDto Pagination query
  //  * @param req Request object
  //  * @returns The tasks assigned to the current user
  //  */
  // async getRecentUserAssignedTasksV2(
  //    @Query() paginateDto: PaginationDto,
  //   @Request() req,
  // ) : Promise<PaginatedResult<ContributorRecentTaskRto>> {
  //   let user_id = req.user.id;
  //   let data= await this.getTaskService.getUserRecentTasksV2(user_id, paginateDto);
  //   let results:ContributorRecentTaskRto[]=[];
  //   for (const task of data.result) {
  //     results.push(ContributorRecentTaskRto.fromSelf(task));
  //   }
  //   data.result=results;
  //   return data
  // }

  // @Get('assigned-tasks/:task_id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.CONTRIBUTOR)
  // @ApiOperation({ summary: 'Get my tasks' })
  // @ApiResponse({ status: 200, description: 'My tasks', type: TaskMicroTasksResponse })
  // async getUserAssignedTaskMicroTasks(
  //   @Param('task_id', ParseUUIDPipe) task_id: string,
  //   @Request() req,
  // ): Promise<TaskMicroTasksResponse> {
  //   let user_id = req.user.id;
  //   const task:TaskMicroTasksResponse =await this.getTaskService.getUserAssignedTaskMicroTasksV2(
  //     user_id,
  //     task_id,
  //   );
  //   if(task.task_type==taskTypes.AUDIO_TO_TEXT){
  //     for (const mt of task.contributorMicroTask ){
  //       mt.file_path=await this.fileService.getPreSignedUrl(mt.file_path);
  //     }
  //   }
  //   if (task.task_type == taskTypes.TEXT_TO_AUDIO) {
  //     for (const mt of task.contributorMicroTask ){
  //       if (mt.dataSet) {
  //         mt.dataSet.file_path=await this.fileService.getPreSignedUrl(mt.dataSet.file_path);
  //       }
  //     }
  //   }
  //   return task;
  // }

  @Get('assigned-tasks/:task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiOperation({ summary: 'Get my tasks' })
  @ApiResponse({
    status: 200,
    description: 'My tasks',
    type: TaskMicroTasksResponse,
  })
  async getContributorTaskMicroTasks(
    @Param('task_id', ParseUUIDPipe) task_id: string,
    @Request() req,
  ): Promise<TaskMicroTasksResponse> {
    const user_id = req.user.id;
    const task: TaskMicroTasksResponse =
      await this.getTaskService.getContributorTaskMicroTasks(user_id, task_id);
    if (task.task_type == taskTypes.AUDIO_TO_TEXT) {
      for (const mt of task.contributorMicroTask) {
        mt.file_path = await this.fileService.getPreSignedUrl(mt.file_path);
      }
    }
    if (task.task_type == taskTypes.TEXT_TO_AUDIO) {
      for (const mt of task.contributorMicroTask) {
        if (mt.dataSet) {
          mt.dataSet.file_path = await this.fileService.getPreSignedUrl(
            mt.dataSet.file_path,
          );
        }
      }
    }
    return task;
  }
  @Get('contributor-micro-task-submissions/:micro_task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiOperation({
    summary: 'Get Contributor Submission of specific micro task',
  })
  @ApiResponse({
    status: 200,
    description: 'My tasks',
    type: [DataSetSanitize],
  })
  async getContributorMicroTaskSubmissionDetail(
    @Param('micro_task_id', new ParseUUIDPipe()) micro_task_id: string,
    @Request() req,
  ): Promise<DataSetSanitize[]> {
    const user_id = req.user.id;
    const dataSets: DataSetSanitize[] =
      await this.getTaskService.getContributorMicroTaskSubmissions(
        micro_task_id,
        user_id,
      );
    if (dataSets.length == 0) {
      return [];
    }

    if (dataSets[0].type == 'audio') {
      for (const d of dataSets) {
        d.file_path = await this.fileService.getPreSignedUrl(d.file_path);
      }
      return dataSets;
    } else {
      return dataSets;
    }
  }

  @Post('/:task_id/contribute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiOperation({ summary: 'Contribute' })
  @ApiParam({ name: 'task_id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Contribute' })
  async contribute(
    @Param('task_id', new ParseUUIDPipe()) task_id: string,
    @Body()
    data: CreateMultipleDataSetDto,
    @Request() req,
  ) {
    const user_id = req.user.id;
    return this.taskSubmissionService.submitMultipleTextDatasets(
      user_id,
      data.attempts,
      task_id,
      data.is_test,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Initialize task distribution' })
  @ApiResponse({ status: 201, description: 'Task distribution initialized' })
  @ApiQuery({ name: 'task_id', required: true })
  async initializeTaskDistribution(
    @Query('task_id', ParseUUIDPipe) task_id: string,
    @Request() req,
  ) {
    if (!task_id) {
      throw new Error('Task ID is required');
    }
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const distribute =
        await this.taskDistributionService.startNewTaskDistribution(
          task_id,
          queryRunner,
        );
      await queryRunner.commitTransaction();
      return distribute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      if (queryRunner) {
        try {
          await queryRunner.release();
        } catch (releaseError) {
          console.error('Error releasing queryRunner:', releaseError);
        }
      }
    }
  }

  @Post('reviewer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Initialize task distribution for reviewers ' })
  @ApiResponse({ status: 201, description: 'Task distributed successfully' })
  @ApiQuery({ name: 'task_id', required: true })
  async distributeTaskForReviewers(
    @Query('task_id', ParseUUIDPipe) task_id: string,
  ) {
    if (!task_id) {
      throw new Error('Task ID is required');
    }
    await this.taskDistributionService.distributeTaskForReviewers(task_id);
    return { message: ' Task distributed for reviewers' };
  }

  @Post('/re-distribution')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Initialize task distribution' })
  @ApiResponse({ status: 201, description: 'Task distribution initialized' })
  async initializeTaskReDistribution() {
    return this.taskRedistributionService.initializeTaskRedistribution();
  }
  // @Post('/contributor/:id')
  // @ApiOperation({ summary: 'Initialize task distribution' })
  // @ApiResponse({ status: 201, description: 'Task distribution initialized' })
  // async initializeTaskReDistributionForContributor(@Param('id') contributor_id:string) {
  //     return this.taskDistributionService.initializeTaskDistributionForContributor({user_id:contributor_id})
  // }

  @Post('/:task_id/contribute_audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiParam({ name: 'task_id', type: 'string' })
  @UseInterceptors(
    AnyFilesInterceptor({ storage: multerAudioDiskConfig.storage }),
  )
  @ApiOperation({ summary: 'Contribute audio files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        micro_task_id: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async contributeMultipleSpeech(
    @UploadedFiles() files: Express.Multer.File[],
    @Param('task_id', new ParseUUIDPipe()) task_id: string,
    @Request() req,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const submissions: {
      micro_task_id: string;
      file_path: string;
      audio_duration: number;
    }[] = [];
    let { is_test } = req.body; // Get batch from request body, default to false
    is_test = is_test === 'true' || is_test === true; // Convert to boolean
    for (const file of files) {
      submissions.push({
        micro_task_id: file.fieldname,
        file_path: '', //  file.key, // Use the file key as the file path
        audio_duration: await this.audioService.getAudioDuration(file.path),
      });
    }

    const data_Sets =
      await this.taskSubmissionService.submitMultipleAudioDatasets(
        req.user.id,
        submissions,
        task_id,
        is_test,
      );
    for (const file of files) {
      const d = data_Sets.find((d) => d.micro_task_id == file.fieldname);
      if (!d) {
        continue;
      }
      await this.fileQueue.add(
        'upload',
        {
          path: file.path,
          filename: file.filename,
          mimetype: file.mimetype,
          dataSetId: d.id,
        },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
    }
    // await queryRunner.commitTransaction();
    return data_Sets;
  }
}
