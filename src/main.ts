import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { patchNestJsSwagger } from 'nestjs-zod';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalResponseInterceptor } from './common/interceptors/global-response.interceptor';
import { CustomValidationPipe } from './utils/CustomValidationPipe';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

function parseCorsOrigin(corsOrigin: string): string | string[] {
  const origins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.includes('*')) {
    return '*';
  }

  return origins;
}

function sanitizeUrl(rawUrl?: string): string {
  if (!rawUrl) {
    return 'not configured';
  }

  return rawUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['debug', 'error', 'log', 'verbose', 'warn'],
  });

  const configService = app.get(ConfigService);
  const trustProxyHops = configService.get<number>('TRUST_PROXY_HOPS', 0);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', trustProxyHops);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new CustomValidationPipe());

  patchNestJsSwagger();
  const config = new DocumentBuilder()
    .setTitle('Mahder API')
    .setDescription('Mahder API documentation')
    .setVersion('1.0')
    .addTag('API')
    .addBearerAuth() // Ensure BearerAuth is added
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.servers = [{ url: '/api' }];
  SwaggerModule.setup('api/docs', app, document);
  // writeFileSync('../swagger-spec.json', JSON.stringify(document));
  const corsOrigin = configService.get<string>('CORS_ORIGIN') || '*';
  const environment = configService.get<string>('NODE_ENV');
  const port = configService.get<number>('PORT');
  const parsedCorsOrigin = parseCorsOrigin(corsOrigin);
  if (environment === 'production' && parsedCorsOrigin === '*') {
    Logger.error('CORS_ORIGIN cannot be * in production');
    throw new InternalServerErrorException('Unsafe CORS configuration');
  }

  app.enableCors({
    origin: parsedCorsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalInterceptors(new GlobalResponseInterceptor());
  app.setGlobalPrefix('api');

  // Queue administration exposes job payloads and controls, so never mount it in production.
  if (environment !== 'production') {
    const myQueue = new Queue('file-upload', {
      // Keep Bull Board on the same authenticated Redis connection as BullMQ.
      // Supplying only host/port creates an unauthenticated client, which fails
      // when BullMQ issues its startup INFO command against password-protected Redis.
      connection: {
        host: configService.getOrThrow<string>('REDIS_HOST'),
        port: configService.getOrThrow<number>('REDIS_PORT'),
        password: configService.getOrThrow<string>('REDIS_PASSWORD'),
      },
    });

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({
      queues: [new BullMQAdapter(myQueue)],
      serverAdapter,
    });
    app.use('/admin/queues', serverAdapter.getRouter());
  }

  await app.listen(process.env.PORT ?? 3000);

  Logger.log(`🚀 Mahder API  is running on port ${port}`);
  Logger.log(`📦 Environment: ${environment}`);
  Logger.log(`🌐 CORS enabled for origin: ${corsOrigin}`);
  Logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  Logger.log(
    `💾 Database: ${sanitizeUrl(configService.get<string>('DATABASE_URL'))}`,
  );
  Logger.log(
    `📦 Redis: ${sanitizeUrl(configService.get<string>('REDIS_URL'))}`,
  );
  Logger.log(
    `📦 RabbitMQ: ${sanitizeUrl(configService.get<string>('RABBITMQ_URI'))}`,
  );
  Logger.log(`📦 Minio: ${configService.get<string>('MINIO_ENDPOINT')}`);
}
bootstrap();
