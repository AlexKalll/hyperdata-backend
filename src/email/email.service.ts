import { Injectable, Logger } from '@nestjs/common';
import { MailerService as MailService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { EMAIL_BRAND_NAME, renderEmail } from './email.templates';

export interface AssignmentEmailOptions {
  recipientName?: string;
  role: string;
  resourceType: 'project' | 'task';
  resourceName: string;
  temporaryPassword?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly mailerService: MailService,
    configService: ConfigService,
  ) {
    this.frontendUrl = configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/+$/, '');
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    await this.sendEmail(to, `Your ${EMAIL_BRAND_NAME} password reset code`, {
      preheader:
        'Your password reset code is ready. It expires in five minutes.',
      greeting: 'Hello,',
      paragraphs: [
        `We received a request to reset the password for your ${EMAIL_BRAND_NAME} account.`,
        'Enter the verification code below in the password reset form to continue.',
      ],
      highlight: { label: 'Verification code', value: code },
      action: {
        label: `Open ${EMAIL_BRAND_NAME}`,
        url: `${this.frontendUrl}/login`,
      },
      note: 'This code expires in five minutes and can only be used once. If you did not request a password reset, you can safely ignore this message.',
    });
  }

  async sendAssignmentEmail(
    to: string,
    options: AssignmentEmailOptions,
  ): Promise<void> {
    const resourceLabel = options.resourceType;
    const greetingName = options.recipientName?.trim() || 'there';
    const paragraphs = [
      `You have been assigned the role of ${options.role} for the ${resourceLabel} “${options.resourceName}” on ${EMAIL_BRAND_NAME}.`,
      options.temporaryPassword
        ? `Your ${EMAIL_BRAND_NAME} account has been created. Sign in with the temporary password below.`
        : `Sign in to your ${EMAIL_BRAND_NAME} account to view the assignment and get started.`,
    ];

    await this.sendEmail(
      to,
      `Your ${EMAIL_BRAND_NAME} ${resourceLabel} assignment`,
      {
        preheader: `You have a new ${resourceLabel} assignment on ${EMAIL_BRAND_NAME}.`,
        greeting: `Hello ${greetingName},`,
        paragraphs,
        highlight: options.temporaryPassword
          ? { label: 'Temporary password', value: options.temporaryPassword }
          : undefined,
        action: {
          label: `Sign in to ${EMAIL_BRAND_NAME}`,
          url: `${this.frontendUrl}/login`,
        },
        note: options.temporaryPassword
          ? 'For your security, keep this temporary password private and change it after signing in.'
          : 'If you have questions about this assignment, contact your project manager.',
      },
    );
  }

  async sendTaskFlaggedEmail(
    to: string,
    recipientName: string | undefined,
    taskName: string,
  ): Promise<void> {
    await this.sendEmail(to, `An update about your ${EMAIL_BRAND_NAME} task`, {
      preheader: `There is an update to one of your ${EMAIL_BRAND_NAME} task assignments.`,
      greeting: `Hello ${recipientName?.trim() || 'there'},`,
      paragraphs: [
        `Your assignment for “${taskName}” has been flagged by the project team and set to inactive.`,
        `Sign in to ${EMAIL_BRAND_NAME} to review the assignment details or contact your project manager if you need help.`,
      ],
      action: {
        label: `Open ${EMAIL_BRAND_NAME}`,
        url: `${this.frontendUrl}/login`,
      },
    });
  }

  private async sendEmail(
    to: string,
    subject: string,
    content: Parameters<typeof renderEmail>[0],
  ): Promise<void> {
    const message = renderEmail(content);
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        html: message.html,
        text: message.text,
      });
    } catch (error) {
      this.logger.error(
        `SMTP delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error('Failed to send email');
    }
  }
}
