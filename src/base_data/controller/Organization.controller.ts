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
import { OrganizationService } from '../service';
import { ReferenceDataAdminGuard } from '../guard/ReferenceDataAdmin.guard';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '../dto/Organization.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { OrganizationSanitized } from '../sanitize';
import { PaginatedResult } from 'src/utils/paginate.util';
@Controller('/setting/organization')
@UseGuards(JwtAuthGuard, RolesGuard, ReferenceDataAdminGuard)
@ApiTags('Organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @UsePipes(new ZodValidationPipe())
  async create(
    @Body() organizationData: CreateOrganizationDto,
    @Request() req,
  ) {
    return this.organizationService.create({ ...organizationData });
  }
  @Get('')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiBearerAuth()
  @ApiExtraModels(PaginatedResult, OrganizationSanitized)
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResult) },
        {
          properties: {
            result: {
              type: 'array',
              items: { $ref: getSchemaPath(OrganizationSanitized) },
            },
          },
        },
      ],
    },
  })
  @ApiOperation({ summary: 'Paginate Organizations' })
  async findPaginate(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResult<OrganizationSanitized>> {
    const data = await this.organizationService.findPaginate(paginationDto);
    return {
      ...data,
      result: data.result.map((item) => OrganizationSanitized.from(item)),
    };
  }

  @Get('all')
  @UsePipes(new ZodValidationPipe())
  async findAll(@Query() query: UpdateOrganizationDto) {
    return this.organizationService.findMany(query);
  }

  @Get(':id')
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string) {
    return this.organizationService.findOne({ id });
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() organizationData: UpdateOrganizationDto,
    @Request() request,
  ) {
    return this.organizationService.update(id, { ...organizationData });
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.organizationService.delete(id);
  }
}
