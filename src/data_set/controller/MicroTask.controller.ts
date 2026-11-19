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
  BadRequestException,
  ConflictException,
  Logger,
  Res,
  ParseUUIDPipe,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { MicroTaskService } from '../service/MicroTask.service';
import {
  CreateMicroTaskDto,
  GetMicroTasksDto,
  ImportMicroTaskFromOtherTaskDto,
  UpdateMicroTaskDto,
} from '../dto/MicroTask.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  multerAudioS3Storage,
  multerCSVS3Storage,
} from 'src/config/minio.config';
import { DataSource, FindOptionsWhere, QueryRunner } from 'typeorm';
import { FileService } from 'src/common/service/File.service';
import { ActivityLogService } from 'src/common/service/ActivityLog.service';
import {
  ActivityEntityType,
  ActivityLogActions,
} from 'src/utils/constants/ActivityLog.actions';
import { MicroTask } from '../entities/MicroTask.entity';
import XLSX from 'xlsx';
import { Response } from 'express';
import { MicroTaskRto } from '../rto/MicroTask.rto';
import { ProjectScopeGuard } from 'src/project/guard/ProjectScope.guard';
import { memoryStorage } from 'multer';
import { createHash, randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
@Controller('workspace/micro-task')
@ApiTags('MicroTask')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectScopeGuard)
@ApiBearerAuth()
export class MicroTaskController {
  constructor(
    private readonly microTaskService: MicroTaskService,
    private readonly fileService: FileService,
    private readonly activityLogService: ActivityLogService,
    private readonly dataSource: DataSource, // Inject DataSource for transactions
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  async create(@Body() microTaskDto: CreateMicroTaskDto, @Request() req) {
    const microTask = await this.microTaskService.createTextMicroTask({
      ...microTaskDto,
      type: 'text',
      created_by: req.user.id,
    });
    await this.activityLogService.create({
      user_id: req.user.id,
      action: ActivityLogActions.CREATE_MICRO_TASK,
      metadata: JSON.stringify(microTaskDto),
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      entity_type: ActivityEntityType.MICRO_TASK,
      entity_id: microTask.id,
    });
    return microTask;
  }

  @Post('/:task_id/import_csv')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @ApiParam({ name: 'task_id', type: 'string' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: multerCSVS3Storage }))
  async importCSV(
    @UploadedFile() file: any,
    @Param('task_id') task_id: string,
    @Request() req,
  ) {
    // get the file path from the file object
    if (!file) throw new BadRequestException('CSV File Required');
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const filePath = file.key; // This is the URL of the uploaded file in MinIO
      const file_content = await this.fileService.getXlsxContent(filePath);
      const data: {
        no: number;
        text: string;
      }[] = file_content;
      // Validate the data format
      if (!Array.isArray(data) || data.length === 0) {
        throw new BadRequestException(
          'Invalid CSV file format. Expected an array of objects.',
        );
      }
      // Assuming data is an array of objects
      const microTasks =
        await this.microTaskService.createMultipleTextMicroTask(
          data,
          task_id,
          queryRunner,
        );
      await queryRunner.commitTransaction();
      await this.activityLogService.create({
        user_id: req.user.id,
        action: ActivityLogActions.CREATE_MICRO_TASK,
        metadata: 'file',
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        entity_type: ActivityEntityType.MICRO_TASK,
        entity_id: microTasks.map((microTask) => microTask.id).join(','),
      });
      return microTasks;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // delete the file from MinIO if needed
      await this.fileService.deleteFile(file.key);
      throw error;
    } finally {
      await queryRunner.release();
      // delete the file from MinIO if needed
      await this.fileService.deleteFile(file.key);
    }
  }

  @Post('/:task_id/import_from_other_task')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @ApiParam({ name: 'task_id', type: 'string' })
  async importFromOtherTask(
    @Param('task_id') task_id: string,
    @Body() microTaskDto: ImportMicroTaskFromOtherTaskDto,
    @Request() req,
  ) {
    // get the file path from the file object
    const task_id_to_import = microTaskDto.source_task_id;
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      let sourceTasks: MicroTask[] = [];
      if (microTaskDto.from_micro_task) {
        sourceTasks = await this.microTaskService.importMicroTaskFromOtherTask(
          task_id,
          task_id_to_import,
          req.user.id,
          queryRunner,
          microTaskDto.limit,
        );
      } else {
        sourceTasks =
          await this.microTaskService.importMicroTaskFromOtherTaskDataset(
            task_id,
            task_id_to_import,
            req.user.id,
            queryRunner,
            microTaskDto.limit,
          );
      }
      await queryRunner.commitTransaction();
      return (
        'Imported ' +
        sourceTasks.length +
        ' Micro Tasks from Task ID: ' +
        task_id_to_import
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Error importing micro tasks from other task: ' + error.message,
      );
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

  @Get('/:task_id/export_csv')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @ApiParam({ name: 'task_id', type: 'string' })
  @UseInterceptors(FileInterceptor('file', { storage: multerCSVS3Storage }))
  async exportCSV(
    @Param('task_id') task_id: string,
    @Res() response: Response,
  ) {
    // get the file path from the file object
    const allMicroTasks: MicroTask[] = await this.microTaskService.findAll({
      where: { task_id: task_id },
    });
    const micro_tasks: {
      no: number;
      text: string;
    }[] = allMicroTasks.map((microTask, index) => {
      return { no: index, text: microTask.text };
    });
    // Convert the data to CSV format
    if (micro_tasks.length === 0)
      throw new BadRequestException('No Data Found');
    const csvData = micro_tasks.map((item) => ({
      text: item,
    }));
    // Convert to CSV string
    const worksheet = XLSX.utils.json_to_sheet(micro_tasks);
    // Create a new workbook
    const fileName = `MicroTask`;
    const workbook = XLSX.utils.book_new();
    // Append the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, fileName);

    // Write the workbook to a buffer
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
    // Set headers for downloading the file
    response.set(
      'Content-Disposition',
      'attachment; filename="MicroTask.xlsx"',
    );
    response.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    // Send the buffer as a response
    response.send(excelBuffer);
  }
  @Get('/contributor/submissions/:task_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @ApiResponse({
    type: MicroTaskRto,
  })
  async getContributorParticipatedDataSets(
    @Param('task_id', ParseUUIDPipe) task_id: string,
    @Query() paginateDto: PaginationDto,
    @Request() req,
  ) {
    const user_id = req.user.id;
    return this.microTaskService.getContributorParticipatedDataSets(
      user_id,
      task_id,
      paginateDto,
    );
  }

  @Post('/:task_id/image')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        upload_id: {
          type: 'string',
          format: 'uuid',
          description: 'Reuse this UUID v4 when retrying the same image upload',
        },
        instruction: { type: 'string' },
        is_test: { type: 'boolean' },
      },
    },
  })
  async createImageMicroTask(
    @UploadedFile() file: Express.Multer.File,
    @Param('task_id', ParseUUIDPipe) taskId: string,
    @Request() req,
  ) {
    if (!file?.size) throw new BadRequestException('Image required');
    if (
      req.body.is_test !== undefined &&
      !['true', 'false', true, false].includes(req.body.is_test)
    ) {
      throw new BadRequestException('is_test must be true or false');
    }
    if (
      req.body.instruction !== undefined &&
      typeof req.body.instruction !== 'string'
    ) {
      throw new BadRequestException('instruction must be text');
    }
    if (req.body.upload_id !== undefined && !isUUID(req.body.upload_id, '4')) {
      throw new BadRequestException('upload_id must be a UUID v4');
    }
    // Older API clients may omit the ID; dashboard retries always reuse one.
    const uploadId = (req.body.upload_id || randomUUID()).toLowerCase();
    const instruction = req.body.instruction || null;
    const isTest = req.body.is_test === 'true' || req.body.is_test === true;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([instruction, isTest]))
      .update('\0')
      .update(file.buffer)
      .digest('hex');
    const key = `images/micro-tasks/${randomUUID()}`;
    const runner = this.dataSource.createQueryRunner();
    let uploaded = false;
    await runner.connect();
    try {
      await runner.startTransaction('READ COMMITTED');
      // A transaction-scoped lock serializes only retries of this upload,
      // including requests handled by different API instances.
      const lockId = createHash('sha256')
        .update(
          `image-upload:${taskId.toLowerCase()}:${req.user.id}:${uploadId}`,
        )
        .digest()
        .readBigInt64BE()
        .toString();
      await runner.query('SELECT pg_advisory_xact_lock($1::bigint)', [lockId]);
      const existing = await runner.manager.findOne(MicroTask, {
        where: {
          task_id: taskId,
          created_by: req.user.id,
          image_upload_id: uploadId,
        },
        withDeleted: true,
      });
      if (existing) {
        if (existing.image_upload_fingerprint !== fingerprint) {
          throw new ConflictException(
            'This upload_id was already used with a different image or settings',
          );
        }
        if (existing.deletedAt) {
          throw new ConflictException('This image upload was already deleted');
        }
        await runner.commitTransaction();
        return existing;
      }
      const microTask = await this.microTaskService.createImageMicroTask(
        {
          task_id: taskId,
          file_path: key,
          created_by: req.user.id,
          instruction,
          is_test: isTest,
          image_upload_id: uploadId,
          image_upload_fingerprint: fingerprint,
        },
        runner,
      );
      await this.fileService.uploadMicroTaskImage(key, file.buffer);
      uploaded = true;
      await this.activityLogService.create(
        {
          user_id: req.user.id,
          action: ActivityLogActions.CREATE_MICRO_TASK,
          metadata: 'image',
          ip: req.ip,
          user_agent: req.headers['user-agent'],
          entity_type: ActivityEntityType.MICRO_TASK,
          entity_id: microTask.id,
        },
        runner,
      );
      await runner.commitTransaction();
      return microTask;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      if (uploaded) {
        try {
          await this.fileService.deleteFile(key);
        } catch {
          Logger.error(
            `Failed to clean up image ${key}`,
            'MicroTaskController',
          );
        }
      }
      throw error;
    } finally {
      await runner.release();
    }
  }

  @Post('/:task_id/audio')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @ApiParam({ name: 'task_id', type: 'string' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerAudioS3Storage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('audio/')) {
          return cb(new Error('Only audio files are allowed!'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async createAudioDataSet(
    @UploadedFile() file: any,
    @Param('task_id') task_id: string,
    @Request() req,
  ) {
    // get the file path from the file object
    if (!file) throw new BadRequestException('Audio Required');
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const is_test = req.body.is_test === 'true' || req.body.is_test === true;
    const instruction = req.body.instruction ? req.body.instruction : null;
    try {
      const filePath = file.key; // This is the URL of the uploaded file in MinIO
      const dataDto = {
        task_id: task_id, // Assuming task_id is the same as micro_task_id
        // file: filePath, // Use the file path as the text data set
        file_path: filePath,
        type: 'audio',
        is_test: is_test,
        instruction: instruction,
        contributer_id: req.user.id,
        created_by: req.user.id,
      };
      // Call the service method to create the audio data set
      const audio = await this.microTaskService.createAudioMicroTask({
        ...dataDto,
      });
      await this.activityLogService.create({
        user_id: req.user.id,
        action: ActivityLogActions.CREATE_MICRO_TASK,
        metadata: 'file',
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        entity_type: ActivityEntityType.MICRO_TASK,
        entity_id: audio.id,
      });
      await queryRunner.commitTransaction();
      return audio;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // delete the file from MinIO if needed
      await this.fileService.deleteFile(file.key);
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

  @Post('/:task_id/audios')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @ApiParam({ name: 'task_id', type: 'string' })
  @UseInterceptors(
    FilesInterceptor(
      'files',
      10,
      {
        storage: multerAudioS3Storage,
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          if (!file.mimetype.startsWith('audio/')) {
            return cb(new Error('Only audio files are allowed!'), false);
          } else {
            cb(null, true);
          }
        },
      },
      //   {
      //   storage: multerAudioS3Storage,
      //   limits: { fileSize: 10 * 1024 * 1024 },
      //   fileFilter: (req, file, cb) => {
      //     if (!file.mimetype.startsWith('audio/')) {
      //       return cb(new Error('Only audio files are allowed!'), false);
      //     } else {
      //       cb(null, true);
      //     }
      //   }
      // }
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['files'], // optional: if files are required
    },
  })
  async createAudioDataSets(
    @UploadedFiles() files: any[],
    @Param('task_id', ParseUUIDPipe) task_id: string,
    @Request() req,
  ) {
    // get the file path from the file object
    if (!files || files.length === 0)
      throw new BadRequestException('Audio Required');
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const is_test = req.body.is_test === 'true' || req.body.is_test === true;
    const instruction = req.body.instruction ? req.body.instruction : null;
    try {
      const audiosMetada = await Promise.all(
        files.map(async (file) => {
          const filePath = file.key; // This is the URL of the uploaded file in MinIO
          return {
            task_id: task_id, // Assuming task_id is the same as micro_task_id
            file_path: filePath,
            type: 'audio',
            is_test: is_test,
            instruction: instruction,
            contributer_id: req.user.id,
            created_by: req.user.id,
          };
        }),
      );
      await this.microTaskService.createMultipleAudioMicroTask(
        task_id,
        audiosMetada,
        queryRunner,
      );
      await this.activityLogService.create({
        user_id: req.user.id,
        action: ActivityLogActions.CREATE_MICRO_TASK,
        metadata: 'file',
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        entity_type: ActivityEntityType.MICRO_TASK,
      });
      await queryRunner.commitTransaction();
      return 'success';
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await Promise.all(
        files.map(async (file) => {
          // delete the file from MinIO if needed
          await this.fileService.deleteFile(file.key);
        }),
      );
      // delete the file from MinIO if needed
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  async findPaginate(@Query() searchSchema: GetMicroTasksDto, @Request() req) {
    const page = searchSchema.page;
    const limit = searchSchema.limit;

    delete searchSchema.page;
    delete searchSchema.limit;
    const baseFilters: FindOptionsWhere<MicroTask> = {};
    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null) {
        baseFilters[key] = value;
      }
    }
    return this.microTaskService.findPaginate({}, { page, limit });
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  async findAll(@Request() req) {
    return this.microTaskService.findAll({});
  }
  @Get('my-tasks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @UsePipes(new ZodValidationPipe())
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, type: Number })
  async findMyMicroTasks(@Query() pagintionDto: PaginationDto, @Request() req) {
    const user_id = req.user.id;
    return this.microTaskService.contributorMicroTasks(user_id, pagintionDto);
  }
  @Get('task/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER, Role.REVIEWER, Role.CONTRIBUTOR)
  // @UsePipes(new ZodValidationPipe())
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findByTask(
    @Param('id') id: string,
    @Query() searchSchema: GetMicroTasksDto,
    @Request() req,
  ) {
    const page = searchSchema.page;
    const limit = searchSchema.limit;

    delete searchSchema.page;
    delete searchSchema.limit;
    const searchFilter: FindOptionsWhere<MicroTask> = {};
    // Build exact match filters from searchSchema
    for (const [key, value] of Object.entries(searchSchema)) {
      if (value !== undefined && value !== null) {
        searchFilter[key] = value;
      }
    }
    searchFilter['task_id'] = id;
    return this.microTaskService.findPaginate(
      {
        where: searchFilter,
      },
      { page, limit },
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string, @Request() req) {
    return this.microTaskService.findOne({ where: { id } });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() microTaskData: UpdateMicroTaskDto,
    @Request() req,
  ) {
    await this.activityLogService.create({
      user_id: req.user.id,
      action: ActivityLogActions.UPDATE_MICRO_TASK,
      metadata: 'file',
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      entity_type: ActivityEntityType.MICRO_TASK,
      entity_id: id,
    });
    return this.microTaskService.update(id, {
      ...microTaskData,
      updated_by: req.user.id,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  async remove(@Param('id') id: string, @Request() req) {
    return this.microTaskService.remove(id);
  }
}
