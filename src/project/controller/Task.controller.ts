import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Query,
  UsePipes,
  UseGuards,
  Request,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Patch,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiExtraModels,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { TaskService } from '../service/Task.service';
import {
  CreateTaskDto,
  ExportContributorsOfATaskDto,
  FindTaskMembersDto,
  GetTaskAnAssignedMembersDto,
  GetTaskDto,
  GetTaskMembersFilterDto,
  ImportContributorFromOtherTaskDto,
  UpdateTaskDto,
  UpdateTaskInstructionDto,
  UpdateTaskPaymentDto,
  UpdateTaskRequirementDto,
} from '../dto/Task.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import {
  ActivateToggleDto,
  AssignContributorToFacilitatorToTaskDto,
  AssignContributorToTaskDto,
  AssignUserToTaskDto,
} from '../dto/UserTask.dto';
import { DataSource, FindOptionsWhere, ILike } from 'typeorm';
import { CreateTaskInstructionDto } from '../dto/TaskInstruction.dto';
import { ActivityLogService } from 'src/common/service/ActivityLog.service';
import {
  ActivityEntityType,
  ActivityLogActions,
} from 'src/utils/constants/ActivityLog.actions';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerImageS3Storage } from 'src/config/minio.config';
import { QueryOptions } from 'src/utils/queryOption.util';
import { UserTask } from '../entities/UserTask.entity';
import { User } from 'src/auth/entities/User.entity';
import { Task } from '../entities/Task.entity';
import { TaskServiceHelperService } from '../service/TaskServiceHelper.service';
import { ProjectScopeGuard } from '../guard/ProjectScope.guard';
@Controller('/project-mgmt/task')
@ApiTags('Task')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectScopeGuard)
@ApiBearerAuth()
@ApiExtraModels(FindTaskMembersDto)
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskServiceHelperService: TaskServiceHelperService,
    private readonly dataSource: DataSource, // Inject DataSource for transactions
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async create(@Body() taskData: CreateTaskDto, @Request() req) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    if (taskData.is_dialect_specific && !taskData.dialects) {
      throw new NotFoundException('Dialects are required');
    }
    if (taskData.is_gender_specific && !taskData.gender) {
      throw new NotFoundException('Genders are required');
    }
    if (taskData.is_age_specific && !taskData.age) {
      throw new NotFoundException('Ages are required');
    }
    if (taskData.is_location_specific && !taskData.locations) {
      throw new NotFoundException('Locations are required');
    }
    if (taskData.is_sector_specific && !taskData.sectors) {
      throw new NotFoundException('Sectors are required');
    }
    try {
      const task = await this.taskService.create(
        { ...taskData },
        req.user.id,
        queryRunner,
      );
      await this.activityLogService.create({
        user_id: req.user.id,
        action: ActivityLogActions.CREATE_TASK,
        metadata: JSON.stringify(taskData),
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        entity_type: ActivityEntityType.TASK,
        entity_id: task.id,
      });
      await queryRunner.commitTransaction();
      return task;
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
  @Post('/:id/add-instruction')
  @Roles(Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UseInterceptors(FileInterceptor('image', { storage: multerImageS3Storage }))
  async addTaskInstruction(
    @UploadedFile() file: any,
    @Param('id') id: string,
    @Body()
    instructionData: CreateTaskInstructionDto,
    @Request() req,
  ) {
    let image_instruction_url = '';
    image_instruction_url = file?.key ?? '';
    return this.taskService.addTaskInstructions({
      ...instructionData,
      task_id: id,
      image_instruction_url: image_instruction_url,
      created_by: req.user.id,
    });
  }
  @Post('/:id/assign-facilitator')
  @Roles(Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async assignFacilitator(
    @Param('id') id: string,
    @Body()
    taskData: AssignUserToTaskDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await Promise.all(
        taskData.emails.map(async (email) => {
          return this.taskService.assignFacilitator(
            { email, task_id: id },
            queryRunner,
          );
        }),
      );
      await queryRunner.commitTransaction();
      return 'Facilitators assigned successfully';
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
  @Post('/:id/assign-reviewer')
  @Roles(Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async assignOrInviteReviewer(
    @Param('id') id: string,
    @Body()
    assignData: AssignUserToTaskDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await Promise.all(
        assignData.emails.map(async (email) => {
          return this.taskService.assignReviewer(
            { email, task_id: id },
            queryRunner,
          );
        }),
      );

      await queryRunner.commitTransaction();
      return 'Reviewers assigned successfully';
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
  @Post('/:id/assign-contributor')
  @Roles(Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async assignContributor(
    @Param('id') id: string,
    @Body()
    body: AssignContributorToTaskDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userTask = await this.taskService.assignContributor(
        id,
        body.contributor_ids,
        queryRunner,
      );
      await queryRunner.commitTransaction();
      return userTask;
    } catch (error) {
      if (queryRunner) await queryRunner.rollbackTransaction();
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
  @Post('/:id/assign-contributor-to-facilitator')
  @Roles(Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async assingContributorToFacilitator(
    @Param('id') id: string,
    @Body()
    body: AssignContributorToFacilitatorToTaskDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userTask = await this.taskService.assignContributorsToFacilitator(
        id,
        body.facilitator_id,
        body.contributor_ids,
        queryRunner,
      );
      console.log('userTask', userTask);
      console.log('Commiting query transaction');
      await queryRunner.commitTransaction();
      return userTask;
    } catch (error) {
      console.log('Rollbacking query transaction');
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      if (queryRunner) {
        try {
          console.log('Releasing query transaction');
          await queryRunner.release();
        } catch (releaseError) {
          console.error('Error releasing queryRunner:', releaseError);
        }
      }
    }
  }

  // @Get('contributor-tasks')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.CONTRIBUTOR)
  // @ApiProperty({description:'Get all tasks that a contributor submitted datasets to'})
  // @ApiResponse({ status: 200, description:'Success' })
  // async getContributorSubmissions(
  //   @Query() paginationDto: PaginationDto,
  //   @Request() req,
  // ): Promise<any> {
  //   const user = req.user;
  //   const contributor_id = user.id;
  //   return this.taskService.getContributorSubmissions(
  //     contributor_id,
  //     paginationDto,
  //   );
  // }
  @Get('contributor-tasks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiProperty({
    description: 'Get all tasks that a contributor submitted datasets to',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  async getContributorSubmissions(
    @Query() paginationDto: PaginationDto,
    @Request() req,
  ): Promise<any> {
    const user = req.user;
    const contributor_id = user.id;
    return this.taskService.getContributorSubmissionsV2(
      contributor_id,
      paginationDto,
    );
  }
  @Get('/:id/get-contributors-by-task-requirement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async getContributorByTaskRequirementPaginate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() searchSchema: GetTaskMembersFilterDto,
  ) {
    let search: string | undefined = searchSchema.search;
    const page = searchSchema.page;
    const limit = searchSchema.limit;
    // Clean up
    delete searchSchema.page;
    delete searchSchema.limit;
    searchSchema.search = undefined;

    const baseFilters: FindOptionsWhere<User> = {};
    const searchFilters: FindOptionsWhere<User>[] = [];

    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null) {
        if (['is_active', 'role_id', 'gender'].includes(key)) {
          baseFilters[key] = value;
        } else {
          baseFilters[key] = ILike(`%${value}%`);
        }
      }
    }

    // Build search filter if applicable
    if (search) {
      search = search.trim();
      searchFilters.push(
        { ...baseFilters, email: ILike(`%${search}%`) },
        { ...baseFilters, first_name: ILike(`%${search}%`) },
        { ...baseFilters, last_name: ILike(`%${search}%`) },
        { ...baseFilters, phone_number: ILike(`%${search}%`) },
      );
    }
    const query: QueryOptions<User> = {
      relations: { role: true, region: true, zone: true },
      where: search ? searchFilters : baseFilters,
    };
    return this.taskService.findTaskRelatedContributors(id, query, {
      page: page,
      limit: limit,
    });
  }
  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  async findPaginate(@Query() searchSchema: GetTaskDto, @Request() req) {
    const user_id = req.user.id;
    const page = searchSchema.page;
    const limit = searchSchema.limit;

    // Clean up
    delete searchSchema.page;
    delete searchSchema.limit;

    const baseFilters: FindOptionsWhere<Task> = {};

    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null) {
        if (key == 'name') {
          baseFilters[key] = ILike(`%${value}%`);
        } else {
          baseFilters[key] = value;
        }
      }
    }
    baseFilters.is_archived = false;
    return this.taskService.findPaginate(
      { where: baseFilters, relations: { taskType: true } },
      { page, limit },
    );
  }

  @Get('/archived')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  async findArchivedPaginate(
    @Query() searchSchema: GetTaskDto,
    @Request() req,
  ) {
    const page = searchSchema.page;
    const limit = searchSchema.limit;

    // Clean up
    delete searchSchema.page;
    delete searchSchema.limit;

    const baseFilters: FindOptionsWhere<Task> = {};

    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null) {
        if (key == 'name') {
          baseFilters[key] = ILike(`%${value}%`);
        } else {
          baseFilters[key] = value;
        }
      }
    }
    baseFilters.is_archived = true;
    return this.taskService.findPaginate(
      { where: baseFilters, relations: { taskType: true } },
      { page, limit },
    );
  }

  @Get('reviewer_tasks')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.REVIEWER)
  async findReviewerTasks(@Query() paginateDto: PaginationDto, @Request() req) {
    const user_id = req.user.id;
    return this.taskService.findReviewerTasks(user_id, paginateDto);
  }
  @Get('facilitator_tasks')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FACILITATOR)
  @UsePipes(new ZodValidationPipe())
  async findFacilitatorTasks(
    @Query() paginateDto: PaginationDto,
    @Request() req,
  ) {
    const user_id = req.user.id;
    return this.taskService.findFacilitatorTasks(user_id, paginateDto);
  }

  @Get('related-task-type/:task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.PROJECT_MANAGER, Role.ADMIN)
  @UsePipes(new ZodValidationPipe())
  async findCompatibleTaskForImportMicroTask(
    @Param('task_id') task_id: string,
  ) {
    return this.taskService.findCompatibleTaskForImportMicroTask(task_id);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAll(@Query() queryOption: UpdateTaskDto, @Request() req) {
    return this.taskService.findAll({
      where: { ...queryOption },
      relations: { taskType: true },
    });
  }
  @Get('project/:id/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async findAllProjectTasks(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req,
  ) {
    return this.taskService.findAll({
      where: { project_id: id, is_archived: false },
      relations: { taskType: true },
    });
  }
  @Get('project/:id')
  @ApiOperation({ summary: 'Find project tasks' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async findProjectTasks(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() searchSchema: GetTaskDto,
    @Request() req,
  ) {
    const user_id = req.user.id;
    const page = searchSchema.page;
    const limit = searchSchema.limit;

    // Clean up
    delete searchSchema.page;
    delete searchSchema.limit;

    console.log('searchSchema', searchSchema);

    const baseFilters: FindOptionsWhere<Task> = {
      project_id: id,
      is_archived: false,
    };

    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null) {
        if (key == 'name') {
          baseFilters[key] = ILike(`%${value}%`);
        } else {
          baseFilters[key] = value;
        }
      }
    }
    return this.taskService.findPaginate(
      { where: baseFilters, relations: { taskType: true } },
      { page, limit },
    );
  }

  @Get('project/archived/:id')
  @ApiOperation({ summary: 'Find  archived project  tasks' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async findArchivedProjectTasks(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() searchSchema: GetTaskDto,
    @Request() req,
  ) {
    const user_id = req.user.id;
    const page = searchSchema.page;
    const limit = searchSchema.limit;

    // Clean up
    delete searchSchema.page;
    delete searchSchema.limit;

    const baseFilters: FindOptionsWhere<Task> = {
      project_id: id,
      is_archived: true,
    };

    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null) {
        if (key == 'name') {
          baseFilters[key] = ILike(`%${value}%`);
        } else {
          baseFilters[key] = value;
        }
      }
    }
    return this.taskService.findPaginate(
      { where: baseFilters, relations: { taskType: true } },
      { page, limit },
    );
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async findTaskMembers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query()
    searchSchema: GetTaskMembersFilterDto,
  ) {
    let search: string | undefined = searchSchema.search;
    const page = searchSchema.page;
    const limit = searchSchema.limit;
    let userTaskFilters: FindOptionsWhere<UserTask> = {};

    // Clean up
    delete searchSchema.page;
    delete searchSchema.limit;
    delete searchSchema.search;
    if (searchSchema.status) {
      userTaskFilters = { ...userTaskFilters, status: searchSchema.status };
    }
    if (searchSchema.role) {
      userTaskFilters = { ...userTaskFilters, role: searchSchema.role };
    }
    delete searchSchema.status;
    delete searchSchema.role;

    const baseFilters: FindOptionsWhere<User> = {};
    const searchFilters: FindOptionsWhere<User>[] = [];

    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null) {
        if (['is_active', 'gender'].includes(key)) {
          baseFilters[key] = value;
        } else {
          baseFilters[key] = ILike(`%${value}%`);
        }
      }
    }
    // Build search filter if applicable
    if (search) {
      search = search.trim();
      searchFilters.push(
        { ...baseFilters, email: ILike(`%${search}%`) },
        { ...baseFilters, first_name: ILike(`%${search}%`) },
        { ...baseFilters, last_name: ILike(`%${search}%`) },
        { ...baseFilters, phone_number: ILike(`%${search}%`) },
      );
    }

    const query: FindOptionsWhere<User> | FindOptionsWhere<User>[] = search
      ? searchFilters
      : baseFilters;
    return this.taskService.findPaginateTaskMembers(
      id,
      userTaskFilters,
      query,
      { page: page, limit: limit },
    );
  }
  @Get(':id/members/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async findAllTaskMembers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() queryOption: FindTaskMembersDto,
  ) {
    const whereOption: QueryOptions<UserTask> = { where: {} };
    if (queryOption.status) {
      whereOption.where = { ...whereOption.where, status: queryOption.status };
    }
    if (queryOption.role) {
      whereOption.where = { ...whereOption.where, role: queryOption.role };
    }
    return this.taskService.findAllTaskMembers(id, whereOption);
  }
  @Put(':id/members/activate-toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @ApiBody({
    description: 'User ID to activate or deactivate the task',
    type: ActivateToggleDto,
  })
  async activateToggleforUserTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('user_id', new ParseUUIDPipe()) user_id: string,
    @Request() req,
  ) {
    return this.taskService.activateToggleUserTask({ task_id: id, user_id });
  }
  @Delete(':id/members/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @Delete(':id/facilitator-contributor/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid' },
      },
    },
  })
  async removeUserFromTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('user_id', new ParseUUIDPipe()) user_id: string,
    @Request() req,
  ) {
    return this.taskService.removeUserFromTask({ task_id: id, user_id });
  }
  @Post(':id/members/flag-member')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid' },
      },
    },
  })
  async flagMember(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('user_id', new ParseUUIDPipe()) user_id: string,
    @Request() req,
  ) {
    return this.taskService.flagUserTask({ task_id: id, user_id });
  }

  @Patch('archive-toggle/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async archiveToggle(@Param('id') id: string, @Request() req) {
    return this.taskService.archiveToggle(id);
  }

  @Post(':id/import-contributor-from-other-task')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async importContributorFromOtherTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() importData: ImportContributorFromOtherTaskDto,
    @Request() req,
  ) {
    return this.taskServiceHelperService.importContributorsFromOtherTask(
      id,
      importData,
    );
  }
  @Post(':id/export-contributor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async exportContributorFromOtherTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() importData: ExportContributorsOfATaskDto,
    @Request() req,
  ) {
    return this.taskServiceHelperService.getTaskContributors(id, importData);
  }

  @Put(':id/payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updatePayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateData: UpdateTaskPaymentDto,
    @Request() req,
  ) {
    return this.taskService.updateTaskPayment(id, updateData);
  }

  @Put(':id/instruction')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateTaskInstruction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateData: UpdateTaskInstructionDto,
    @Request() req,
  ) {
    return this.taskService.updateInstruction(id, updateData);
  }

  @Delete(':id/instruction')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async deleteTaskInstruction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req,
  ) {
    return this.taskService.deleteInstruction(id);
  }

  @Put(':id/requirement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateRequiremnt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() taskData: UpdateTaskRequirementDto,
    @Request() req,
  ) {
    return this.taskService.updateRequirement(id, taskData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() taskData: UpdateTaskDto,
    @Request() req,
  ) {
    const task = await this.taskService.update(id, {
      ...taskData,
      updated_by: req.user.id,
    });
    await this.activityLogService.create({
      user_id: req.user.id,
      action: ActivityLogActions.UPDATE_TASK,
      metadata: JSON.stringify(taskData),
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      entity_type: ActivityEntityType.TASK,
      entity_id: task?.id,
    });
    return task;
  }

  @Patch(':id/close-toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER)
  async closeTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req,
  ) {
    const task = await this.taskService.closeToggle(id);
    await this.activityLogService.create({
      user_id: req.user.id,
      action: ActivityLogActions.CLOSE_TASK,
      metadata: '',
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      entity_type: ActivityEntityType.TASK,
      entity_id: id,
    });
    return task;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    const deletee = await this.taskService.remove(id);
    await this.activityLogService.create({
      user_id: req.user.id,
      action: ActivityLogActions.DELETE_TASK,
      metadata: '',
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      entity_type: ActivityEntityType.TASK,
      entity_id: id,
    });
    return deletee;
  }

  @Get(':id/unassigned-users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async findTaskUnassignedUsers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query()
    searchSchema: GetTaskAnAssignedMembersDto,
  ) {
    let search: string | undefined = searchSchema.search;
    const page = searchSchema.page;
    const limit = searchSchema.limit;

    // Clean up
    delete searchSchema.page;
    delete searchSchema.limit;
    delete searchSchema.search;

    const role = searchSchema.role || 'Contributor';

    const baseFilters: FindOptionsWhere<User> = {};
    const searchFilters: FindOptionsWhere<User>[] = [];

    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null && key !== 'role') {
        if (['is_active', 'gender'].includes(key)) {
          baseFilters[key] = value;
        } else {
          baseFilters[key] = ILike(`%${value}%`);
        }
      }
    }
    // Build search filter if applicable
    if (search) {
      search = search.trim();
      searchFilters.push(
        { ...baseFilters, email: ILike(`%${search}%`) },
        { ...baseFilters, first_name: ILike(`%${search}%`) },
        { ...baseFilters, middle_name: ILike(`%${search}%`) },
        { ...baseFilters, phone_number: ILike(`%${search}%`) },
      );
    }

    const query: FindOptionsWhere<User> | FindOptionsWhere<User>[] = search
      ? searchFilters
      : baseFilters;
    return this.taskService.findTaskUnAssignedUsers(id, role, query, {
      page: page,
      limit: limit,
    });
  }
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER, Role.FACILITATOR)
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    const task = await this.taskService.findOne({
      where: { id },
      relations: {
        language: true,
        taskType: true,
        taskRequirement: true,
        taskInstructions: true,
        payment: true,
      },
    });
    if (!task) {
      throw new NotFoundException('Task not found !');
    }
    return task;
  }
}
