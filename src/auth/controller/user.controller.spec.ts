jest.mock('src/config/minio.config', () => ({
  multerImageS3Storage: {},
}));

import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsersController } from './user.controller';
import { UserSanitize } from '../sanitize';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: Record<string, jest.Mock>;
  let fileService: { getPreSignedUrl: jest.Mock };
  let activityLogService: Record<string, jest.Mock>;
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
  };
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      signUp: jest.fn(),
      verifyAccount: jest.fn(),
      firstUpdate: jest.fn(),
      findOne: jest.fn(),
      findMany: jest.fn(),
    };
    fileService = { getPreSignedUrl: jest.fn() };
    activityLogService = { create: jest.fn() };
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    controller = new UsersController(
      usersService as any,
      fileService as any,
      activityLogService as any,
      dataSource as unknown as DataSource,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create users inside a transaction and mask the password', async () => {
    usersService.create.mockResolvedValue({ id: 'user-1', password: 'hashed' });

    await expect(
      controller.create({ email: 'user@example.com' } as any),
    ).resolves.toEqual({
      id: 'user-1',
      password: '_',
    });

    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(usersService.create).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      queryRunner,
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('should rollback and rethrow when user creation fails', async () => {
    const error = new Error('create failed');
    usersService.create.mockRejectedValue(error);

    await expect(
      controller.create({ email: 'user@example.com' } as any),
    ).rejects.toThrow('create failed');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('should forward sign up requests', async () => {
    usersService.signUp.mockResolvedValue({ id: 'user-1' });

    await expect(
      controller.SignUp({ phone_number: '+251900000000' } as any),
    ).resolves.toEqual({
      id: 'user-1',
    });
    expect(usersService.signUp).toHaveBeenCalledWith('+251900000000');
  });

  it('should forward account verification parameters', async () => {
    usersService.verifyAccount.mockResolvedValue({ ok: true });

    await expect(
      controller.verifyUser('user-1', {
        code: '123456',
        phone: '+251900000000',
      } as any),
    ).resolves.toEqual({ ok: true });
    expect(usersService.verifyAccount).toHaveBeenCalledWith(
      'user-1',
      '123456',
      '+251900000000',
    );
  });

  it('should forward first updates using the authenticated user id', async () => {
    usersService.firstUpdate.mockResolvedValue({ ok: true });

    await expect(
      controller.firstUpdate({ first_name: 'Test' } as any, {
        user: { id: 'user-1' },
      }),
    ).resolves.toEqual({ ok: true });
    expect(usersService.firstUpdate).toHaveBeenCalledWith('user-1', {
      first_name: 'Test',
    });
  });

  it('should throw when the current user cannot be found', async () => {
    usersService.findOne.mockResolvedValue(null);

    await expect(
      controller.findMe({ user: { id: 'user-1' } } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return the sanitized current user with a presigned profile picture', async () => {
    const sanitizeSpy = jest.spyOn(UserSanitize, 'from');
    usersService.findOne.mockResolvedValue({
      id: 'user-1',
      first_name: 'Test',
      middle_name: 'User',
      last_name: 'Example',
      phone_number: '+251900000000',
      profile_picture: 'avatars/user.png',
      is_active: true,
      email: 'user@example.com',
      created_date: new Date(),
      role: { id: 'role-1', name: 'Admin', created_date: new Date() },
      woreda: 'W1',
      city: 'Addis',
      zone: { name: 'Zone 1' },
      region: { name: 'Region 1' },
      region_id: 'region-1',
      zone_id: 'zone-1',
    });
    fileService.getPreSignedUrl.mockResolvedValue('signed:avatars/user.png');

    const result = await controller.findMe({ user: { id: 'user-1' } } as any);

    expect(fileService.getPreSignedUrl).toHaveBeenCalledWith(
      'avatars/user.png',
    );
    expect(sanitizeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ profile_picture: 'signed:avatars/user.png' }),
    );
    expect(result).toMatchObject({
      id: 'user-1',
      profile_picture: 'signed:avatars/user.png',
    });
  });

  it('should sanitize all users when returning the full list', async () => {
    const sanitizeSpy = jest
      .spyOn(UserSanitize, 'from')
      .mockImplementation((user: any) => ({ id: user.id }) as any);
    usersService.findMany.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);

    await expect(controller.findAll({ is_active: true })).resolves.toEqual([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);

    expect(usersService.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
    });
    expect(sanitizeSpy).toHaveBeenCalledTimes(2);
  });
});
