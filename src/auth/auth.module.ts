import { Global, Module } from '@nestjs/common';
import { RateLimitModule } from 'src/rate_limit/rate-limit.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserLog } from './entities/UserLog.entity';
import { Role } from './entities/Role.entity';
import { User } from './entities/User.entity';
import { Notification } from '../common/entities/Notifaction.entity';
import { Permission } from './entities/Permission.entity';
import { UserService } from './service/User.service';
import { UsersController } from './controller/user.controller';
import { RoleService } from './service/Role.service';
import { PermissionService } from './service/Permission.service';
import { SmsModule } from 'src/sms/sms.module';
import { UserVerificationCode } from './entities/UserVerificationCode.entity';
import { UserVerificationCodeService } from './service/UserVerificationCode.service';
import { EmailModule } from 'src/email/email.module';
import { BaseDataModule } from 'src/base_data/base_data.module';
import { UserDeviceTokenService } from './service/UserDeviceToken.service';
import { UserDeviceToken } from './entities/UserDeviceToken.entity';
import { FinanceModule } from 'src/finance/finance.module';
import { UserScore } from './entities/UserScore.entity';
import { UserScoreService } from './service/UserScore.service';
import { RefreshSession } from './entities/RefreshSession.entity';
import { RefreshSessionService } from './service/RefreshSession.service';
import { AuthRateLimitGuard } from './guard/auth-rate-limit.guard';
import { OnboardingAuthGuard } from './guard/onboarding-auth.guard';
import type { StringValue } from 'ms';

@Global() // Make AuthModule globally available
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      User,
      Permission,
      Notification,
      UserLog,
      UserVerificationCode,
      UserDeviceToken,
      UserScore,
      RefreshSession,
    ]), // Import TypeOrmModule for Role and User entitiesM
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '24h',
          ) as StringValue,
        },
      }),
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    SmsModule,
    EmailModule,
    BaseDataModule,
    FinanceModule,
    RateLimitModule,
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    UserService,
    JwtStrategy,
    RoleService,
    PermissionService,
    UserVerificationCodeService,
    UserDeviceTokenService,
    UserScoreService,
    RefreshSessionService,
    AuthRateLimitGuard,
    OnboardingAuthGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    UserService,
    RoleService,
    UserScoreService,
  ], // Export AuthService, JwtModule, and PassportModule for other modules
})
export class AuthModule {}
