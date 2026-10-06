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
import { FlagTypeService } from '../service/FlagType.service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import {
  CreateRejectionTypeDto,
  UpdateRejectionTypeDto,
} from '../dto/RejectionType.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { FlagTypeSanitized } from '../sanitize';
import { PaginatedResult } from 'src/utils/paginate.util';
@Controller('/setting/flag-type')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('Flag Type')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class FlagTypeController {
  constructor(private readonly flagTypeService: FlagTypeService) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  async create(
    @Body() rejectionTypeData: CreateRejectionTypeDto,
    @Request() req,
  ) {
    return this.flagTypeService.create({
      ...rejectionTypeData,
      created_by: req.user.id,
    });
  }
  @Get('paginate')
  // @UsePipes(PaginationDto) // Correctly applying ZodValidationPipe
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Paginate Countries' })
  @ApiExtraModels(PaginatedResult, FlagTypeSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(FlagTypeSanitized) },
            },
          },
        },
      ],
    },
  })
  async findPaginate(@Query() paginationDto: PaginationDto) {
    const data = await this.flagTypeService.findPaginate(paginationDto);
    return {
      ...data,
      result: data.result.map((item) => FlagTypeSanitized.from(item)),
    };
  }

  @Get()
  @UsePipes(new ZodValidationPipe())
  async findAll(@Query() query: UpdateRejectionTypeDto) {
    const data = await this.flagTypeService.findAll(query);
    return data.map((item) => FlagTypeSanitized.from(item));
  }

  @Get(':id')
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string) {
    const data = await this.flagTypeService.findOne({ id });
    if (!data) {
      throw new NotFoundException(`FlagType #${id} not found`);
    }
    return FlagTypeSanitized.from(data);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() rejectionTypeData: UpdateRejectionTypeDto,
    @Request() request,
  ) {
    return this.flagTypeService.update(id, {
      ...rejectionTypeData,
      updated_by: request.user.id,
    });
  }

  @Delete(':id')
  @UsePipes(new ZodValidationPipe())
  async delete(@Param('id') id: string) {
    return this.flagTypeService.remove(id);
  }
}
