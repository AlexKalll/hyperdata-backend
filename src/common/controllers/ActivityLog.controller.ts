import {
  Controller,
  Get,
  Query,
  ParseUUIDPipe,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ActivityLogService } from '../service/ActivityLog.service';
import { PaginationDto } from '../dto/Pagination.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import { ActivityLogDto } from '../dto/ActivityLog.dto';
import { Between, FindOptionsWhere, LessThan, MoreThan } from 'typeorm';
import { ActivityLogs } from '../entities/ActivityLogs.entity';

@Controller('activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('Activity Logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('my-activity-logs')
  @ApiResponse({ status: 200, description: 'List of activity logs' })
  @ApiOperation({ summary: 'Get all activity logs' })
  @ApiQuery({ type: PaginationDto })
  async findPaginate(
    @Query() paginateDto: ActivityLogDto,
    @Request() req,
  ): Promise<any> {
    const start_date = paginateDto.start_date;
    const end_date = paginateDto.end_date;
    const activityLogQuery: FindOptionsWhere<ActivityLogs> = {};
    if (start_date && end_date) {
      activityLogQuery.created_date = Between(start_date, end_date);
    } else if (start_date) {
      activityLogQuery.created_date = MoreThan(start_date);
    } else if (end_date) {
      activityLogQuery.created_date = LessThan(end_date);
    }
    return this.activityLogService.find(paginateDto, {
      where: { user_id: req.user.id, ...activityLogQuery },
    });
  }

  @Get(':user_id')
  @ApiResponse({ status: 200, description: 'List of activity logs by user id' })
  @ApiOperation({ summary: 'Get all activity logs by user id' })
  @ApiQuery({ type: PaginationDto })
  @ApiParam({ name: 'user_id', type: String, required: true })
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER, Role.FACILITATOR)
  async findByUserId(
    @Param('user_id', ParseUUIDPipe) user_id: string,
    @Query() paginateDto: ActivityLogDto,
  ): Promise<any> {
    const start_date = paginateDto.start_date;
    const end_date = paginateDto.end_date;
    const activityLogQuery: FindOptionsWhere<ActivityLogs> = {};
    if (start_date && end_date) {
      activityLogQuery.created_date = Between(start_date, end_date);
    } else if (start_date) {
      activityLogQuery.created_date = MoreThan(start_date);
    } else if (end_date) {
      activityLogQuery.created_date = LessThan(end_date);
    }
    activityLogQuery.user_id = user_id;
    return this.activityLogService.find(paginateDto, {
      where: activityLogQuery,
      relations: { user: true },
    });
  }
}
