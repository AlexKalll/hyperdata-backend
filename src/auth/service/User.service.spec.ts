jest.mock('src/auth/service/Role.service', () => ({
  RoleService: class RoleService {},
}));

jest.mock('src/common/service/File.service', () => ({
  FileService: class FileService {},
}));

jest.mock('src/sms/sms.service', () => ({
  SmsService: class SmsService {},
}));

jest.mock('src/base_data/service/Dialect.service', () => ({
  DialectService: class DialectService {},
}));

jest.mock('src/base_data/service/Language.service', () => ({
  LanguageService: class LanguageService {},
}));

jest.mock('src/base_data/service', () => ({
  RegionService: class RegionService {},
  ZoneService: class ZoneService {},
}));

jest.mock('src/finance/service/Wallet.service', () => ({
  WalletService: class WalletService {},
}));

jest.mock('src/auth/service/UserScore.service', () => ({
  UserScoreService: class UserScoreService {},
}));

jest.mock('src/auth/service/UserVerificationCode.service', () => ({
  UserVerificationCodeService: class UserVerificationCodeService {},
}));

jest.mock('src/utils/security/credential.util', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateOtp: jest.fn(() => '123456'),
  hashOtp: jest.fn((value) => `hash:${value}`),
}));

import { JwtService } from '@nestjs/jwt';
import { QueryRunner } from 'typeorm';
import { UserService } from './User.service';
import { Role as RoleConstant } from '../decorators/roles.enum';
import { hashPassword } from 'src/utils/security/credential.util';

