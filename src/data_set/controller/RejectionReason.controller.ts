import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateRejectionReasonDto } from '../dto/RejectionReason.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { RejectionReasonService } from '../service/RejectionReason.service';
import { RejectionReason } from '../entities/RejectionReason.entity';
@Controller('workspace/rejection-reason')
@ApiTags('RejectionReason')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RejectionReasonController {
  constructor(
    private readonly rejectionReasonService: RejectionReasonService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  async create(@Body() rejectDto: CreateRejectionReasonDto, @Request() req) {
    return this.rejectionReasonService.create({ ...rejectDto });
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  async findPaginate(@Query() paginateDto: PaginationDto, @Request() req) {
    return this.rejectionReasonService.findPaginate({}, paginateDto);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER, Role.REVIEWER, Role.CONTRIBUTOR)
  async findAll(@Request() req) {
    return this.rejectionReasonService.findAll({
      relations: { rejectionType: true },
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER, Role.REVIEWER)
  async findOne(@Param('id') id: string, @Request() req) {
    return this.rejectionReasonService.findOne({ where: { id } });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() rejectionReason: RejectionReason,
    @Request() req,
  ) {
    return this.rejectionReasonService.update(id, { ...rejectionReason });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  async remove(@Param('id') id: string, @Request() req) {
    return this.rejectionReasonService.remove(id);
  }
}
