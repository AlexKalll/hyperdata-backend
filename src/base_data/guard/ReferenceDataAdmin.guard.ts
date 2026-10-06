import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from 'src/auth/decorators/roles.enum';

@Injectable()
export class ReferenceDataAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }
    if (![Role.ADMIN, Role.SUPER_ADMIN].includes(request.user?.role?.name)) {
      throw new ForbiddenException('Administrator access is required');
    }
    return true;
  }
}