describe('UserService', () => {
  let service: UserService;
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let roleService: { findOne: jest.Mock };
  let fileService: { getPreSignedUrl: jest.Mock };
  let smsService: Record<string, never>;
  let dialectService: { findOne: jest.Mock };
  let languageService: { findOne: jest.Mock };
  let zoneService: { findOne: jest.Mock };
  let regionService: { findOne: jest.Mock };
  let walletService: { findOneOrCreate: jest.Mock };
  let userScoreService: { createScore: jest.Mock };
  let userVerificationService: Record<string, never>;
  let jwtService: Record<string, never>;
  let hashPasswordMock: jest.MockedFunction<typeof hashPassword>;

  function createUser(overrides: Record<string, unknown> = {}): any {
    return {
      id: 'user-1',
      email: 'user@example.com',
      phone_number: '+251900000000',
      profile_picture: undefined,
      role: { id: 'role-1', name: RoleConstant.ADMIN },
      wallet: { id: 'wallet-1' },
      ...overrides,
    };
  }

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    roleService = { findOne: jest.fn() };
    fileService = { getPreSignedUrl: jest.fn() };
    smsService = {};
    dialectService = { findOne: jest.fn() };
    languageService = { findOne: jest.fn() };
    zoneService = { findOne: jest.fn() };
    regionService = { findOne: jest.fn() };
    walletService = { findOneOrCreate: jest.fn() };
    userScoreService = { createScore: jest.fn() };
    userVerificationService = {};
    jwtService = {};
    hashPasswordMock = hashPassword as jest.MockedFunction<typeof hashPassword>;
    hashPasswordMock.mockReset();

    service = new UserService(
      userRepository as any,
      roleService as any,
      {} as any,
      fileService as any,
      smsService as any,
      dialectService as any,
      languageService as any,
      zoneService as any,
      regionService as any,
      walletService as any,
      userScoreService as any,
      userVerificationService as any,
      jwtService as unknown as JwtService,
      { revokeAll: jest.fn() } as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('userProfile', () => {
    it('should return a user with role and wallet relations', async () => {
      const user = createUser();
      userRepository.findOne.mockResolvedValue(user);

      await expect(service.userProfile('user-1')).resolves.toBe(user);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: { role: true, wallet: true },
      });
    });

    it('should throw when the user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.userProfile('missing')).rejects.toThrow(
        'User not found',
      );
    });

    it('should presign the profile picture when it exists', async () => {
      const user = createUser({ profile_picture: 'avatars/user.png' });
      userRepository.findOne.mockResolvedValue(user);
      fileService.getPreSignedUrl.mockResolvedValue('https://cdn.example/user');

      await expect(service.userProfile('user-1')).resolves.toMatchObject({
        profile_picture: 'https://cdn.example/user',
      });
      expect(fileService.getPreSignedUrl).toHaveBeenCalledWith(
        'avatars/user.png',
      );
    });
  });

  describe('findOneWithPassword', () => {
    it('should apply the secure default select fields', async () => {
      userRepository.findOne.mockResolvedValue(createUser());

      await service.findOneWithPassword({
        where: { email: 'user@example.com' },
        relations: { role: true },
      });

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        order: {},
        relations: { role: true },
        select: {
          id: true,
          email: true,
          password: true,
          is_active: true,
          profile_picture: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          phone_number: true,
          gender: true,
          role_id: true,
        },
      });
    });
  });

  describe('findMany', () => {
    it('should omit the super admin from repository queries', async () => {
      userRepository.find.mockResolvedValue([]);
      const query = { where: { is_active: true } } as any;

      await service.findMany(query);

      const where = userRepository.find.mock.calls[0][0].where;
      expect(where.is_active).toBe(true);
      expect(where.first_name).toMatchObject({
        _type: 'not',
        _value: 'SuperAdmin',
      });
    });

    it('should use the query runner manager when provided', async () => {
      const find = jest.fn().mockResolvedValue(['user']);
      const queryRunner = { manager: { find } } as unknown as QueryRunner;

      await expect(
        service.findMany({ where: {} } as any, queryRunner),
      ).resolves.toEqual(['user']);
      expect(find).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    function mockRelatedLookups(roleName = RoleConstant.ADMIN) {
      roleService.findOne.mockResolvedValue({ id: 'role-1', name: roleName });
      dialectService.findOne.mockResolvedValue(null);
      languageService.findOne.mockResolvedValue(null);
      zoneService.findOne.mockResolvedValue(null);
      regionService.findOne.mockResolvedValue(null);
    }

    it('should reject duplicate phone numbers', async () => {
      mockRelatedLookups();
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(createUser());

      await expect(
        service.create({
          role_id: 'role-1',
          phone_number: '+251900000000',
          password: 'secret',
        } as any),
      ).rejects.toThrow('Phone number already exists');
    });

    it('should reject duplicate emails', async () => {
      mockRelatedLookups();
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createUser());

      await expect(
        service.create({
          role_id: 'role-1',
          phone_number: '+251900000000',
          email: 'user@example.com',
          password: 'secret',
        } as any),
      ).rejects.toThrow('Email already exists');
    });

    it('should reject missing roles', async () => {
      mockRelatedLookups();
      roleService.findOne.mockResolvedValue(null);
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(
        service.create({ role_id: 'missing-role', password: 'secret' } as any),
      ).rejects.toThrow('Role not found');
    });

    it('should reject missing dialect, language, zone, and region when provided', async () => {
      mockRelatedLookups();
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(
        service.create({
          role_id: 'role-1',
          password: 'secret',
          dialect_id: 'dialect-1',
        } as any),
      ).rejects.toThrow('Dialect not found');

      dialectService.findOne.mockResolvedValue({ id: 'dialect-1' });
      await expect(
        service.create({
          role_id: 'role-1',
          password: 'secret',
          dialect_id: 'dialect-1',
          language_id: 'language-1',
        } as any),
      ).rejects.toThrow('Language not found');

      languageService.findOne.mockResolvedValue({ id: 'language-1' });
      await expect(
        service.create({
          role_id: 'role-1',
          password: 'secret',
          dialect_id: 'dialect-1',
          language_id: 'language-1',
          zone_id: 'zone-1',
        } as any),
      ).rejects.toThrow('Zone not found');

      zoneService.findOne.mockResolvedValue({ id: 'zone-1' });
      await expect(
        service.create({
          role_id: 'role-1',
          password: 'secret',
          dialect_id: 'dialect-1',
          language_id: 'language-1',
          zone_id: 'zone-1',
          region_id: 'region-1',
        } as any),
      ).rejects.toThrow('Region not found');
    });

    it('should reject missing passwords', async () => {
      mockRelatedLookups();
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(
        service.create({ role_id: 'role-1' } as any),
      ).rejects.toThrow('Password is required');
      expect(hashPasswordMock).not.toHaveBeenCalled();
    });

    it('should hash the password and initialize wallet and score for contributor users', async () => {
      mockRelatedLookups(RoleConstant.CONTRIBUTOR);
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      hashPasswordMock.mockResolvedValue('hashed-secret');
      userRepository.create.mockImplementation((data) => data);
      userRepository.save.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.create({
          role_id: 'role-1',
          phone_number: '+251900000000',
          email: 'user@example.com',
          password: 'secret',
        } as any),
      ).resolves.toEqual({ id: 'user-1' });

      expect(hashPasswordMock).toHaveBeenCalledWith('secret');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed-secret' }),
      );
      expect(walletService.findOneOrCreate).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
      expect(userScoreService.createScore).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
    });

    it('should create contributor users through a query runner and initialize wallet and score', async () => {
      mockRelatedLookups(RoleConstant.CONTRIBUTOR);
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      hashPasswordMock.mockResolvedValue('hashed-secret');

      const manager = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockResolvedValue({ id: 'user-2' }),
      };
      const queryRunner = { manager } as unknown as QueryRunner;

      await expect(
        service.create(
          {
            role_id: 'role-1',
            phone_number: '+251911111111',
            email: 'contributor@example.com',
            password: 'secret',
          } as any,
          queryRunner,
        ),
      ).resolves.toEqual({ id: 'user-2' });

      expect(manager.create).toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalled();
      expect(userScoreService.createScore).toHaveBeenCalledWith(
        'user-2',
        queryRunner,
      );
      expect(walletService.findOneOrCreate).toHaveBeenCalledWith(
        'user-2',
        queryRunner,
      );
    });
  });
});
