import { forwardRef, Module } from '@nestjs/common';
import { DataSetModule } from 'src/data_set/data_set.module';
import { CacheService } from './CacheService.service';
import { CacheController } from './CacheController.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [forwardRef(() => DataSetModule), ConfigModule],
  providers: [
    // FileUploadProcessor,
    CacheService,
  ],
  controllers: [CacheController],
  exports: [CacheService],
})
export class CacheModule {}
