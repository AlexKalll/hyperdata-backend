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
import { UpdateRejectionTypeDto } from '../dto/RejectionType.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { DataSetAnnotationService } from '../service/DataSetAnnotation.service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import { CreateAnnotationDto } from '../dto/Annotation.dto';
import {
  AnnotationTypeSanitized,
  DataSetAnnotationSanitized,
} from '../sanitize';
import { PaginatedResult } from 'src/utils/paginate.util';
@Controller('/setting/annotation')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('DataSet Annotation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataSetAnnotationController {
  constructor(
    private readonly dataSetAnnotationService: DataSetAnnotationService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  async create(@Body() dataAnnotationDto: CreateAnnotationDto, @Request() req) {
    return this.dataSetAnnotationService.create({
      ...dataAnnotationDto,
      created_by: req.user.id,
    });
  }
  @Get('paginate')
  // @UsePipes(PaginationDto) // Correctly applying ZodValidationPipe
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Paginate Countries' })
  @ApiExtraModels(PaginatedResult, DataSetAnnotationSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(DataSetAnnotationSanitized) },
            },
          },
        },
      ],
    },
  })
  async findPaginate(@Query() paginationDto: PaginationDto) {
    const data = await this.dataSetAnnotationService.findPaginate(
      {
        where: {},
        relations: { annotationType: true },
      },
      paginationDto,
    );
    return {
      ...data,
      result: data.result.map((item) => ({
        ...DataSetAnnotationSanitized.from(item),
        annotationType:
          item.annotationType &&
          AnnotationTypeSanitized.from(item.annotationType),
      })),
    };
  }

  @Get()
  @UsePipes(new ZodValidationPipe())
  async findAll(@Query() query: UpdateRejectionTypeDto) {
    return this.dataSetAnnotationService.findAll(query);
  }

  @Get(':id')
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string) {
    const data = await this.dataSetAnnotationService.findOne({ id });
    if (!data) {
      throw new NotFoundException(`DataSetAnnotation #${id} not found`);
    }
    return DataSetAnnotationSanitized.from(data);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() rejectionTypeData: UpdateRejectionTypeDto,
    @Request() request,
  ) {
    return this.dataSetAnnotationService.update(id, {
      ...rejectionTypeData,
      updated_by: request.user.id,
    });
  }

  @Delete(':id')
  @UsePipes(new ZodValidationPipe())
  async delete(@Param('id') id: string) {
    return this.dataSetAnnotationService.remove(id);
  }
}
