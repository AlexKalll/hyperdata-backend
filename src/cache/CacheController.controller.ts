import { Controller, Delete, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { CacheService } from './CacheService.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';

@ApiTags('Cache')
@Controller('cache')
@ApiBearerAuth()
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Delete('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async clearAllCache(@Req() req) {
    await this.cacheService.clearAllCache();
    return { message: 'All cache cleared successfully' };
  }
}
