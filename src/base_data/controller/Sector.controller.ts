import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Query,
  UsePipes,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { SectorService } from '../service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import { CreateSectorDto, UpdateSectorDto } from '../dto/Sector.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { SectorSanitized } from '../sanitize';
import { PaginatedResult } from 'src/utils/paginate.util';
@Controller('/setting/sector')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('Sector')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SectorController {
  constructor(private readonly sectorService: SectorService) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  async create(@Body() sectorDto: CreateSectorDto, @Request() req) {
    return this.sectorService.create(sectorDto);
  }
  @Get('')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Paginate Sectors' })
  @ApiExtraModels(PaginatedResult, SectorSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(SectorSanitized) },
            },
          },
        },
      ],
    },
  })
  async findPaginate(@Query() paginationDto: PaginationDto) {
    const data = await this.sectorService.findPaginate(paginationDto);
    return {
      ...data,
      result: data.result.map((item) => SectorSanitized.from(item)),
    };
  }

  @Get('all')
  @ApiResponse({
    type: [SectorSanitized],
  })
  async findAll(@Query() query: UpdateSectorDto): Promise<SectorSanitized[]> {
    const sectors = await this.sectorService.findMany(query);
    return sectors.map((item) => SectorSanitized.from(item));
  }

  @Get(':id')
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string) {
    const sector = await this.sectorService.findOne({ id });
    if (!sector) {
      throw new NotFoundException(`Sector #${id} not found`);
    }
    return sector;
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() sectorData: UpdateSectorDto,
    @Request() request,
  ) {
    return this.sectorService.update(id, sectorData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.sectorService.delete(id);
  }
}
