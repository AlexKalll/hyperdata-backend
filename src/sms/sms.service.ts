import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SmsEthiopiaService } from './sms-ethiopia.service';

type AfroResponse = {
  acknowledge: string;
  response?: {
    phone?: string;
    code?: string;
    verificationId?: string;
    sentAt?: string;
    errors?: string[];
  };
};
@Injectable()
export class SmsService {
  constructor(private readonly smsEthiopiaService: SmsEthiopiaService) {}

  async sendVerificationCode(phone: string, otp: string): Promise<boolean> {
    if (process.env.SMS_PROVIDER === 'smsethiopia') {
      return this.smsEthiopiaService.sendVerificationCode(phone, otp);
    }
    return this.sendViaAfroMessage(phone, otp);
  }

  private async sendViaAfroMessage(
    phone: string,
    otp: string,
  ): Promise<boolean> {
    const base_url = (process.env.SMS_BASE_URL || '').replace(/\/$/, '');
    const token = process.env.SMS_TOKEN as string;
    const identifierId = process.env.SMS_IDENTIFIER as string;
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    const sender = (process.env.SMS_SENDER || '').trim();
    const message = `Your verification code is ${otp}`;
    try {
      const params: Record<string, string> = {
        from: identifierId,
        to: phone,
        message,
      };
      if (sender) params.sender = sender;

      const res: { data: AfroResponse } = await axios.get(`${base_url}/send`, {
        headers,
        params,
      });
      const providerErrors = res.data.response?.errors ?? [];
      if (res.data.acknowledge !== 'success') {
        const reason = providerErrors.some((error) =>
          /sender|identifier|short code/i.test(error),
        )
          ? 'Sender name or identifier rejected by SMS provider'
          : 'SMS provider rejected the verification request';
        Logger.warn(`[SMS] Provider rejected verification request: ${reason}`);
        return false;
      }
      Logger.log(
        `[SMS] Verification request accepted by provider: ${res.data.acknowledge}`,
      );
      return true;
    } catch {
      Logger.warn('[SMS] Verification request failed at the transport layer');
      return false;
    }
  }
}
