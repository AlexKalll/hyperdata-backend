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

import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { FlagReasonService } from '../service/FlagReason.service';
import { CreateFlagTypeDto, UpdateFlagTypeDto } from '../dto/FlagType.dto';
@Controller('workspace/rejection-reason')
@ApiTags('RejectionReason')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RejectionReasonController {
  constructor(private readonly flagReasonService: FlagReasonService) {}

  @Post()
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  async create(@Body() createFlagDto: CreateFlagTypeDto, @Request() req) {
    return this.flagReasonService.create({ ...createFlagDto });
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  async findPaginate(@Query() paginateDto: PaginationDto, @Request() req) {
    return this.flagReasonService.findPaginate({}, paginateDto);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER, Role.REVIEWER, Role.CONTRIBUTOR)
  async findAll(@Request() req) {
    return this.flagReasonService.findAll({
      relations: { flagType: true },
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER, Role.REVIEWER)
  async findOne(@Param('id') id: string, @Request() req) {
    return this.flagReasonService.findOne({ where: { id } });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() updateFlagDto: UpdateFlagTypeDto,
    @Request() req,
  ) {
    return this.flagReasonService.update(id, { ...updateFlagDto });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @UsePipes(new ZodValidationPipe())
  async remove(@Param('id') id: string, @Request() req) {
    return this.flagReasonService.remove(id);
  }
}
