import {
  generateOtp,
  hashOtp,
  hashToken,
  verifyOtpHash,
} from './credential.util';

describe('credential security utilities', () => {
  it('generates a six-digit OTP and hashes deterministically', () => {
    process.env.OTP_HMAC_SECRET =
      'test-only-secret-with-at-least-32-characters';
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
    expect(hashToken(otp)).toHaveLength(64);
    expect(hashToken(otp)).toBe(hashToken(otp));
    expect(hashOtp(otp)).toHaveLength(64);
    expect(verifyOtpHash(otp, hashOtp(otp))).toBe(true);
    expect(verifyOtpHash('000000', hashOtp(otp))).toBe(false);
  });
});
