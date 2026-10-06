import axios from 'axios';
import * as jwt from 'jsonwebtoken';
export class SantimpaySdk {
  private privateKey: string;
  private merchantId: string;
  private baseUrl: string;
  constructor() {
    this.privateKey = process.env.SANTIM_PAY_PRIVATE_KEY_IN_PEM as string;
    this.merchantId = process.env.PAYMENT_MERCHANT_ID as string;
    this.baseUrl = process.env.PAYMENT_BASE_URL as string;
    // if (testBed) {
    //   this.baseUrl = process.env.PAYMENT_BASE_URL as string;
    // }
  }
  generateSignedTokenForInitiatePayment(amount: number, paymentReason: string) {
    const time = Math.floor(Date.now() / 1000);
    const payload = {
      amount,
      paymentReason,
      merchantId: this.merchantId,
      generated: time,
    };
    return signES256(payload, this.privateKey);
  }
  generateSignedTokenForDirectPayment(
    amount: number,
    paymentReason: string,
    paymentMethod: string,
    phoneNumber: string,
  ) {
    const time = Math.floor(Date.now() / 1000);
    const payload = {
      amount,
      paymentReason,
      paymentMethod,
      phoneNumber,
      merchantId: this.merchantId,
      generated: time,
    };
    return signES256(payload, this.privateKey);
  }
  generateSignedTokenForGetTransaction(id) {
    const time = Math.floor(Date.now() / 1000);
    const payload = {
      id,
      merId: this.merchantId,
      generated: time,
    };
    return signES256(payload, this.privateKey);
  }
  async sendToCustomer(
    id: string,
    amount: number,
    paymentReason: string,
    phoneNumber: string,
    paymentMethod: string,
  ) {
    try {
      const token = this.generateSignedTokenForDirectPaymentOrB2C(
        amount,
        paymentReason,
        paymentMethod,
        phoneNumber,
      );
      const payload = {
        id,
        clientReference: id,
        amount,
        reason: paymentReason,
        merchantId: this.merchantId,
        signedToken: token,
        receiverAccountNumber: phoneNumber,
        notifyUrl: process.env.PAYMENT_NOTIFY_URL,
        paymentMethod,
      };
      const response = await axios.post(
        `${this.baseUrl}/payout-transfer`,
        payload,
      );
      if (response.status >= 200 && response.status < 300) {
        return response.data;
      } else {
        throw new Error('Failed to initiate B2C');
      }
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
  generateSignedTokenForDirectPaymentOrB2C(
    amount,
    paymentReason,
    paymentMethod,
    phoneNumber,
  ) {
    const time = Math.floor(Date.now() / 1000);
    const payload = {
      amount,
      paymentReason,
      paymentMethod,
      phoneNumber,
      merchantId: this.merchantId,
      generated: time,
    };
    return signES256(payload, this.privateKey);
  }
  async directPayment(
    id,
    amount,
    paymentReason,
    notifyUrl,
    phoneNumber,
    paymentMethod,
  ) {
    try {
      const token = this.generateSignedTokenForDirectPayment(
        amount,
        paymentReason,
        paymentMethod,
        phoneNumber,
      );
      const payload = {
        id,
        amount,
        reason: paymentReason,
        merchantId: this.merchantId,
        signedToken: token,
        phoneNumber,
        paymentMethod,
        notifyUrl,
      };
      if (phoneNumber && phoneNumber.length > 0) {
        payload.phoneNumber = phoneNumber;
      }
      const response = await axios.post(
        `${this.baseUrl}/direct-payment`,
        payload,

        // {
        // headers: {
        //   Authorization: `Bearer ${this.token}`
        // }
        // }
      );

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error('Failed to initiate direct payment');
      }
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
  async checkTransactionStatus(id) {
    try {
      const token = this.generateSignedTokenForGetTransaction(id);
      const dataa = {
        id,
        merchantId: this.merchantId,
        signedToken: token,
      };
      const response = await axios.post(
        `${this.baseUrl}/fetch-transaction-status`,
        {
          id,
          merchantId: this.merchantId,
          signedToken: token,
        },
        // {
        // headers: {
        //   Authorization: `Bearer ${this.token}`
        // }
        // }
      );

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error('Failed to initiate payment');
      }
    } catch (error) {
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
}
export default SantimpaySdk;

export function sign(
  payload: any,
  privateKey: string,
  algorithm: jwt.Algorithm,
) {
  if (!privateKey) {
    throw new Error('Santim Pay signing key is not configured');
  }
  return jwt.sign(payload, privateKey, { algorithm });
}
export function signES256(payload, privateKey) {
  return sign(payload, privateKey, 'ES256');
}
