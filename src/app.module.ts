import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BaseDataModule } from './base_data/base_data.module';
import { CommonModule } from './common/common.module';
import { ProjectModule } from './project/project.module';
import { DataSetModule } from './data_set/data_set.module';
import { CommunicationModule } from './communication/communication.module';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from 'src/database/data-source';
import { ConfigModule } from '@nestjs/config';
import { SmsModule } from './sms/sms.module';
import { FinanceModule } from './finance/finance.module';
import { EmailModule } from './email/email.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HealthModule } from './health/health.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { TaskDistributionModule } from './task_distribution/task_distribution.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { StatisticsModule } from './statistics/statistics.module';
import { CacheModule } from './cache/cache.module';
import { BullModule } from '@nestjs/bullmq';
import { BackgroundTaskModule } from './background_task/background_task.module';
import * as Joi from 'joi';
import configuration from './config/configuration';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, //  Makes ConfigModule available in all modules,
      load: [configuration],
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
        NODE_ENV: Joi.string()
          .required()
          .valid('development', 'production', 'test', 'provision'),
        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        OTP_HMAC_SECRET: Joi.string().min(32).required(),
        TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),
        DATABASE_URL: Joi.string().required(),
        DATABASE_SCHEMA: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_URL: Joi.string().required(),
        REDIS_PASSWORD: Joi.string().min(32).required(),
        RABBITMQ_URI: Joi.string().required(),
        RABBITMQ_QUEUE_NAME: Joi.string().required(),
        RABBITMQ_EXCHANGE_NAME: Joi.string().required(),
        RABBITMQ_EXCHANGE_TYPE: Joi.string().required(),
        RABBITMQ_ROUTING_KEY: Joi.string().required(),
        RABBITMQ_DURABLE: Joi.string().required(),
        DATASET_RABBITMQ_EXCHANGE_NAME: Joi.string().required(),
        DATASET_RABBITMQ_QUEUE_NAME: Joi.string().required(),
        DATASET_RABBITMQ_ROUTING_KEY: Joi.string().required(),
        SMS_BASE_URL: Joi.string().required(),
        SMS_IDENTIFIER: Joi.string().required(),
        SMS_SENDER: Joi.string().required(),
        SMS_TOKEN: Joi.string().required(),
        MINIO_ENDPOINT: Joi.string().required(),
        MINIO_ACCESS_KEY: Joi.string().required(),
        MINIO_SECRET_KEY: Joi.string().required(),
        MINIO_BUCKET: Joi.string().required(),
        EMAIL_USER: Joi.string().required(),
        EMAIL_PASS: Joi.string().required(),
        ENABLE_WITHDRAWALS: Joi.string()
          .valid('true', 'false')
          .default('false'),
        PAYMENT_BASE_URL: Joi.string().uri().when('ENABLE_WITHDRAWALS', {
          is: 'true',
          then: Joi.required(),
        }),
        PAYMENT_MERCHANT_ID: Joi.string().when('ENABLE_WITHDRAWALS', {
          is: 'true',
          then: Joi.required(),
        }),
        PAYMENT_NOTIFY_URL: Joi.string().uri().allow('').optional(),
        SANTIM_PAY_PRIVATE_KEY_IN_PEM: Joi.alternatives().conditional(
          'ENABLE_WITHDRAWALS',
          {
            is: 'true',
            then: Joi.string().min(1).required(),
            otherwise: Joi.string().allow('').optional(),
          },
        ),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    MailerModule.forRoot({
      transport: {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      },
      defaults: {
        from: '"Mahder" mahder@gmail.com',
      },
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
        // host: 'localhost',
        // port: 6379,
      },
    }),

    TypeOrmModule.forRoot(dataSourceOptions),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    SmsModule,
    BaseDataModule,
    AuthModule,
    CommonModule,
    ProjectModule,
    DataSetModule,
    CommunicationModule,
    FinanceModule,
    EmailModule,
    HealthModule,
    TaskDistributionModule,
    StatisticsModule,
    CacheModule,
    BackgroundTaskModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
