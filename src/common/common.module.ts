import { Global, Module } from '@nestjs/common';
import { PaginationService } from './service/pagination.service';
import { FileService } from './service/File.service';
import { ActivityLogs } from './entities/ActivityLogs.entity';
import { ActivityLogService } from './service/ActivityLog.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogController } from './controllers/ActivityLog.controller';
import { Notification } from './entities/Notifaction.entity';
import { NotificationService } from './service/Notification.service';
import { NotificationController } from './controllers/Notification.controller';
import { PublisherService } from './service/RabbitPublish.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TestController } from './controllers/Test.controller';
import { AudioService } from './service/Audio.service';
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityLogs, Notification]),
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('RABBITMQ_URI'),
        exchanges: [
          {
            name: config.get<string>('RABBITMQ_EXCHANGE_NAME') as string,
            type: config.get<string>('RABBITMQ_EXCHANGE_TYPE'),
          },
          {
            name: config.get<string>(
              'DATASET_RABBITMQ_EXCHANGE_NAME',
            ) as string,
          },
        ],
        queues: [
          {
            name: config.get<string>('DATASET_RABBITMQ_QUEUE_NAME') as string,
            options: { durable: true },
          },
          {
            name: config.get<string>('RABBITMQ_QUEUE_NAME') as string,
            options: { durable: true },
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  // Test endpoints can publish workflow events and must never be registered in production.
  controllers: [
    ActivityLogController,
    NotificationController,
    ...(process.env.NODE_ENV === 'production' ? [] : [TestController]),
  ],
  providers: [
    PaginationService,
    FileService,
    ActivityLogService,
    NotificationService,
    PublisherService,
    AudioService,
  ],
  exports: [
    PaginationService,
    FileService,
    ActivityLogService,
    NotificationService,
    PublisherService,
    AudioService,
  ],
})
export class CommonModule {}
