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
  ApiQuery,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { CountryService } from '../service/Country.service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import {
  CreateCountryDto,
  SearchCountryDto,
  UpdateCountryDto,
} from '../dto/Country.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { CountrySanitized } from '../sanitize';
import { PaginatedResult } from 'src/utils/paginate.util';

@ApiTags('Country')
@ApiExtraModels(SearchCountryDto, PaginationDto)
@Controller('/setting/country')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateCountryDto))
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() body: CreateCountryDto, @Request() req) {
    return await this.countryService.create({
      ...body,
      created_by: req.user.id,
    });
  }

  @Get('all')
  @UsePipes(new ZodValidationPipe(SearchCountryDto)) // Correctly applying ZodValidationPipe
  @ApiQuery({
    name: 'search',
    required: false,
    schema: { $ref: getSchemaPath(SearchCountryDto) },
  })
  @ApiOperation({ summary: 'Get all Countries' })
  async findAll(
    @Query() search: SearchCountryDto,
  ): Promise<CountrySanitized[]> {
    const countries = await this.countryService.findMany(search);
    return countries.map((item) => CountrySanitized.from(item));
  }

  @Get('')
  @ApiBearerAuth()
  @ApiExtraModels(PaginatedResult, CountrySanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(CountrySanitized) },
            },
          },
        },
      ],
    },
  })
  @ApiOperation({ summary: 'Paginate Countries' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findPaginate(@Query() paginationDto: PaginationDto) {
    return await this.countryService.findPaginate(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a Country by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findOne(@Param('id') id: string) {
    const country = await this.countryService.findOne({ id });
    if (!country) {
      throw new NotFoundException(`Country #${id} not found`);
    }
    return country;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a Country by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe()) updateCountryDto: UpdateCountryDto,
    @Request() req,
  ) {
    return await this.countryService.update(id, {
      ...updateCountryDto,
      updated_by: req.user.id,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Country by id' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    return await this.countryService.delete(id);
  }
}
