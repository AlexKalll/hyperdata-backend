import { ForbiddenException } from '@nestjs/common';
import { ReferenceDataAdminGuard } from './ReferenceDataAdmin.guard';

describe('ReferenceDataAdminGuard', () => {
  const canActivate = (method: string, role?: string) =>
    new ReferenceDataAdminGuard().canActivate({
      switchToHttp: () => ({
        getRequest: () => ({ method, user: { role: { name: role } } }),
      }),
    } as any);

  it('allows reads for authenticated users', () => {
    expect(canActivate('GET', 'Contributor')).toBe(true);
  });

  it('rejects reference-data mutations by non-administrators', () => {
    expect(() => canActivate('POST', 'Contributor')).toThrow(
      ForbiddenException,
    );
  });

  it('allows reference-data mutations by administrators', () => {
    expect(canActivate('DELETE', 'Admin')).toBe(true);
  });
});
