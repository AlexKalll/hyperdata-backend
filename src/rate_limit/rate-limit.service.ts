import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.client = new Redis(this.configService.getOrThrow<string>('REDIS_URL'));
    this.client.on('error', (error) =>
      this.logger.error(`Rate-limit Redis error: ${error.message}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.quit();
    this.client = null;
  }

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') {
      throw new Error('Rate-limit storage is unavailable');
    }
    const count = (await this.client.eval(
      `local count = redis.call('INCR', KEYS[1])
       if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       return count`,
      1,
      key,
      windowSeconds,
    )) as number;
    return count <= limit;
  }
}
