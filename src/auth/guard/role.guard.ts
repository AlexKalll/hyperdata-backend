import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../decorators/roles.enum';
import { Role as RoleEntity } from 'src/auth/entities/Role.entity';
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles: string[] | null = this.reflector.getAllAndOverride<
      Role[]
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles) {
      return true; // If no roles are set, allow access
    }

    const { user } = context.switchToHttp().getRequest();
    const role: RoleEntity | undefined = user?.role as RoleEntity | undefined;
    if (!user || !role || !requiredRoles.includes(role.name)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
    return requiredRoles.includes(role.name);
  }
}
