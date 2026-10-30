import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { Role } from 'src/auth/decorators/roles.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Request } from '@nestjs/common';
import { ScoreValueService } from '../service/ScoreValue.service';
import { ScoreValueDto } from '../dto/wallet.dto';
@ApiTags('Score Value')
@ApiBearerAuth()
@Controller('score-value')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ScoreValueController {
  constructor(
    // Inject necessary services here
    private readonly scoreValueService: ScoreValueService,
  ) {}
  @Get('')
  async getBalance(@Request() request): Promise<any> {
    // Logic for retrieving the balance of the wallet
    return this.scoreValueService.get();
  }
  @Put('/update')
  async update(@Body() value: ScoreValueDto): Promise<any> {
    // Logic for retrieving the balance of the wallet
    return this.scoreValueService.update({ value_in_birr: value.scoreValue });
  }
}
