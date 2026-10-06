// some.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
// contracts/dataset-action.event.ts
export type DatasetAction = 'APPROVED' | 'REJECTED' | 'INVITED';

export interface DatasetActionEvent {
  datasetId: string;
  action: DatasetAction;
  actorId: string;
  timestamp: string;
}
@Injectable()
export class PublisherService {
  private readonly logger = new Logger(PublisherService.name);
  private readonly exchangeName: string;
  private readonly routingKey: string;
  private readonly queueName: string;

  private readonly dataSetExchangeName: string;
  private readonly dataSetRoutingKey: string;
  private readonly dataSetQueueName: string;
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigService,
  ) {
    this.exchangeName =
      this.configService.get<string>('RABBITMQ_EXCHANGE_NAME') ||
      'notifications.exchange';
    this.routingKey =
      this.configService.get<string>('RABBITMQ_ROUTING_KEY') ||
      'notification.created';
    this.queueName =
      this.configService.get<string>('RABBITMQ_QUEUE_NAME') ||
      'notifications.queue';
    this.dataSetExchangeName =
      this.configService.get<string>('DATASET_RABBITMQ_EXCHANGE_NAME') ||
      'dataset.exchange';
    this.dataSetRoutingKey =
      this.configService.get<string>('DATASET_RABBITMQ_ROUTING_KEY') ||
      'dataset.created';
    this.dataSetQueueName =
      this.configService.get<string>('DATASET_RABBITMQ_QUEUE_NAME') ||
      'dataset.queue';
  }
  async onModuleInit() {
    // await this.sendNotification();

    this.logger.log(
      'PublisherService initialized and ready to publish messages.',
    );
  }
  async sendNotification() {
    const message = {
      userId: '898c75a3-702c-4152-b2f7-d07fd5ac5222',
      notificationType: 'task-assign' as const,
      displayName: 'John Doe',
      title: 'New Task Assignment',
      message: 'You have been assigned a new task.',
      payload: { taskId: 'task-67890' },
    };
    await this.publishNotificationEvent(message);
  }

  async publishNotificationEvent(data: {
    userId: string;
    notificationType:
      'task-assign' | 'task-invitation' | 'task-rejected' | 'task-approved';
    displayName: string;
    title: string;
    message?: string;
    payload?: object;
  }) {
    await this.amqpConnection.publish(
      this.exchangeName,
      this.routingKey, // Routing key
      { data, pattern: 'notification.created' },
      { persistent: true }, // Options
    );
  }

  async publishDatasetAction(event: DatasetActionEvent) {
    await this.amqpConnection.publish(
      this.dataSetExchangeName,
      this.dataSetRoutingKey,
      event,
      { persistent: true },
    );
    // await this.amqpConnection.

    this.logger.log(
      `Dataset action published: ${event.datasetId} → ${event.action}`,
    );
  }
}
