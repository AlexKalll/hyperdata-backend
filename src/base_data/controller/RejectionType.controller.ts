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
  ApiQuery,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { RejectionTypeService } from '../service/RejectionType.service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import {
  CreateRejectionTypeDto,
  UpdateRejectionTypeDto,
} from '../dto/RejectionType.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { PaginatedResult } from 'src/utils/paginate.util';
import { RejectionTypeSanitized } from '../sanitize';
@Controller('/setting/rejection-type')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('Rejection Type')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RejectionTypeController {
  constructor(private readonly rejectionTypeService: RejectionTypeService) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  async create(
    @Body() rejectionTypeData: CreateRejectionTypeDto,
    @Request() req,
  ) {
    return this.rejectionTypeService.create({
      ...rejectionTypeData,
      created_by: req.user.id,
    });
  }
  @Get('paginate')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Paginate Countries' })
  @ApiExtraModels(PaginatedResult, RejectionTypeSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(RejectionTypeSanitized) },
            },
          },
        },
      ],
    },
  })
  async findPaginate(@Query() paginationDto: PaginationDto) {
    const data = await this.rejectionTypeService.findPaginate(paginationDto);
    return {
      ...data,
      result: data.result.map((item) => RejectionTypeSanitized.from(item)),
    };
  }

  @Get()
  @ApiResponse({
    type: [RejectionTypeSanitized],
  })
  @UsePipes(new ZodValidationPipe())
  async findAll(@Query() query: UpdateRejectionTypeDto) {
    const data = await this.rejectionTypeService.findAll(query);
    return data.map((item) => RejectionTypeSanitized.from(item));
  }

  @Get(':id')
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string) {
    return this.rejectionTypeService.findOne({ id });
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() rejectionTypeData: UpdateRejectionTypeDto,
    @Request() request,
  ) {
    return this.rejectionTypeService.update(id, {
      ...rejectionTypeData,
      updated_by: request.user.id,
    });
  }

  @Delete(':id')
  @UsePipes(new ZodValidationPipe())
  async delete(@Param('id') id: string) {
    return this.rejectionTypeService.remove(id);
  }
}
