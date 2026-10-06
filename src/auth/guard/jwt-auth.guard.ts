import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from 'src/auth/service/User.service';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly usersService: UserService, // ✅ Inject UsersService
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const canActivate = (await super.canActivate(context)) as boolean;
    if (!canActivate) return false;
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Extracted by AuthGuard
    if (!user) {
      throw new UnauthorizedException();
    }

    // Fetch full user details from DB
    const fullUser = await this.usersService.findOne({
      where: { id: user.id },
      relations: { role: true },
    });
    if (!fullUser || !fullUser.is_active) {
      throw new UnauthorizedException('User not found');
    }

    request.user = fullUser; // Attach full user data

    return true;
  }
}
