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
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  NotFoundException,
  Patch,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { ProjectService } from '../service/Project.service';
import {
  AssignProjectManagerDto,
  CreateProjectDto,
  GetProjectsDto,
  UpdateProjectDto,
} from '../dto/Project.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerImageS3Storage } from 'src/config/minio.config';
import { DataSource, FindOptionsWhere, ILike } from 'typeorm';
import { FindTaskMembersDto } from '../dto/Task.dto';
import { ActivityLogService } from 'src/common/service/ActivityLog.service';
import {
  ActivityEntityType,
  ActivityLogActions,
} from 'src/utils/constants/ActivityLog.actions';
import { Project } from '../entities/Project.entity';
import { PaginatedResult } from 'src/utils/paginate.util';
import { ProjectSanitize, UserTaskSanitize } from '../sanitize';
import { ForbiddenException } from '@nestjs/common';
import { UserSanitize } from 'src/auth/sanitize';

@Controller('/project-mgmt/project')
@ApiTags('Project')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly activityLogService: ActivityLogService,
    private readonly dataSource: DataSource, // Inject DataSource for transactions
  ) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
        name: { type: 'string', example: 'My Project' },
        description: { type: 'string', example: 'Some description' },
        start_date: { type: 'string', example: '2025-09-01' },
        end_date: { type: 'string', example: '2025-10-01' },
        manager_email: { type: 'string', example: 'manager@example.com' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['tag1', 'tag2'],
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', { storage: multerImageS3Storage }))
  async create(
    @UploadedFile() file: any,
    @Body()
    projectData: CreateProjectDto,
    @Request() req,
  ) {
    let cover_image_url = '';
    cover_image_url = file?.key ?? '';
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const project = await this.projectService.createProjectWithManager(
        {
          ...projectData,
          cover_image_url,
          tags: projectData.tags
            ? projectData.tags.split(',').map((tag) => tag.trim())
            : [],
        },
        queryRunner,
        projectData.manager_email,
      );
      await this.activityLogService.create({
        user_id: req.user.id,
        action: ActivityLogActions.CREATE_PROJECT,
        metadata: JSON.stringify(projectData),
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        entity_type: ActivityEntityType.PROJECT,
        entity_id: project.id,
      });
      await queryRunner.commitTransaction();
      return project;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
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

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  @ApiExtraModels(PaginatedResult, ProjectSanitize)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(ProjectSanitize) },
            },
          },
        },
      ],
    },
  })
  async findPaginate(
    @Query() searchSchema: GetProjectsDto,
    @Request() req,
  ): Promise<PaginatedResult<ProjectSanitize>> {
    const data = await this.projectService.searchPaginate(searchSchema);
    return {
      ...data,
      result: data.result.map((item) => ProjectSanitize.from(item)),
    };
  }

  @Get('archived')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  @ApiExtraModels(PaginatedResult, ProjectSanitize)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(ProjectSanitize) },
            },
          },
        },
      ],
    },
  })
  async findArchivedPaginate(
    @Query() searchSchema: GetProjectsDto,
    @Request() req,
  ): Promise<PaginatedResult<ProjectSanitize>> {
    const page = searchSchema.page;
    const limit = searchSchema.limit;

    // Clean up
    delete searchSchema.page;
    delete searchSchema.limit;

    const baseFilters: FindOptionsWhere<Project> = {};

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
    const data = await this.projectService.findPaginate(
      { where: baseFilters, relations: { manager: true } },
      { page, limit },
    );
    return {
      ...data,
      result: data.result.map((item) => ProjectSanitize.from(item)),
    };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  @ApiResponse({ type: [ProjectSanitize] })
  async findAll(
    @Query() queryOption: UpdateProjectDto,
    @Request() req,
  ): Promise<ProjectSanitize[]> {
    const data = await this.projectService.findAll({
      where: { ...queryOption },
    });
    return data.map((item) => ProjectSanitize.from(item));
  }
  @Get('/manager/my-projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER)
  async managerProjects(@Query() searchSchema: GetProjectsDto, @Request() req) {
    const user_id = req.user.id;
    const data = await this.projectService.searchPaginate(
      searchSchema,
      user_id,
    );
    return {
      ...data,
      result: data.result.map((item) => ProjectSanitize.from(item)),
    };
  }
  @Get('/manager/my-projects/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER)
  async managerAllProjects(@Request() req): Promise<ProjectSanitize[]> {
    const user_id = req.user.id;
    // Build exact match filters from searchSchema
    const result = await this.projectService.findAll({
      where: { manager_id: user_id, is_archived: false },
    });
    return result.map((item) => ProjectSanitize.from(item));
  }
  @Get('/:project_id/manager')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROJECT_MANAGER)
  @ApiResponse({ type: UserSanitize })
  @UsePipes(new ZodValidationPipe())
  async getProjectManager(
    @Param('project_id') project_id: string,
    @Request() req,
  ): Promise<UserSanitize> {
    await this.assertProjectManager(project_id, req);
    const user = await this.projectService.getProjectManager(project_id);
    if (!user) {
      throw new NotFoundException(`Project manager  not found`);
    }
    return UserSanitize.from(user);
  }

  @Post('/assign-manager')
  @Roles(Role.SUPER_ADMIN)
  async assignProjectManager(
    @Body()
    projectManager: AssignProjectManagerDto,
    @Request() req,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const project = await this.projectService.assignProjectManager(
        { ...projectManager },
        queryRunner,
      );
      await queryRunner.commitTransaction();
      return project;
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
  @Get(':id/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @ApiExtraModels(PaginatedResult, UserTaskSanitize)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(UserTaskSanitize) },
            },
          },
        },
      ],
    },
  })
  async findProjectMembers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() queryOption: FindTaskMembersDto,
    @Request() req,
  ): Promise<PaginatedResult<UserTaskSanitize>> {
    await this.assertProjectManager(id, req);
    const page = queryOption.page || 1;
    const limit = queryOption.limit || 10;
    delete queryOption.page;
    delete queryOption.limit;
    const data = await this.projectService.findPaginateProjectMembers(
      id,
      { where: queryOption, relations: { user: true } },
      { page: page, limit: limit },
    );
    return {
      ...data,
      result: data.result.map((item) => UserTaskSanitize.from(item)),
    };
  }
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  @ApiResponse({ type: ProjectSanitize })
  async findOne(@Param('id') id: string, @Request() req) {
    await this.assertProjectManager(id, req);
    const project = await this.projectService.findOne({
      where: { id },
      relations: { manager: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found !');
    }
    return ProjectSanitize.from(project);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       image: {
  //         type: 'string',
  //         format: 'binary',
  //       },
  //     },
  //   },
  // })
  @UseInterceptors(FileInterceptor('image', { storage: multerImageS3Storage }))
  async update(
    @UploadedFile() file: any,
    @Param('id') id: string,
    @Body() projectData: UpdateProjectDto,
    @Request() req,
  ) {
    await this.assertProjectManager(id, req);
    let payload: any = { ...projectData };
    if (file) {
      payload = { ...payload, cover_image_url: file.key };
    }
    const project = await this.projectService.update(id, {
      ...payload,
      tags: projectData.tags
        ? projectData.tags.split(',').map((tag) => tag.trim())
        : undefined,
      updated_by: req.user.id,
    });
    await this.activityLogService.create({
      user_id: req.user.id,
      action: ActivityLogActions.UPDATE_PROJECT,
      metadata: JSON.stringify(projectData),
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      entity_type: ActivityEntityType.PROJECT,
      entity_id: project?.id,
    });
    return project;
  }

  @Patch('archive-toggle/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async archiveToggle(@Param('id') id: string, @Request() req) {
    await this.assertProjectManager(id, req);
    return this.projectService.archiveToggle(id);
  }

  private async assertProjectManager(
    projectId: string,
    req: any,
  ): Promise<void> {
    if (req.user.role.name !== Role.PROJECT_MANAGER) return;
    const project = await this.projectService.findOne({
      where: { id: projectId, manager_id: req.user.id },
    });
    if (!project) {
      throw new ForbiddenException('You do not manage this project');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  async remove(@Param('id') id: string, @Request() req) {
    return this.projectService.remove(id);
  }
}
