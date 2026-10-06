import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, QueryRunner, Repository } from 'typeorm';
import { UserVerificationCode } from '../entities/UserVerificationCode.entity';
import { QueryOptions } from 'src/utils/queryOption.util';
import { verifyOtpHash } from 'src/utils/security/credential.util';

@Injectable()
export class UserVerificationCodeService {
  constructor(
    @InjectRepository(UserVerificationCode)
    private readonly userVerificationCodeRepository: Repository<UserVerificationCode>,
  ) {}

  /**
   * Creates a new user verification code in the database.
   * If the user already has a verification code, it will be removed
   * before creating the new one.
   * @param userData The partial user verification code data to create.
   * @returns A promise resolving to the created user verification code.
   */
  async create(
    userData: Partial<UserVerificationCode>,
  ): Promise<UserVerificationCode> {
    return this.userVerificationCodeRepository.manager.transaction(
      async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          userData.username,
        ]);
        await manager.delete(UserVerificationCode, {
          username: userData.username,
        });
        return manager.save(manager.create(UserVerificationCode, userData));
      },
    );
  }

  /**
   * Retrieves a single user verification code from the database.
   * @param query The query to filter user verification codes. Supports relations.
   * @returns A promise resolving to the user verification code if found, or null.
   */
  async findOne(
    query: QueryOptions<UserVerificationCode>,
  ): Promise<UserVerificationCode | null> {
    const options: any = {
      where: query.where,
      order: query.order || {},
      relations: query.relations || [],
    };
    if (query.select) {
      options.select = query.select;
    }
    return await this.userVerificationCodeRepository.findOne(options);
  }

  /**
   * Retrieves multiple user verification codes from the database.
   * Supports relations.
   * @param query The query to filter user verification codes.
   * @returns A promise resolving to an array of user verification codes matching the query.
   */
  async findMany(
    query: FindManyOptions<UserVerificationCode>,
  ): Promise<UserVerificationCode[]> {
    return await this.userVerificationCodeRepository.find(query);
  }
  /**
   * Updates a user verification code in the database.
   * @param id The id of the user verification code to update.
   * @param userVerificationCode The partial user verification code data to update.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the updated user verification code if found, or null.
   */
  async update(
    id: string,
    userVerificationCode: Partial<UserVerificationCode>,
    queryRunner?: QueryRunner,
  ): Promise<UserVerificationCode | null> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      await manager.update(UserVerificationCode, id, userVerificationCode);
      return await manager.findOne(UserVerificationCode, { where: { id } });
    } else {
      const manager = this.userVerificationCodeRepository;
      await manager.update(id, userVerificationCode);
      return await manager.findOne({ where: { id } });
    }
  }
  async consume(username: string, code: string, id?: string): Promise<void> {
    await this.check(username, code, id, true);
  }
  async validate(username: string, code: string): Promise<void> {
    await this.check(username, code, undefined, false);
  }

  private async check(
    username: string,
    code: string,
    id: string | undefined,
    consume: boolean,
  ): Promise<void> {
    const valid = await this.userVerificationCodeRepository.manager.transaction(
      async (manager) => {
        const where: any = { username, status: 'pending' };
        if (id) where.id = id;
        const verification = await manager.findOne(UserVerificationCode, {
          where,
          lock: { mode: 'pessimistic_write' },
        });
        if (!verification) return false;
        if (verification.expiration_date <= new Date()) {
          if (verification) {
            await manager.update(UserVerificationCode, verification.id, {
              status: 'expired',
            });
          }
          return false;
        }
        if (
          verification.attempt_count >= 5 ||
          !verifyOtpHash(code, verification.code)
        ) {
          const attemptCount = verification.attempt_count + 1;
          await manager.update(UserVerificationCode, verification.id, {
            attempt_count: attemptCount,
            status: attemptCount >= 5 ? 'expired' : 'pending',
          });
          return false;
        }
        if (consume) {
          await manager.update(UserVerificationCode, verification.id, {
            status: 'verified',
          });
        }
        return true;
      },
    );
    if (!valid) throw new Error('Invalid code');
  }
}
