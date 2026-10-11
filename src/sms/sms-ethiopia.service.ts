import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type SmsEthiopiaResponse = {
  sent?: boolean;
};

@Injectable()
export class SmsEthiopiaService {
  async sendVerificationCode(phone: string, otp: string): Promise<boolean> {
    const apiKey = process.env.SMS_ETHIOPIA_API_KEY;
    // Mobile registration sends nine local digits; SMS Ethiopia requires 251XXXXXXXXX.
    let msisdn = phone.replace(/^\+/, '');
    if (/^\d{9}$/.test(phone)) {
      msisdn = `251${phone}`;
    } else if (/^0\d{9}$/.test(phone)) {
      msisdn = `251${phone.slice(1)}`;
    }
    if (!apiKey || !/^251\d{9}$/.test(msisdn)) {
      Logger.warn(
        '[SMS] SMS Ethiopia configuration or phone number is invalid',
      );
      return false;
    }

    try {
      const response = await axios.post<SmsEthiopiaResponse>(
        'https://smsethiopia.com/api/sms/send',
        { msisdn, text: `Your verification code is ${otp}` },
        {
          headers: { KEY: apiKey, 'Content-Type': 'application/json' },
          timeout: 10000,
        },
      );
      if (response.data?.sent !== true) {
        Logger.warn(
          '[SMS] SMS Ethiopia did not accept the verification request',
        );
        return false;
      }
      Logger.log('[SMS] SMS Ethiopia accepted the verification request');
      return true;
    } catch {
      Logger.warn('[SMS] SMS Ethiopia verification request failed');
      return false;
    }
  }
}
