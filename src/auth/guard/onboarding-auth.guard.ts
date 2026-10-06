import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from '../service/User.service';

@Injectable()
export class OnboardingAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly usersService: UserService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await super.canActivate(context))) return false;
    const request = context.switchToHttp().getRequest();
    if (!request.user?.onboarding) throw new UnauthorizedException();
    const user = await this.usersService.findOne({
      where: { id: request.user.id },
    });
    if (!user || user.is_active) throw new UnauthorizedException();
    request.user = user;
    return true;
  }
}
