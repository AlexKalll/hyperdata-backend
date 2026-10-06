import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      ignoreExpiration: false,
    });
  }
  async validate(payload: any) {
    // Logger.log('JWT Payload', payload);
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid Token');
    }
    // Logger.error('JWT Payload', payload.sub);
    return { id: payload.sub, onboarding: payload.onboarding === true };
  }
}
