import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

interface SentEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

describe('EmailService', () => {
  let service: EmailService;
  let mailerService: {
    sendMail: jest.Mock<Promise<unknown>, [SentEmail]>;
  };

  beforeEach(async () => {
    mailerService = {
      sendMail: jest.fn<Promise<unknown>, [SentEmail]>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn(() => 'http://localhost:3001/') },
        },
        {
          provide: MailerService,
          useValue: mailerService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends password-reset email through the mailer service', async () => {
    mailerService.sendMail.mockResolvedValue({});

    await service.sendPasswordResetCode('user@example.com', '123456');

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Your Data Mahder password reset code',
      }),
    );
  });

  it('should throw a stable error when mail delivery fails', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendPasswordResetCode('user@example.com', '123456'),
    ).rejects.toThrow('Failed to send email');
  });
});
