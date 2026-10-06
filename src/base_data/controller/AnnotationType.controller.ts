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
import {
  CreateRejectionTypeDto,
  UpdateRejectionTypeDto,
} from '../dto/RejectionType.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { AnnotationTypeService } from '../service/AnnotationType.service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import { AnnotationTypeSanitized } from '../sanitize';
import { PaginatedResult } from 'src/utils/paginate.util';
@Controller('/setting/annotation-type')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('DataSet Annotation Type')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnotationTypeController {
  constructor(private readonly annotationTypeService: AnnotationTypeService) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  async create(
    @Body() dataAnnotationDto: CreateRejectionTypeDto,
    @Request() req,
  ) {
    return this.annotationTypeService.create({
      ...dataAnnotationDto,
      created_by: req.user.id,
    });
  }
  @Get('paginate')
  // @UsePipes(PaginationDto) // Correctly applying ZodValidationPipe
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Paginate Countries' })
  @ApiExtraModels(PaginatedResult, AnnotationTypeSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(AnnotationTypeSanitized) },
            },
          },
        },
      ],
    },
  })
  async findPaginate(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResult<AnnotationTypeSanitized>> {
    const data = await this.annotationTypeService.findPaginate(paginationDto);
    return {
      ...data,
      result: data.result.map((item) => AnnotationTypeSanitized.from(item)),
    };
  }

  @Get()
  @UsePipes(new ZodValidationPipe())
  async findAll(@Query() query: UpdateRejectionTypeDto) {
    const data = await this.annotationTypeService.findAll(query);
    return data.map((item) => AnnotationTypeSanitized.from(item));
  }

  @Get(':id')
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string) {
    const data = await this.annotationTypeService.findOne({ id });
    if (!data) {
      throw new NotFoundException(`AnnotationType #${id} not found`);
    }
    return AnnotationTypeSanitized.from(data);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() rejectionTypeData: UpdateRejectionTypeDto,
    @Request() request,
  ) {
    return this.annotationTypeService.update(id, {
      ...rejectionTypeData,
      updated_by: request.user.id,
    });
  }

  @Delete(':id')
  @UsePipes(new ZodValidationPipe())
  async delete(@Param('id') id: string) {
    return this.annotationTypeService.remove(id);
  }
}
