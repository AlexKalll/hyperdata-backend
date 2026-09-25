import {
  Controller,
  Get,
  Body,
  Put,
  Delete,
  Param,
  Query,
  UsePipes,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ApproveDataSetDto,
  FindContributorDatesetDto,
  FindReviewerDataSetDto,
  GetDataSetDto,
  TaskSubmissionsDto,
  UpdateDataSetDto,
} from '../dto/DataSet.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { DataSetService } from '../service/DataSet.service';
import { DataSource, FindOptionsWhere, QueryRunner } from 'typeorm';
import { CreateRejectionReasonDto } from '../dto/RejectionReason.dto';
import { ActivityLogService } from 'src/common/service/ActivityLog.service';
import {
  ActivityEntityType,
  ActivityLogActions,
} from 'src/utils/constants/ActivityLog.actions';
import { DataSet } from '../entities/DataSet.entity';
import { PaginatedResult } from 'src/utils/paginate.util';
import { DataSetSanitize } from '../sanitize';
import { RejectionReason } from '../entities/RejectionReason.entity';
import { PublisherService } from 'src/common/service/RabbitPublish.service';
@Controller('workspace/data-set')
@ApiTags('DataSet')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiExtraModels(PaginatedResult, DataSetSanitize)
export class DataSetController {
  constructor(
    private readonly dataSetService: DataSetService, // create a query runner for transaction
    private readonly dataSource: DataSource, // Inject DataSource for transactions
    private readonly activityLogService: ActivityLogService,
    private readonly publishService: PublisherService,
  ) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(DataSetSanitize) },
            },
          },
        },
      ],
    },
  })
  async findPaginate(
    @Query() searchSchem: GetDataSetDto,
    @Request() req,
  ): Promise<PaginatedResult<DataSetSanitize>> {
    const page = searchSchem.page;
    const limit = searchSchem.limit;
    delete searchSchem.page;
    delete searchSchem.limit;
    const searchFilter: FindOptionsWhere<DataSet> = {};
    for (const [key, value] of Object.entries(searchSchem)) {
      if (value !== undefined && value !== null) {
        searchFilter[key] = value;
      }
    }
    const data = await this.dataSetService.findPaginate(
      { where: searchFilter },
      { page, limit },
    );
    const result = data.result.map((item) => DataSetSanitize.from(item));
    return {
      ...data,
      result,
    };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  @ApiResponse({
    status: 200,
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(DataSetSanitize) },
    },
  })
  async findAll(@Request() req) {
    const data = await this.dataSetService.findAll({});
    return data.map((item) => DataSetSanitize.from(item));
  }
  @Get('contributor/my-data-sets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(DataSetSanitize) },
            },
          },
        },
      ],
    },
  })
  async contributorDataSets(
    @Query() paginateDto: PaginationDto,
    @Request() req,
  ) {
    const user_id = req.user.id;
    const data = await this.dataSetService.findPaginate(
      { where: { contributor_id: user_id } },
      paginateDto,
    );
    const result = data.result.map((item) => DataSetSanitize.from(item));
    return {
      ...data,
      result,
    };
  }

  @Get('contributor/:micro_task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiResponse({
    description: 'get contributor submission details',
    status: 200,
  })
  contributorSubmission(
    @Param('micro_task_id', ParseUUIDPipe) microTaskId: string,
    @Request() req,
  ) {
    const user = req.user;
    return this.dataSetService.contributorSubmission(microTaskId, user.id);
  }
  @Get('reviewer/:task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.REVIEWER)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(DataSetSanitize) },
            },
          },
        },
      ],
    },
  })
  async findReviewerDataSets(
    @Param('task_id', ParseUUIDPipe) task_id: string,
    @Query() filterDataSetDto: FindReviewerDataSetDto,
    @Request() req,
  ) {
    const user_id = req.user.id;
    const data = await this.dataSetService.findReviewerDataSets(
      user_id,
      task_id,
      { page: filterDataSetDto.page, limit: filterDataSetDto.limit },
      filterDataSetDto.status,
    );
    const result = data.result.map((item) => DataSetSanitize.from(item));
    return {
      ...data,
      result,
    };
  }

  @Get('task/:task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER, Role.FACILITATOR)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(DataSetSanitize) },
            },
          },
        },
      ],
    },
  })
  async findByTask(
    @Param('task_id', ParseUUIDPipe) task_id: string,
    @Query() submissionDto: TaskSubmissionsDto,
  ) {
    const data = await this.dataSetService.getTaskDataSetsSubmissions(
      task_id,
      submissionDto,
    );
    const result = data.result.map((item) => DataSetSanitize.from(item));
    return {
      ...data,
      result,
    };
  }

  @Get('micro_task/:micro_task_id')
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(DataSetSanitize) },
            },
          },
        },
      ],
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROJECT_MANAGER,
    Role.REVIEWER,
    Role.CONTRIBUTOR,
  )
  async findByMicroTask(
    @Param('micro_task_id', ParseUUIDPipe) id: string,
    @Query() searchSchem: GetDataSetDto,
    @Request() req,
  ) {
    const page = searchSchem.page;
    const limit = searchSchem.limit;
    delete searchSchem.page;
    delete searchSchem.limit;
    const searchFilter: FindOptionsWhere<DataSet> = {};
    for (const [key, value] of Object.entries(searchSchem)) {
      if (value !== undefined && value !== null) {
        searchFilter[key] = value;
      }
    }
    searchFilter['micro_task_id'] = id;
    const data = await this.dataSetService.findPaginate(
      {
        where: searchFilter,
        relations: {
          microTask: true,
        },
      },
      { page, limit },
    );

    const result = data.result.map((item) => DataSetSanitize.from(item));
    return {
      ...data,
      result,
    };
  }
  @Get('/facilitator/contributor/submissions/:task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FACILITATOR)
  @ApiQuery({ name: 'contributor_id', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getContributorDataSets(
    @Param('task_id', ParseUUIDPipe) task_id: string,
    @Query() query: FindContributorDatesetDto,
    @Request() req,
  ) {
    return this.dataSetService.getTaskDataSetsSubmissionsPerContributor(
      task_id,
      query.contributor_id,
      { page: query.page, limit: query.limit },
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.dataSetService.findOne({
      where: { id },
      relations: { microTask: true, rejectionReasons: { rejectionType: true } },
    });
  }

  @Put('/approve/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.REVIEWER)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveDataSetDto,
    @Request() req,
  ) {
    // create query runner
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.dataSetService.approveDataSet(
        id,
        req.user.id,
        queryRunner,
        body.annotation,
      );
      await this.activityLogService.create({
        user_id: req.user.id,
        action: ActivityLogActions.APPROVE_DATASET,
        metadata: '',
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        entity_type: ActivityEntityType.DATASET,
        entity_id: id,
      });
      await queryRunner.commitTransaction();
      await this.publishService.publishDatasetAction({
        action: 'APPROVED',
        datasetId: id,
        actorId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return {
        message: 'Data set approved successfully',
      };
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

  // @Put('/flag/:id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(
  //   Role.ADMIN,
  //   Role.SUPER_ADMIN,
  //   Role.PROJECT_MANAGER,
  //   Role.REVIEWER,
  //   Role.FACILITATOR,
  // )
  // async flag(
  //   @Param('id', ParseUUIDPipe) id: string,
  //   @Body() body: FlagReasonDto,
  //   @Request() req,
  // ) {
  //   // create query runner
  //   const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
  //   await queryRunner.connect();
  //   await queryRunner.startTransaction();
  //   try {
  //     let d = await this.dataSetService.flagDataSet(
  //       id,
  //       body,
  //       req.user.id,
  //       queryRunner,
  //     );
  //     await this.activityLogService.create({
  //       user_id: req.user.id,
  //       action: ActivityLogActions.APPROVE_DATASET,
  //       metadata: '',
  //       ip: req.ip,
  //       user_agent: req.headers['user-agent'],
  //       entity_type: ActivityEntityType.DATASET,
  //       entity_id: id,
  //     });
  //     await queryRunner.commitTransaction();
  //     return d;
  //   } catch (error) {
  //     await queryRunner.rollbackTransaction();
  //     throw error;
  //   } finally {
  //     if (queryRunner) {
  //       try {
  //         await queryRunner.release();
  //       } catch (releaseError) {
  //         console.error('Error releasing queryRunner:', releaseError);
  //       }
  //     }
  //   }
  // }

  @Put('/reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.REVIEWER)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectionReason: CreateRejectionReasonDto,
    @Request() req,
  ) {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const rejectionReasons: Partial<RejectionReason>[] =
      rejectionReason.rejection_type_ids.map((r) => {
        return {
          data_set_id: id,
          rejection_type_id: r,
          comment: rejectionReason.comment,
        };
      });
    try {
      const reject = await this.dataSetService.rejectDataSet(
        id,
        rejectionReasons,
        req.user.id,
        queryRunner,
        rejectionReason.flag,
      );
      await this.activityLogService.create({
        user_id: req.user.id,
        action: ActivityLogActions.REJECT_DATASET,
        metadata: '',
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        entity_type: ActivityEntityType.DATASET,
        entity_id: id,
      });
      await queryRunner.commitTransaction();
      await this.publishService.publishDatasetAction({
        action: 'REJECTED',
        datasetId: id,
        actorId: req.user.id,
        timestamp: new Date().toISOString(),
      });
      return reject;
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

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() dataDto: UpdateDataSetDto,
    @Request() req,
  ) {
    return this.dataSetService.update(id, {
      ...dataDto,
      updated_by: req.user.id,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.CONTRIBUTOR)
  @UsePipes(new ZodValidationPipe())
  async remove(@Param('id') id: string, @Request() req) {
    const contributorId =
      req.user.role.name === Role.CONTRIBUTOR ? req.user.id : undefined;
    return this.dataSetService.remove(id, contributorId);
  }
}
