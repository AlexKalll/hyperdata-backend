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
  Request,
  UseGuards,
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
import { DialectService } from '../service/Dialect.service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import { CreateDialectDto, UpdateDialectDto } from '../dto/Dialect.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { DialectSanitized } from '../sanitize';
import { PaginatedResult } from 'src/utils/paginate.util';
@Controller('/setting/dialect')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('Dialects')
export class DialectController {
  constructor(private readonly dialectService: DialectService) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  @ApiOperation({ summary: 'Create a dialect' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() dialectData: CreateDialectDto, @Request() req) {
    return this.dialectService.create({
      ...dialectData,
      created_by: req.user.id,
    });
  }
  @Get('')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Paginate Dialects' })
  @ApiExtraModels(PaginatedResult, DialectSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(DialectSanitized) },
            },
          },
        },
      ],
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findPaginate(@Query() paginationDto: PaginationDto) {
    const data = await this.dialectService.findPaginate(
      { relations: { language: true } },
      paginationDto,
    );
    return {
      ...data,
      result: data.result.map((item) => DialectSanitized.from(item)),
    };
  }
  @Get('all')
  @ApiQuery({
    name: 'search',
    required: false,
    schema: { $ref: getSchemaPath(UpdateDialectDto) },
  })
  @ApiOperation({ summary: 'Get All dialects' })
  async findAll(@Query() query: UpdateDialectDto) {
    return this.dialectService.findMany(query);
  }
  @Get('language/:language_id')
  @ApiOperation({ summary: 'Get a dialect by ID' })
  async findAllByLanguage(@Param('language_id') language_id: string) {
    return this.dialectService.findMany({ language_id });
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a dialect by ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findOne(@Param('id') id: string) {
    return this.dialectService.findOne({ id });
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe())
  @ApiOperation({ summary: 'Update a dialect' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(
    @Param('id') id: string,
    @Body() dialectData: UpdateDialectDto,
    @Request() request,
  ) {
    return this.dialectService.update(id, {
      ...dialectData,
      updated_by: request.user.id,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dialect' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async delete(@Param('id') id: string) {
    return this.dialectService.delete(id);
  }
}
