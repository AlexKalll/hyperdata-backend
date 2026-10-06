import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RateLimitService } from 'src/rate_limit/rate-limit.service';
import { hashToken } from 'src/utils/security/credential.util';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AuthRateLimitGuard.name);

  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const account = String(
      request.body?.username ||
        request.body?.phone_number ||
        request.body?.phone ||
        '',
    )
      .trim()
      .toLowerCase();
    const key = `rate:auth:${request.ip || 'unknown'}:${hashToken(account)}:${request.route?.path || request.url}`;
    try {
      if (!(await this.rateLimitService.consume(key, 10, 60))) {
        throw new HttpException('Too many authentication attempts', 429);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429)
        throw error;
      this.logger.error('Authentication rate-limit storage is unavailable');
      throw new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      );
    }
  }
}
