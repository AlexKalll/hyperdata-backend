import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
export type AfroResponse = {
  acknowledge: string;
  response: {
    phone: string;
    code: string;
    verificationId: string;
    sentAt: string;
  };
};
@Injectable()
export class SmsService {
  constructor() {}
  async sendVerificationCode(
    phone: string,
    otp: string,
  ): Promise<{ error?: string; afro: AfroResponse | null }> {
    const base_url = process.env.SMS_BASE_URL + '/send';
    const token = process.env.SMS_TOKEN as string;
    const identifierId = process.env.SMS_IDENTIFIER as string;
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    const sender = process.env.SMS_SENDER as string; //process.env.SMS_SENDER as string
    const message = `Your verification code is ${otp}`;
    console.log(message);
    const sendTry = `${base_url}?from=${identifierId}&sender=${sender}&to=${phone}&message=${message}`;
    try {
      const res: { data: AfroResponse } = await axios.get(sendTry, {
        headers,
      });
      Logger.log('[**] SMS SENT', res.data);
      return { error: '', afro: res.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.warn('Error In Sending SMS', message);
      return { error: message, afro: null };
    }
  }
}
