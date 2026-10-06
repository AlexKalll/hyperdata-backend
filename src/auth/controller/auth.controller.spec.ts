jest.mock('src/config/minio.config', () => ({
  multerAudioS3Storage: {},
  multerCSVS3Storage: {},
  multerImageS3Storage: {},
}));

import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signIn: jest.Mock;
    mobileSignIn: jest.Mock;
    refreshToken: jest.Mock;
    forgotPassword: jest.Mock;
    setNewPassword: jest.Mock;
    validateOtp: jest.Mock;
    getAllRoles: jest.Mock;
    getRoleWithPermissions: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      signIn: jest.fn(),
      mobileSignIn: jest.fn(),
      refreshToken: jest.fn(),
      forgotPassword: jest.fn(),
      setNewPassword: jest.fn(),
      validateOtp: jest.fn(),
      getAllRoles: jest.fn(),
      getRoleWithPermissions: jest.fn(),
    };

    controller = new AuthController(authService as any);
  });

  it('should forward login credentials to the auth service', async () => {
    authService.signIn.mockResolvedValue({ access_token: 'token' });

    await expect(
      controller.signIn({
        username: 'user@example.com',
        password: 'secret',
      } as any),
    ).resolves.toEqual({ access_token: 'token' });
    expect(authService.signIn).toHaveBeenCalledWith(
      'user@example.com',
      'secret',
    );
  });

  it('should forward mobile login payloads', async () => {
    const body = {
      username: 'user@example.com',
      password: 'secret',
      device_token: 'device-1',
    };
    authService.mobileSignIn.mockResolvedValue({ access_token: 'token' });

    await expect(controller.mobileSignIn(body as any)).resolves.toEqual({
      access_token: 'token',
    });
    expect(authService.mobileSignIn).toHaveBeenCalledWith(body);
  });

  it('should forward refresh tokens', async () => {
    authService.refreshToken.mockResolvedValue({ access_token: 'new-token' });

    await expect(
      controller.refreshToken({ refresh_token: 'refresh-token' }),
    ).resolves.toEqual({ access_token: 'new-token' });
    expect(authService.refreshToken).toHaveBeenCalledWith('refresh-token');
  });

  it('should forward forgot password usernames', async () => {
    authService.forgotPassword.mockResolvedValue('Code sent successfully');

    await expect(
      controller.forgotPassword({ username: 'user@example.com' } as any),
    ).resolves.toBe('Code sent successfully');
    expect(authService.forgotPassword).toHaveBeenCalledWith('user@example.com');
  });

  it('should forward reset password payloads', async () => {
    const body = {
      username: 'user@example.com',
      code: '123456',
      password: 'new',
    };
    authService.setNewPassword.mockResolvedValue(
      'Password changed successfully',
    );

    await expect(controller.resetPassword(body as any)).resolves.toBe(
      'Password changed successfully',
    );
    expect(authService.setNewPassword).toHaveBeenCalledWith(body);
  });

  it('should return a stable success response after otp verification', async () => {
    authService.validateOtp.mockResolvedValue(undefined);

    await expect(
      controller.verifyOtp({
        username: 'user@example.com',
        code: '123456',
      } as any),
    ).resolves.toEqual({ message: 'OTP verified successfully' });
    expect(authService.validateOtp).toHaveBeenCalledWith({
      username: 'user@example.com',
      code: '123456',
    });
  });

  it('should return all roles from the auth service', async () => {
    authService.getAllRoles.mockResolvedValue([{ id: 'role-1' }]);

    await expect(controller.getRoles()).resolves.toEqual([{ id: 'role-1' }]);
    expect(authService.getAllRoles).toHaveBeenCalled();
  });

  it('should return role permissions for the requested id', async () => {
    authService.getRoleWithPermissions.mockResolvedValue({ id: '1' });

    await expect(controller.getRolePermissions('1')).resolves.toEqual({
      id: '1',
    });
    expect(authService.getRoleWithPermissions).toHaveBeenCalledWith('1');
  });
});
