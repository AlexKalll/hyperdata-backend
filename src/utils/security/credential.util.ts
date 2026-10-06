import bcrypt from 'bcrypt';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto';
// hashing password
export const hashPassword = (password: string) => bcrypt.hash(password, 10);
// verify password
export const verifyPassword = (password: string, hashedPassword: string) =>
  bcrypt.compare(password, hashedPassword);
export const hashToken = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const generateOtp = () => randomInt(100000, 1000000).toString();
export const hashOtp = (value: string) => {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret) throw new Error('OTP_HMAC_SECRET is not configured');
  return createHmac('sha256', secret).update(value).digest('hex');
};
export const verifyOtpHash = (value: string, expectedHash: string) => {
  const actual = Buffer.from(hashOtp(value), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
