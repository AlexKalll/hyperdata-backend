import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './role.guard';
import { Role } from '../decorators/roles.enum';

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  function createContext(user?: unknown) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('should allow access when the user has a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(
      guard.canActivate(createContext({ role: { name: Role.ADMIN } })),
    ).toBe(true);
  });

  it('should throw when the user role is not allowed', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() =>
      guard.canActivate(createContext({ role: { name: Role.REVIEWER } })),
    ).toThrow(ForbiddenException);
  });

  it('should deny access cleanly when the request has no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
