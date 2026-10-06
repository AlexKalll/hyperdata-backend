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
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { RegionService } from '../service/Region.service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import {
  CreateRegionDto,
  SearchRegionDto,
  UpdateRegionDto,
} from '../dto/Region.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { PaginatedResult } from 'src/utils/paginate.util';
import { RegionSanitized } from '../sanitize';
@Controller('/setting/region')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('Region')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  @ApiOperation({ summary: 'Create a new region' })
  @ApiResponse({ status: 201, description: 'Region created successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() createRegionDto: CreateRegionDto, @Request() req) {
    return this.regionService.create({
      ...createRegionDto,
      created_by: req.user.id,
    });
  }
  @Get('')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Paginate Regions' })
  @ApiExtraModels(PaginatedResult, RegionSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(RegionSanitized) },
            },
          },
        },
      ],
    },
  })
  async findPaginate(
    @Query() regionSearchWithPagination: SearchRegionDto,
  ): Promise<PaginatedResult<RegionSanitized>> {
    let query = {};
    if (regionSearchWithPagination.name) {
      query = { ...query, name: regionSearchWithPagination.name };
    }
    if (regionSearchWithPagination.country_id) {
      query = { ...query, country_id: regionSearchWithPagination.country_id };
    }
    const data = await this.regionService.findPaginate(
      { where: query, relations: { country: true } },
      {
        page: regionSearchWithPagination.page,
        limit: regionSearchWithPagination.limit,
      },
    );
    return {
      ...data,
      result: data.result.map((item) => RegionSanitized.from(item)),
    };
  }
  @Get('all')
  @ApiOperation({ summary: 'Get all regions' })
  @ApiResponse({
    status: 200,
    description: 'Regions retrieved successfully',
    type: [RegionSanitized],
  })
  async findAll(@Query() search: UpdateRegionDto): Promise<RegionSanitized[]> {
    const regions = await this.regionService.findMany(search);
    return regions.map((item) => RegionSanitized.from(item));
  }

  @Get('/country/:id')
  @ApiOperation({ summary: 'Get a region by id' })
  @ApiResponse({
    status: 200,
    description: 'Regions retrieved successfully',
    type: [RegionSanitized],
  })
  async findCountryRegions(
    @Param('id') id: string,
  ): Promise<RegionSanitized[]> {
    const country_id = id;
    const regions = await this.regionService.findMany({ country_id });
    return regions.map((item) => RegionSanitized.from(item));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a region by id' })
  @ApiResponse({ status: 200, description: 'Region retrieved successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findOne(@Param('id') id: string) {
    return this.regionService.findOne({ id });
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe())
  @ApiOperation({ summary: 'Update a region' })
  @ApiResponse({ status: 200, description: 'Region updated successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(
    @Param('id') id: string,
    @Body() updateRegionDto: UpdateRegionDto,
    @Request() request,
  ) {
    return this.regionService.update(id, {
      ...updateRegionDto,
      updated_by: request.user.id,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a region' })
  @ApiResponse({ status: 200, description: 'Region deleted successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async delete(@Param('id') id: string) {
    return this.regionService.delete(id);
  }
}
