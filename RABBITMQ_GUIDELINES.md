# RabbitMQ Integration Guidelines

## Overview

The Mahder API project uses RabbitMQ as a message broker for asynchronous communication between services. This document provides comprehensive guidelines for working with RabbitMQ in the project, including setup, configuration, best practices, and troubleshooting.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Current Implementation](#current-implementation)
- [Setup and Configuration](#setup-and-configuration)
- [Message Patterns](#message-patterns)
- [Development Guidelines](#development-guidelines)
- [Testing RabbitMQ Integration](#testing-rabbitmq-integration)
- [Monitoring and Debugging](#monitoring-and-debugging)
- [Production Considerations](#production-considerations)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Architecture Overview

### Message Flow

```mermaid
graph TD
    A[API Controller] --> B[Publisher Service]
    B --> C[RabbitMQ Exchange]
    C --> D[Queue 1: Notifications]
    C --> E[Queue 2: Dataset Actions]
    D --> F[Notification Consumer]
    E --> G[Dataset Consumer]
    F --> H[Push Notification Service]
    G --> I[Data Processing Service]
```

### Current Exchanges and Queues

The project currently implements two main message flows:

1. **Notification System**
   - Exchange: `notifications.exchange`
   - Queue: `notifications.queue`
   - Routing Key: `notification.created`
   - Purpose: Handle user notifications (task assignments, approvals, rejections)

2. **Dataset Actions**
   - Exchange: `dataset.exchange`
   - Queue: `dataset.queue`
   - Routing Key: `dataset.action`
   - Purpose: Handle dataset lifecycle events (approved, rejected, invited)

## Current Implementation

### Dependencies

The project uses the following RabbitMQ-related packages:

```json
{
  "@golevelup/nestjs-rabbitmq": "^7.1.1",
  "amqp-connection-manager": "^5.0.0",
  "amqplib": "^0.10.9"
}
```

### Configuration Structure

**Environment Variables** (`.env.example`):
```bash
# RabbitMQ Connection
RABBITMQ_URI=amqp://guest:guest@localhost:5672

# Notification System
RABBITMQ_QUEUE_NAME=notifications.queue
RABBITMQ_EXCHANGE_NAME=notifications.exchange
RABBITMQ_EXCHANGE_TYPE=topic
RABBITMQ_ROUTING_KEY=notification.created
RABBITMQ_DURABLE=true

# Dataset System
DATASET_RABBITMQ_EXCHANGE_NAME=dataset.exchange
DATASET_RABBITMQ_QUEUE_NAME=dataset.queue
DATASET_RABBITMQ_ROUTING_KEY=dataset.action
```

### Module Configuration

**Location**: `src/common/common.module.ts`

```typescript
RabbitMQModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    uri: config.get<string>('RABBITMQ_URI'),
    exchanges: [
      {
        name: config.get<string>('RABBITMQ_EXCHANGE_NAME'),
        type: config.get<string>('RABBITMQ_EXCHANGE_TYPE'),
      },
      {
        name: config.get<string>('DATASET_RABBITMQ_EXCHANGE_NAME'),
      },
    ],
    queues: [
      {
        name: config.get<string>('DATASET_RABBITMQ_QUEUE_NAME'),
        options: { durable: true },
      },
      {
        name: config.get<string>('RABBITMQ_QUEUE_NAME'),
        options: { durable: true },
      },
    ],
  }),
  inject: [ConfigService],
})
```

### Publisher Service

**Location**: `src/common/service/RabbitPublish.service.ts`

The `PublisherService` handles message publishing with two main methods:

1. **Notification Events**:
```typescript
async publishNotificationEvent(data: {
  userId: string;
  notificationType: 'task-assign' | 'task-invitation' | 'task-rejected' | 'task-approved';
  displayName: string;
  title: string;
  message?: string;
  payload?: object;
})
```

2. **Dataset Actions**:
```typescript
async publishDatasetAction(event: DatasetActionEvent)
```

## Setup and Configuration

### Local Development Setup

1. **Install RabbitMQ**:

   **Using Docker** (Recommended):
   ```bash
   docker run -d --name rabbitmq \
     -p 5672:5672 \
     -p 15672:15672 \
     -e RABBITMQ_DEFAULT_USER=admin \
     -e RABBITMQ_DEFAULT_PASS=admin123 \
     rabbitmq:3-management
   ```

   **Using Package Manager**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install rabbitmq-server
   
   # macOS
   brew install rabbitmq
   
   # Windows
   # Download from https://www.rabbitmq.com/download.html
   ```

2. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   
   Update RabbitMQ settings in `.env`:
   ```bash
   RABBITMQ_URI=amqp://admin:admin123@localhost:5672
   ```

3. **Verify Connection**:
   - Management UI: http://localhost:15672
   - Default credentials: admin/admin123

### Production Configuration

**Security Considerations**:
```bash
# Use strong credentials
RABBITMQ_URI=amqp://production_user:strong_password@rabbitmq-server:5672

# Enable TLS for production
RABBITMQ_URI=amqps://production_user:strong_password@rabbitmq-server:5671
```

**High Availability Setup**:
```bash
# Multiple nodes for clustering
RABBITMQ_URI=amqp://user:pass@node1:5672,node2:5672,node3:5672
```

## Message Patterns

### 1. Notification Pattern

**Use Case**: User notifications for task assignments, approvals, rejections

**Message Structure**:
```typescript
interface NotificationMessage {
  userId: string;
  notificationType: 'task-assign' | 'task-invitation' | 'task-rejected' | 'task-approved';
  displayName: string;
  title: string;
  message?: string;
  payload?: object;
}
```

**Publishing Example**:
```typescript
await this.publisherService.publishNotificationEvent({
  userId: 'user-123',
  notificationType: 'task-assign',
  displayName: 'John Doe',
  title: 'New Task Assignment',
  message: 'You have been assigned a new data collection task',
  payload: { taskId: 'task-456', projectId: 'project-789' }
});
```

### 2. Dataset Action Pattern

**Use Case**: Dataset lifecycle events (approval, rejection, invitation)

**Message Structure**:
```typescript
interface DatasetActionEvent {
  datasetId: string;
  action: 'APPROVED' | 'REJECTED' | 'INVITED';
  actorId: string;
  timestamp: string;
}
```

**Publishing Example**:
```typescript
await this.publisherService.publishDatasetAction({
  datasetId: 'dataset-123',
  action: 'APPROVED',
  actorId: 'reviewer-456',
  timestamp: new Date().toISOString()
});
```

## Development Guidelines

### Adding New Message Types

1. **Define Message Interface**:
```typescript
// src/common/interfaces/message.interface.ts
export interface TaskCompletionEvent {
  taskId: string;
  userId: string;
  completedAt: string;
  quality: number;
  metadata?: Record<string, any>;
}
```

2. **Update Configuration**:
```typescript
// Add to .env.example
TASK_COMPLETION_EXCHANGE_NAME=task.completion.exchange
TASK_COMPLETION_QUEUE_NAME=task.completion.queue
TASK_COMPLETION_ROUTING_KEY=task.completed
```

3. **Extend Publisher Service**:
```typescript
// src/common/service/RabbitPublish.service.ts
async publishTaskCompletion(event: TaskCompletionEvent) {
  await this.amqpConnection.publish(
    this.taskCompletionExchangeName,
    this.taskCompletionRoutingKey,
    event,
    { persistent: true }
  );
  
  this.logger.log(`Task completion published: ${event.taskId}`);
}
```

4. **Create Consumer** (if needed):
```typescript
// src/task/consumers/task-completion.consumer.ts
@Injectable()
export class TaskCompletionConsumer {
  private readonly logger = new Logger(TaskCompletionConsumer.name);

  @RabbitSubscribe({
    exchange: 'task.completion.exchange',
    routingKey: 'task.completed',
    queue: 'task.completion.queue',
  })
  async handleTaskCompletion(event: TaskCompletionEvent) {
    this.logger.log(`Processing task completion: ${event.taskId}`);
    
    try {
      // Process the event
      await this.processTaskCompletion(event);
    } catch (error) {
      this.logger.error(`Failed to process task completion: ${error.message}`);
      throw error; // This will trigger retry mechanism
    }
  }
}
```

### Error Handling

**Publisher Error Handling**:
```typescript
async publishWithRetry(publishFn: () => Promise<void>, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await publishFn();
      return;
    } catch (error) {
      this.logger.warn(`Publish attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        this.logger.error('Max publish retries exceeded');
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
```

**Consumer Error Handling**:
```typescript
@RabbitSubscribe({
  exchange: 'notifications.exchange',
  routingKey: 'notification.created',
  queue: 'notifications.queue',
  errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  errorHandler: (channel, msg, error) => {
    console.error('Message processing failed:', error);
    // Custom error handling logic
  }
})
```

## Testing RabbitMQ Integration

### Unit Testing

**Mock Publisher Service**:
```typescript
// test/mocks/publisher.service.mock.ts
export const mockPublisherService = {
  publishNotificationEvent: jest.fn(),
  publishDatasetAction: jest.fn(),
};
```

**Test Example**:
```typescript
// src/data-set/data-set.service.spec.ts
describe('DataSetService', () => {
  let service: DataSetService;
  let publisherService: PublisherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSetService,
        {
          provide: PublisherService,
          useValue: mockPublisherService,
        },
      ],
    }).compile();

    service = module.get<DataSetService>(DataSetService);
    publisherService = module.get<PublisherService>(PublisherService);
  });

  it('should publish dataset action on approval', async () => {
    const datasetId = 'test-dataset';
    const actorId = 'test-actor';

    await service.approveDataset(datasetId, actorId);

    expect(publisherService.publishDatasetAction).toHaveBeenCalledWith({
      datasetId,
      action: 'APPROVED',
      actorId,
      timestamp: expect.any(String),
    });
  });
});
```

### Integration Testing

**Test with Real RabbitMQ**:
```typescript
// test/integration/rabbitmq.integration.spec.ts
describe('RabbitMQ Integration', () => {
  let app: INestApplication;
  let publisherService: PublisherService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    publisherService = app.get<PublisherService>(PublisherService);
  });

  it('should publish and consume notification messages', async () => {
    const testMessage = {
      userId: 'test-user',
      notificationType: 'task-assign' as const,
      displayName: 'Test User',
      title: 'Test Notification',
    };

    // Publish message
    await publisherService.publishNotificationEvent(testMessage);

    // Wait for message processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify message was processed (check database, logs, etc.)
  });
});
```

## Monitoring and Debugging

### Management UI

Access RabbitMQ Management UI at: http://localhost:15672

**Key Metrics to Monitor**:
- Queue depth (number of unprocessed messages)
- Message rates (publish/consume rates)
- Connection status
- Exchange bindings
- Consumer status

### Logging

**Enable Debug Logging**:
```typescript
// src/common/service/RabbitPublish.service.ts
private readonly logger = new Logger(PublisherService.name);

async publishNotificationEvent(data: NotificationMessage) {
  this.logger.debug(`Publishing notification: ${JSON.stringify(data)}`);
  
  try {
    await this.amqpConnection.publish(/* ... */);
    this.logger.log(`Notification published successfully for user: ${data.userId}`);
  } catch (error) {
    this.logger.error(`Failed to publish notification: ${error.message}`, error.stack);
    throw error;
  }
}
```

### Health Checks

**RabbitMQ Health Check**:
```typescript
// src/health/rabbitmq.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class RabbitMQHealthIndicator extends HealthIndicator {
  constructor(private readonly amqpConnection: AmqpConnection) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isConnected = this.amqpConnection.managedConnection.isConnected();
      
      if (isConnected) {
        return this.getStatus(key, true, { status: 'connected' });
      } else {
        throw new HealthCheckError('RabbitMQ check failed', {
          status: 'disconnected'
        });
      }
    } catch (error) {
      throw new HealthCheckError('RabbitMQ check failed', {
        status: 'error',
        message: error.message
      });
    }
  }
}
```

## Production Considerations

### Performance Optimization

**Connection Pooling**:
```typescript
// Optimize connection settings
RabbitMQModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    uri: config.get<string>('RABBITMQ_URI'),
    connectionInitOptions: {
      wait: false,
      timeout: 10000,
    },
    connectionManagerOptions: {
      heartbeatIntervalInSeconds: 15,
      reconnectTimeInSeconds: 30,
    },
  }),
})
```

**Message Persistence**:
```typescript
// Ensure message durability
await this.amqpConnection.publish(
  exchangeName,
  routingKey,
  message,
  { 
    persistent: true,  // Messages survive broker restart
    mandatory: true,   // Ensure message is routed to a queue
  }
);
```

### Security

**Authentication and Authorization**:
```bash
# Use dedicated user with limited permissions
RABBITMQ_URI=amqp://mahder_api:secure_password@rabbitmq:5672/mahder_vhost
```

**TLS Configuration**:
```bash
# Enable TLS in production
RABBITMQ_URI=amqps://mahder_api:secure_password@rabbitmq:5671/mahder_vhost
```

### Clustering and High Availability

**Multi-node Setup**:
```bash
# Configure multiple RabbitMQ nodes
RABBITMQ_URI=amqp://user:pass@node1:5672,node2:5672,node3:5672/mahder_vhost
```

**Queue Mirroring**:
```bash
# Enable queue mirroring for high availability
rabbitmqctl set_policy ha-all "^" '{"ha-mode":"all","ha-sync-mode":"automatic"}'
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if RabbitMQ is running
   docker ps | grep rabbitmq
   
   # Check RabbitMQ logs
   docker logs rabbitmq
   
   # Verify connection string
   echo $RABBITMQ_URI
   ```

2. **Messages Not Being Consumed**
   ```bash
   # Check queue status in management UI
   # Verify consumer is registered
   # Check for consumer errors in logs
   ```

3. **Memory Issues**
   ```bash
   # Check RabbitMQ memory usage
   rabbitmqctl status
   
   # Set memory limits
   rabbitmqctl set_vm_memory_high_watermark 0.6
   ```

### Debug Commands

**Check Queue Status**:
```bash
# List all queues
rabbitmqctl list_queues name messages consumers

# Check specific queue
rabbitmqctl list_queues name messages consumers | grep notifications
```

**Monitor Connections**:
```bash
# List active connections
rabbitmqctl list_connections

# Check connection details
rabbitmqctl list_connections name peer_host peer_port state
```

### Error Recovery

**Dead Letter Queues**:
```typescript
// Configure dead letter exchange for failed messages
{
  name: 'notifications.queue',
  options: {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'notifications.dlx',
      'x-dead-letter-routing-key': 'failed',
      'x-message-ttl': 300000, // 5 minutes
    },
  },
}
```

## Best Practices

### Message Design

1. **Keep Messages Small**: Avoid large payloads, use references instead
2. **Include Metadata**: Add timestamps, correlation IDs, and version info
3. **Use Schemas**: Define clear message schemas and validate them
4. **Idempotency**: Design consumers to handle duplicate messages

### Queue Management

1. **Use Durable Queues**: Ensure queues survive broker restarts
2. **Set TTL**: Configure message time-to-live to prevent queue buildup
3. **Monitor Queue Depth**: Alert on excessive queue growth
4. **Use Dead Letter Queues**: Handle failed messages gracefully

### Consumer Design

1. **Acknowledge Messages**: Properly acknowledge processed messages
2. **Handle Errors**: Implement retry logic with exponential backoff
3. **Limit Concurrency**: Control the number of concurrent consumers
4. **Graceful Shutdown**: Handle application shutdown gracefully

### Security

1. **Use Dedicated Users**: Create specific users for each service
2. **Limit Permissions**: Grant minimal required permissions
3. **Enable TLS**: Use encrypted connections in production
4. **Regular Updates**: Keep RabbitMQ server updated

### Monitoring

1. **Set Up Alerts**: Monitor queue depth, connection status, and error rates
2. **Log Everything**: Comprehensive logging for debugging
3. **Health Checks**: Implement health checks for RabbitMQ connectivity
4. **Performance Metrics**: Track message throughput and latency

## Example Docker Compose

```yaml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: mahder-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123
      RABBITMQ_DEFAULT_VHOST: mahder
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - mahder-network

volumes:
  rabbitmq_data:

networks:
  mahder-network:
    driver: bridge
```

## Resources

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [@golevelup/nestjs-rabbitmq Documentation](https://github.com/golevelup/nestjs/tree/master/packages/rabbitmq)
- [AMQP 0-9-1 Protocol Reference](https://www.rabbitmq.com/amqp-0-9-1-reference.html)
- [RabbitMQ Management Plugin](https://www.rabbitmq.com/management.html)

---

**Last Updated**: January 12, 2026  
**Version**: 1.0