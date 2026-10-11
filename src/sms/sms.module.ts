import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsEthiopiaService } from './sms-ethiopia.service';

@Module({
  exports: [SmsService],
  providers: [SmsService, SmsEthiopiaService],
})
export class SmsModule {}
