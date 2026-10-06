import { HttpException } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

describe('AuthRateLimitGuard', () => {
  it('rejects requests over the shared limit', async () => {
    const guard = new AuthRateLimitGuard({
      consume: jest.fn().mockResolvedValue(false),
    } as any);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', route: { path: '/login' } }),
      }),
    } as any;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('fails closed with 503 when Redis is unavailable', async () => {
    const guard = new AuthRateLimitGuard({
      consume: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    } as any);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', route: { path: '/login' } }),
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 503,
    });
  });
});
