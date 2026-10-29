import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';

import { AdminStatistics } from '../services/AdminStatistics.service';
import { DataSetStatisticsDto } from '../dto/Project.dto';

@ApiTags('Statistics')
// Keep the legacy URL available while existing clients move to /statistics/admin.
@Controller(['/statistics/admin', '/statistics/superadmin'])
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminStatisticsController {
  constructor(private readonly adminStatistics: AdminStatistics) {}
  @Get()
  async getAdminStatistics() {
    return await this.adminStatistics.getAllStatistics();
  }
  @Get('/dataset-contribution')
  @ApiQuery({ name: 'view_type', enum: ['WEEKLY', 'MONTHLY', 'YEARLY'] })
  async getAllDataSets(
    @Query('view_type') view_type: 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'WEEKLY',
    @Request() req,
  ) {
    const user_id = req.user.id;
    return await this.adminStatistics.getDataSetStatistics(view_type);
  }
  @Get('/dataset-language')
  async getDataSetsPerLanguageAndDialect(
    @Query() dataSetDto: DataSetStatisticsDto,
    @Request() req,
  ) {
    return await this.adminStatistics.getDataSetByDialectAndLanguage(
      dataSetDto.view_type,
    );
  }
}
