import { UnauthorizedException } from '@nestjs/common';
import { RefreshSessionService } from './RefreshSession.service';

describe('RefreshSessionService', () => {
  it('allows only one concurrent rotation', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'session-1',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 60_000),
      }),
      update: jest
        .fn()
        .mockResolvedValueOnce({ affected: 1 })
        .mockResolvedValueOnce({ affected: 0 }),
    };
    const service = new RefreshSessionService(repository as any);

    const results = await Promise.allSettled([
      service.rotate('token'),
      service.rotate('token'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      (
        results.find(
          (result) => result.status === 'rejected',
        ) as PromiseRejectedResult
      ).reason,
    ).toBeInstanceOf(UnauthorizedException);
  });
});
