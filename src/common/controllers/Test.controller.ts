import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { NotificationService } from '../service/Notification.service';
import { IsEnum, IsString } from 'class-validator';
import { PublisherService } from '../service/RabbitPublish.service';
export class CreateNotificationDto {
  @ApiProperty()
  @IsString()
  userId: string;
  @ApiProperty()
  @IsEnum(
    ['task-assign', 'task-invitation', 'task-rejected', 'task-approved'],
    { each: true },
  )
  notificationType:
    'task-assign' | 'task-invitation' | 'task-rejected' | 'task-approved';
  @ApiProperty()
  @IsString()
  displayName: string;
  @ApiProperty()
  @IsString()
  message?: string;
  @ApiProperty()
  @IsString()
  payload?: object;
}
export class DatasetActionEvent {
  @ApiProperty()
  @IsString()
  datasetId: string;
  @ApiProperty()
  @IsString()
  action: 'APPROVED' | 'REJECTED' | 'INVITED';
  @ApiProperty()
  @IsString()
  actorId: string;
  @ApiProperty()
  @IsString()
  timestamp: string;
}
@Controller('test')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiTags('Test')
export class TestController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly rabbitPublishService: PublisherService,
  ) {}

  @Post('send-notification')
  @ApiResponse({ status: 200, description: '' })
  @ApiOperation({ summary: 'Send a notification' })
  async sendNotification(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<any> {
    return this.notificationService.create({
      user_id: createNotificationDto.userId,
      title: createNotificationDto.notificationType,
      message: createNotificationDto.message || '',
      type: createNotificationDto.notificationType,
    });
  }

  @Post('publish-dataset-action')
  async publishDatasetAction(@Body() datasetActionDto: DatasetActionEvent) {
    await this.rabbitPublishService.publishDatasetAction(datasetActionDto);
  }
}
