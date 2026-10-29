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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateTaskTypeDto, UpdateTaskTypeDto } from '../dto/TaskType.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { TaskTypeService } from '../service/TaskType.service';

@Controller('/project-mgmt/task-type')
@ApiTags('TaskType')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TaskTypeController {
  constructor(private readonly taskTypeService: TaskTypeService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UsePipes(new ZodValidationPipe(CreateTaskTypeDto))
  async create(@Body() taskTypeData: CreateTaskTypeDto, @Request() req) {
    return this.taskTypeService.create({
      ...taskTypeData,
      created_by: req.user.id,
    });
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UsePipes(new ZodValidationPipe())
  async findPaginate(@Query() paginateDto: PaginationDto, @Request() req) {
    return this.taskTypeService.findPaginate({}, paginateDto);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(@Query() queryOption: UpdateTaskTypeDto, @Request() req) {
    return this.taskTypeService.findAll({ where: { ...queryOption } });
  }

  @Get(':id')
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string, @Request() req) {
    return this.taskTypeService.findOne({ where: { id } });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() taskTypeData: UpdateTaskTypeDto,
    @Request() req,
  ) {
    return this.taskTypeService.update(id, {
      ...taskTypeData,
      updated_by: req.user.id,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe())
  async remove(@Param('id') id: string, @Request() req) {
    return this.taskTypeService.remove(id);
  }
}
