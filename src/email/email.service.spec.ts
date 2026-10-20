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

  it.each(['Facilitator', 'Reviewer'])(
    'guides task %s accounts to complete their profile',
    async (role) => {
      mailerService.sendMail.mockResolvedValue({});

      for (const temporaryPassword of ['temporary-password', undefined]) {
        await service.sendAssignmentEmail('user@example.com', {
          role,
          resourceType: 'task',
          resourceName: 'Test task',
          temporaryPassword,
        });

        const calls = mailerService.sendMail.mock.calls;
        const sentEmail = calls[calls.length - 1][0];
        expect(sentEmail.text).toContain('Account Setting');
        expect(sentEmail.text).toContain('first and last name');
        expect(sentEmail.text).toContain('other missing profile details');
        expect(sentEmail.text).toContain(
          temporaryPassword
            ? 'required password change'
            : 'After signing in, select Account Setting',
        );
      }
    },
  );

  it('does not add task profile instructions to project-manager assignment emails', async () => {
    mailerService.sendMail.mockResolvedValue({});

    await service.sendAssignmentEmail('user@example.com', {
      role: 'Project Manager',
      resourceType: 'project',
      resourceName: 'Test project',
      temporaryPassword: 'temporary-password',
    });

    expect(mailerService.sendMail.mock.calls[0][0].text).not.toContain(
      'Account Setting',
    );
  });

  it('should throw a stable error when mail delivery fails', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendPasswordResetCode('user@example.com', '123456'),
    ).rejects.toThrow('Email delivery is temporarily unavailable');
  });
});
