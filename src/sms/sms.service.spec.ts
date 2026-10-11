import { Test, TestingModule } from '@nestjs/testing';
import { SmsService } from './sms.service';
import { SmsEthiopiaService } from './sms-ethiopia.service';

describe('SmsService', () => {
  let service: SmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmsService, SmsEthiopiaService],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
