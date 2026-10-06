import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let mailerService: { sendMail: jest.Mock };

  beforeEach(async () => {
    mailerService = {
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
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

  it('should send email through the mailer service', async () => {
    mailerService.sendMail.mockResolvedValue({});

    await service.sendEmail('user@example.com', 'Welcome', '<p>Hello</p>');

    expect(mailerService.sendMail).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'Welcome',
      html: '<p>Hello</p>',
    });
  });

  it('should throw a stable error when mail delivery fails', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendEmail('user@example.com', 'Welcome', '<p>Hello</p>'),
    ).rejects.toThrow('Failed to send email');
  });
});
