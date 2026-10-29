import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { DataSetModule } from 'src/data_set/data_set.module';
import { ProjectModule } from 'src/project/project.module';
import { AdminStatistics } from './services/AdminStatistics.service';
import { AdminStatisticsController } from './controllers/AdminStatistics.controller';
import { BaseDataModule } from 'src/base_data/base_data.module';
import { ProjectStatisticsController } from './controllers/ProjectStatistics.controller';
import { ProjectStatisticsService } from './services/ProjectStatistics.service';
import { ReviewerStatisticsController } from './controllers/ReviewerStatistics.controller';
import { ReviewerStatistics } from './services/ReviewerStatistics.service';
@Module({
  imports: [AuthModule, DataSetModule, ProjectModule, BaseDataModule],
  exports: [],
  providers: [AdminStatistics, ProjectStatisticsService, ReviewerStatistics],
  controllers: [
    AdminStatisticsController,
    ProjectStatisticsController,
    ReviewerStatisticsController,
  ],
})
export class StatisticsModule {}
