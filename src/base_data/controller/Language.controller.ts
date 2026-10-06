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
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { LanguageService } from '../service/Language.service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import { CreateLanguageDto, UpdateLanguageDto } from '../dto/Language.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { LanguageSanitized } from '../sanitize';
import { PaginatedResult } from 'src/utils/paginate.util';
@Controller('/setting/language')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('Language')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() languageData: CreateLanguageDto, @Request() req) {
    return this.languageService.create({
      ...languageData,
      created_by: req.user.id,
    });
  }
  @Get('')
  @ApiBearerAuth()
  @ApiExtraModels(PaginatedResult, LanguageSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(LanguageSanitized) },
            },
          },
        },
      ],
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findPaginate(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResult<LanguageSanitized>> {
    const data = await this.languageService.findPaginate(paginationDto);
    return {
      ...data,
      result: data.result.map((item) => LanguageSanitized.from(item)),
    };
  }

  @Get('all')
  async findAll(@Query() query: UpdateLanguageDto) {
    const data = await this.languageService.findMany(query);
    return data.map((item) => LanguageSanitized.from(item));
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: LanguageSanitized })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findOne(@Param('id') id: string) {
    const language = await this.languageService.findOne({ id });
    if (!language) {
      throw new NotFoundException(`Language #${id} not found`);
    }
    return LanguageSanitized.from(language);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(
    @Param('id') id: string,
    @Body() languageData: UpdateLanguageDto,
    @Request() request,
  ) {
    return this.languageService.update(id, {
      ...languageData,
      updated_by: request.user.id,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async delete(@Param('id') id: string) {
    return this.languageService.delete(id);
  }
}
