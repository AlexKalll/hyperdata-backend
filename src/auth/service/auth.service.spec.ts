jest.mock('src/auth/service/User.service', () => ({
  UserService: class UserService {},
}));

jest.mock('src/auth/service/Permission.service', () => ({
  PermissionService: class PermissionService {},
}));

jest.mock('src/auth/service/Role.service', () => ({
  RoleService: class RoleService {},
}));

jest.mock('src/auth/service/UserVerificationCode.service', () => ({
  UserVerificationCodeService: class UserVerificationCodeService {},
}));

jest.mock('src/sms/sms.service', () => ({
  SmsService: class SmsService {},
}));

jest.mock('src/email/email.service', () => ({
  EmailService: class EmailService {},
}));

jest.mock('src/common/service/File.service', () => ({
  FileService: class FileService {},
}));

jest.mock('src/utils/security/credential.util', () => ({
  verifyPassword: jest.fn(),
  generateOtp: jest.fn(() => '123456'),
  hashOtp: jest.fn((value) => `hash:${value}`),
}));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from './auth.service';
import { Role as RoleEnum } from '../decorators/roles.enum';
import { ActionEvents } from 'src/utils/events/ActionEvents';
import { verifyPassword } from 'src/utils/security/credential.util';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findOneWithPassword: jest.Mock;
    changePasswordFromVerification: jest.Mock;
  };
  let permissionsService: { findMany: jest.Mock };
  let rolesService: { findMany: jest.Mock; findOne: jest.Mock };
  let userVerificationService: {
    create: jest.Mock;
    findOne: jest.Mock;
    consume: jest.Mock;
  };
  let smsService: { sendVerificationCode: jest.Mock };
  let mailService: { sendEmail: jest.Mock };
  let fileService: { getPreSignedUrl: jest.Mock };
  let jwtService: { verify: jest.Mock; sign: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let refreshSessions: {
    create: jest.Mock;
    rotate: jest.Mock;
    revokeAll: jest.Mock;
  };
  let verifyPasswordMock: jest.MockedFunction<typeof verifyPassword>;

  function createUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'user@example.com',
      password: 'hashed-password',
      is_active: true,
      profile_picture: undefined,
      first_name: 'Test',
      middle_name: 'User',
      last_name: 'Example',
      phone_number: '+251900000000',
      role: { id: 'role-1', name: RoleEnum.ADMIN, created_date: new Date() },
      created_date: new Date(),
      woreda: 'W1',
      city: 'Addis',
      region_id: 'region-1',
      zone_id: 'zone-1',
      ...overrides,
    };
  }

  beforeEach(() => {
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';

    usersService = {
      findOneWithPassword: jest.fn(),
      changePasswordFromVerification: jest.fn(),
    };
    permissionsService = { findMany: jest.fn() };
    rolesService = { findMany: jest.fn(), findOne: jest.fn() };
    userVerificationService = {
      create: jest.fn(),
      findOne: jest.fn(),
      consume: jest.fn(),
    };
    smsService = { sendVerificationCode: jest.fn() };
    mailService = { sendEmail: jest.fn() };
    fileService = { getPreSignedUrl: jest.fn() };
    jwtService = { verify: jest.fn(), sign: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    refreshSessions = {
      create: jest.fn(),
      rotate: jest.fn(),
      revokeAll: jest.fn(),
    };
    verifyPasswordMock = verifyPassword as jest.MockedFunction<
      typeof verifyPassword
    >;
    verifyPasswordMock.mockReset();

    service = new AuthService(
      usersService as any,
      permissionsService as any,
      rolesService as any,
      userVerificationService as any,
      smsService,
      mailService as any,
      fileService as any,
      jwtService as unknown as JwtService,
      eventEmitter as unknown as EventEmitter2,
      refreshSessions as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('signIn', () => {
    it('should reject unknown users', async () => {
      usersService.findOneWithPassword.mockResolvedValue(null);

      await expect(
        service.signIn('user@example.com', 'secret'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject invalid passwords', async () => {
      usersService.findOneWithPassword.mockResolvedValue(createUser());
      verifyPasswordMock.mockResolvedValue(false);

      await expect(service.signIn('user@example.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject inactive users', async () => {
      usersService.findOneWithPassword.mockResolvedValue(
        createUser({ is_active: false }),
      );
      verifyPasswordMock.mockResolvedValue(true);

      await expect(
        service.signIn('user@example.com', 'secret'),
      ).rejects.toThrow('User is not active');
    });

    it('should reject contributors from web sign in', async () => {
      usersService.findOneWithPassword.mockResolvedValue(
        createUser({ role: { name: RoleEnum.CONTRIBUTOR } }),
      );
      verifyPasswordMock.mockResolvedValue(true);

      await expect(
        service.signIn('user@example.com', 'secret'),
      ).rejects.toThrow('Contributors are not allowed to sign in');
    });

    it('should return sanitized user details and tokens for allowed roles', async () => {
      const user = createUser({
        profile_picture: 'avatars/user.png',
        role: { id: 'role-1', name: RoleEnum.ADMIN, created_date: new Date() },
      });

      usersService.findOneWithPassword.mockResolvedValue(user);
      verifyPasswordMock.mockResolvedValue(true);
      fileService.getPreSignedUrl.mockResolvedValue(
        'https://cdn.example/avatar',
      );
      jest.spyOn(service, 'generateToken').mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
      });

      await expect(
        service.signIn('user@example.com', 'secret'),
      ).resolves.toMatchObject({
        access_token: 'access',
        refresh_token: 'refresh',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          profile_picture: 'https://cdn.example/avatar',
          role: { name: RoleEnum.ADMIN },
        },
      });

      expect(fileService.getPreSignedUrl).toHaveBeenCalledWith(
        'avatars/user.png',
      );
      expect(service.generateToken).toHaveBeenCalledWith(
        'user-1',
        'user@example.com',
      );
    });
  });

  describe('mobileSignIn', () => {
    const credential = {
      username: 'user@example.com',
      password: 'secret',
      device_token: 'device-1',
      device_type: 'android',
    };

    it('should reject unknown users', async () => {
      usersService.findOneWithPassword.mockResolvedValue(null);

      await expect(service.mobileSignIn(credential)).rejects.toThrow(
        'Account not found',
      );
    });

    it('should reject invalid passwords', async () => {
      usersService.findOneWithPassword.mockResolvedValue(createUser());
      verifyPasswordMock.mockResolvedValue(false);

      await expect(service.mobileSignIn(credential)).rejects.toThrow(
        'Invalid password',
      );
    });

    it('should reject inactive users', async () => {
      usersService.findOneWithPassword.mockResolvedValue(
        createUser({ is_active: false }),
      );
      verifyPasswordMock.mockResolvedValue(true);

      await expect(service.mobileSignIn(credential)).rejects.toThrow(
        'User is not active',
      );
    });

    it('should reject non-contributor and non-reviewer roles', async () => {
      usersService.findOneWithPassword.mockResolvedValue(
        createUser({ role: { name: RoleEnum.ADMIN } }),
      );
      verifyPasswordMock.mockResolvedValue(true);

      await expect(service.mobileSignIn(credential)).rejects.toThrow(
        'Only contributors and reviewers can sign in',
      );
    });

    it('should allow contributor or reviewer sign in and emit login event', async () => {
      const user = createUser({
        role: {
          id: 'role-2',
          name: RoleEnum.REVIEWER,
          created_date: new Date(),
        },
        profile_picture: 'avatars/mobile.png',
      });

      usersService.findOneWithPassword.mockResolvedValue(user);
      verifyPasswordMock.mockResolvedValue(true);
      fileService.getPreSignedUrl.mockResolvedValue(
        'https://cdn.example/mobile',
      );
      jest.spyOn(service, 'generateToken').mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
      });

      await expect(service.mobileSignIn(credential)).resolves.toEqual({
        user: {
          ...user,
          profile_picture: 'https://cdn.example/mobile',
        },
        access_token: 'access',
        refresh_token: 'refresh',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        ActionEvents.USER_LOGGED_IN,
        {
          user_id: 'user-1',
          device_token: 'device-1',
          device_type: 'android',
        },
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new access and refresh tokens for a valid refresh token', async () => {
      refreshSessions.rotate.mockResolvedValue('user-1');
      refreshSessions.create.mockResolvedValue('new-refresh-token');
      usersService.findOneWithPassword.mockResolvedValue(createUser());
      jwtService.sign.mockReturnValueOnce('new-access-token');

      await expect(service.refreshToken('refresh-token')).resolves.toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });

      expect(refreshSessions.rotate).toHaveBeenCalledWith('refresh-token');
      expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
        sub: 'user-1',
        email: 'user@example.com',
      });
    });

    it('should reject invalid refresh tokens', async () => {
      refreshSessions.rotate.mockRejectedValue(new Error('invalid'));

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('permission and role lookups', () => {
    it('should return all permissions', async () => {
      const permissions = [{ id: 'perm-1', name: 'read' }];
      permissionsService.findMany.mockResolvedValue(permissions);

      await expect(service.getAllPermissions()).resolves.toBe(permissions);
      expect(permissionsService.findMany).toHaveBeenCalledWith({});
    });

    it('should return all roles', async () => {
      const roles = [{ id: 'role-1', name: RoleEnum.ADMIN }];
      rolesService.findMany.mockResolvedValue(roles);

      await expect(service.getAllRoles()).resolves.toBe(roles);
      expect(rolesService.findMany).toHaveBeenCalledWith({});
    });

    it('should return a role with permissions lookup result', async () => {
      const role = { id: 'role-1', name: RoleEnum.ADMIN };
      rolesService.findOne.mockResolvedValue(role);

      await expect(service.getRoleWithPermissions('role-1')).resolves.toBe(
        role,
      );
      expect(rolesService.findOne).toHaveBeenCalledWith({ id: 'role-1' });
    });
  });

  describe('forgotPassword', () => {
    it('should reject unknown users', async () => {
      usersService.findOneWithPassword.mockResolvedValue(null);

      await expect(service.forgotPassword('user@example.com')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject inactive users', async () => {
      usersService.findOneWithPassword.mockResolvedValue(
        createUser({ is_active: false }),
      );

      await expect(service.forgotPassword('user@example.com')).rejects.toThrow(
        'User is not active',
      );
    });

    it('should send email verification codes for email usernames', async () => {
      const user = createUser();

      usersService.findOneWithPassword.mockResolvedValue(user);
      userVerificationService.create.mockResolvedValue({ id: 'uv-1' });

      await expect(service.forgotPassword(user.email)).resolves.toBe(
        'Code sent successfully',
      );

      expect(mailService.sendEmail).toHaveBeenCalledWith(
        user.email,
        'Welcome to Mahder platform',
        expect.stringContaining('123456'),
      );
      expect(smsService.sendVerificationCode).not.toHaveBeenCalled();
      expect(userVerificationService.create).toHaveBeenCalledWith({
        username: user.email,
        code: 'hash:123456',
        expiration_date: expect.any(Date),
        status: 'pending',
      });
    });

    it('should send SMS verification codes for phone usernames', async () => {
      const user = createUser();

      usersService.findOneWithPassword.mockResolvedValue(user);
      userVerificationService.create.mockResolvedValue({ id: 'uv-1' });

      await expect(service.forgotPassword(user.phone_number)).resolves.toBe(
        'Code sent successfully',
      );

      expect(smsService.sendVerificationCode).toHaveBeenCalledWith(
        user.phone_number,
        '123456',
      );
      expect(mailService.sendEmail).not.toHaveBeenCalled();
      expect(userVerificationService.create).toHaveBeenCalledWith({
        username: user.phone_number,
        code: 'hash:123456',
        expiration_date: expect.any(Date),
        status: 'pending',
      });
    });
  });

  describe('setNewPassword', () => {
    const payload = {
      username: 'user@example.com',
      code: '123456',
      password: 'new-password',
    };

    it('should stop when otp verification fails', async () => {
      jest
        .spyOn(service, 'verifyOtp')
        .mockRejectedValue(new BadRequestException('Invalid code'));

      await expect(service.setNewPassword(payload)).rejects.toThrow(
        'Invalid code',
      );
      expect(usersService.findOneWithPassword).not.toHaveBeenCalled();
    });

    it('should reject missing users after successful otp verification', async () => {
      jest.spyOn(service, 'verifyOtp').mockResolvedValue(undefined);
      usersService.findOneWithPassword.mockResolvedValue(null);

      await expect(service.setNewPassword(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject inactive users after successful otp verification', async () => {
      jest.spyOn(service, 'verifyOtp').mockResolvedValue(undefined);
      usersService.findOneWithPassword.mockResolvedValue(
        createUser({ is_active: false }),
      );

      await expect(service.setNewPassword(payload)).rejects.toThrow(
        'User is not active',
      );
    });

    it('should change the password for valid users', async () => {
      jest.spyOn(service, 'verifyOtp').mockResolvedValue(undefined);
      usersService.findOneWithPassword.mockResolvedValue(createUser());
      usersService.changePasswordFromVerification.mockResolvedValue(undefined);

      await expect(service.setNewPassword(payload)).resolves.toBe(
        'Password changed successfully',
      );
      expect(usersService.changePasswordFromVerification).toHaveBeenCalledWith(
        'user-1',
        'new-password',
      );
      expect(refreshSessions.revokeAll).toHaveBeenCalledWith('user-1');
    });
  });

  describe('verifyOtp', () => {
    it('should reject missing verification codes', async () => {
      userVerificationService.consume.mockRejectedValue(new Error());

      await expect(
        service.verifyOtp({ username: 'user@example.com', code: '123456' }),
      ).rejects.toThrow('Invalid or expired code');
    });

    it('should reject expired verification codes', async () => {
      userVerificationService.consume.mockRejectedValue(new Error());

      await expect(
        service.verifyOtp({ username: 'user@example.com', code: '123456' }),
      ).rejects.toThrow('Invalid or expired code');
    });

    it('should allow valid verification codes', async () => {
      userVerificationService.consume.mockResolvedValue(undefined);

      await expect(
        service.verifyOtp({ username: 'user@example.com', code: '123456' }),
      ).resolves.toBeUndefined();
      expect(userVerificationService.consume).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
      );
    });
  });

  describe('generateToken', () => {
    it('should sign access and refresh tokens with the expected payloads', async () => {
      jwtService.sign.mockReturnValueOnce('access-token');
      refreshSessions.create.mockResolvedValue('refresh-token');

      await expect(
        service.generateToken('user-1', 'user@example.com'),
      ).resolves.toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });

      expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
        sub: 'user-1',
        email: 'user@example.com',
      });
      expect(refreshSessions.create).toHaveBeenCalledWith('user-1');
    });
  });
});
