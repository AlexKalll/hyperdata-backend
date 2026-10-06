import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { hashToken } from 'src/utils/security/credential.util';
import { RefreshSession } from '../entities/RefreshSession.entity';

@Injectable()
export class RefreshSessionService {
  constructor(
    @InjectRepository(RefreshSession)
    private readonly repository: Repository<RefreshSession>,
  ) {}

  async create(userId: string): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repository.save(
      this.repository.create({
        user_id: userId,
        token_hash: hashToken(token),
        expires_at: expiresAt,
      }),
    );
    return token;
  }

  async rotate(token: string): Promise<string> {
    const session = await this.repository.findOne({
      where: { token_hash: hashToken(token), revoked_at: IsNull() },
    });
    if (!session || session.expires_at <= new Date())
      throw new UnauthorizedException();
    const result = await this.repository.update(
      { id: session.id, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
    if (!result.affected) throw new UnauthorizedException();
    return session.user_id;
  }

  async revokeAll(userId: string): Promise<void> {
    await this.repository.update(
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpired(): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .where('expires_at < NOW()')
      .orWhere("revoked_at < NOW() - INTERVAL '1 day'")
      .execute();
  }
}
