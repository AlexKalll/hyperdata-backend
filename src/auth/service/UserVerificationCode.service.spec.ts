import { UserVerificationCodeService } from './UserVerificationCode.service';
import { hashOtp } from 'src/utils/security/credential.util';

describe('UserVerificationCodeService', () => {
  beforeEach(() => {
    process.env.OTP_HMAC_SECRET =
      'test-only-secret-with-at-least-32-characters';
  });

  it('increments attempts and expires the fifth incorrect guess', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({
        id: 'verification-1',
        code: hashOtp('123456'),
        status: 'pending',
        attempt_count: 4,
        expiration_date: new Date(Date.now() + 60_000),
      }),
      update: jest.fn(),
    };
    const repository = {
      manager: {
        transaction: jest.fn((callback) => callback(manager)),
      },
    };
    const service = new UserVerificationCodeService(repository as any);

    await expect(
      service.validate('user@example.com', '000000'),
    ).rejects.toThrow('Invalid code');
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      'verification-1',
      { attempt_count: 5, status: 'expired' },
    );
  });
});
