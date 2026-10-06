import { ForbiddenException } from '@nestjs/common';
import { ProjectScopeGuard } from './ProjectScope.guard';

describe('ProjectScopeGuard', () => {
  const createGuard = (project?: object, task?: object) =>
    new ProjectScopeGuard(
      { findOne: jest.fn().mockResolvedValue(project) } as any,
      { findOne: jest.fn().mockResolvedValue(task) } as any,
    );

  const context = (request: object) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

  it('allows non-manager roles through to role-specific guards', async () => {
    await expect(
      createGuard().canActivate(context({ user: { role: { name: 'Admin' } } })),
    ).resolves.toBe(true);
  });

  it('allows a project manager for their project', async () => {
    await expect(
      createGuard({ id: 'project-id' }).canActivate(
        context({
          user: { id: 'manager-id', role: { name: 'ProjectManager' } },
          params: { project_id: 'project-id' },
          body: {},
          query: {},
        }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects a project manager outside their project', async () => {
    await expect(
      createGuard().canActivate(
        context({
          user: { id: 'manager-id', role: { name: 'ProjectManager' } },
          params: { project_id: 'project-id' },
          body: {},
          query: {},
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
