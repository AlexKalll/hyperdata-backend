import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../service/auth.service';

import { ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { RolesGuard } from '../guard/role.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../decorators/roles.enum';
import { AuthRateLimitGuard } from '../guard/auth-rate-limit.guard';
import {
  ForgotPasswordDto,
  MobileSignInDto,
  SetNewPasswordDto,
  SignInDto,
  VerifyOtp,
} from '../dto/SignIn.dto';

@ApiTags('Auth') // This makes it appear first in Swagger
@Controller('iam/auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(private authService: AuthService) {}
  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.username, signInDto.password);
  }

  @Post('mobile_login')
  mobileSignIn(@Body() signInDto: MobileSignInDto) {
    return this.authService.mobileSignIn(signInDto);
  }

  @Post('refresh-token')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: {
          type: 'string',
        },
      },
    },
  })
  refreshToken(@Body() refreshTokenDto: { refresh_token: string }) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.username);
  }
  @Post('reset-password/')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body()
    setPassword: SetNewPasswordDto,
  ) {
    return this.authService.setNewPassword(setPassword);
  }
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body()
    verifyOtp: VerifyOtp,
  ) {
    await this.authService.validateOtp(verifyOtp);
    return { message: 'OTP verified successfully' };
  }

  @Get('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  getRoles() {
    return this.authService.getAllRoles();
  }
  @Get('roles/:id')
  getRolePermissions(
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    id: string,
  ) {
    return this.authService.getRoleWithPermissions(id);
  }
}
