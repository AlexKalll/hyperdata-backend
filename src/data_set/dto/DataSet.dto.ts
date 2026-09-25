import { createZodDto } from 'nestjs-zod';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { DataSetStatus } from 'src/utils/constants/DataSetStatus.constant';
import { z } from 'zod';
// get-dataset.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class GetDataSetDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by code', example: 'DS-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Filter by text_data_set content' })
  @IsOptional()
  @IsString()
  text_data_set?: string;

  @ApiPropertyOptional({
    description: 'Filter by dataset status',
    enum: DataSetStatus,
  })
  @IsOptional()
  @IsEnum(DataSetStatus)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by flagged status (true/false)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  is_flagged?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by contributor payment status (true/false)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  is_paid_for_contributor?: boolean;

  @ApiPropertyOptional({ description: 'Filter by rejection reason ID' })
  @IsOptional()
  @IsString()
  rejection_reason_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by reviewer payment status (true/false)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  is_paid_for_reviewer?: boolean;

  @ApiPropertyOptional({ description: 'Filter by test flag (true/false)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  is_test?: boolean;
}

export const createDataSetSchema = z.object({
  micro_task_id: z.string().uuid(),
  text_data_set: z.string(),
});
export const createMultipleDataSetSchema = z.array(
  z.object({
    micro_task_id: z.string().uuid(),
    text_data_set: z.string(),
  }),
);
export const findContributorDatasetsPaginated = z.object({
  contributor_id: z.string().uuid(),
  page: z.number().optional(),
  limit: z.number().optional(),
});
export class FindReviewerDataSetDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: [
      DataSetStatus.PENDING,
      DataSetStatus.APPROVED,
      DataSetStatus.REJECTED,
      DataSetStatus.Flagged,
    ],
    required: false,
  })
  @IsEnum([
    DataSetStatus.PENDING,
    DataSetStatus.APPROVED,
    DataSetStatus.REJECTED,
    DataSetStatus.Flagged,
  ])
  @IsOptional()
  status?: 'Pending' | 'Approved' | 'Rejected' | 'Flagged';
}
export const updateDataSetSchema = createDataSetSchema.partial();
export class FindContributorDatesetDto extends createZodDto(
  findContributorDatasetsPaginated,
) {}
export class CreateDataSetDto extends createZodDto(createDataSetSchema) {}
export class UpdateDataSetDto extends createZodDto(updateDataSetSchema) {}
export class CreateMultipleDataSetDto extends createZodDto(
  createMultipleDataSetSchema,
) {}

export class ApproveDataSetDto {
  @ApiPropertyOptional({ description: 'Filter by annotation' })
  @IsString()
  @IsOptional()
  annotation?: string;
}

export class TaskSubmissionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by annotation' })
  @IsUUID()
  @IsOptional()
  contributor_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by dataset status',
    enum: DataSetStatus,
  })
  @IsOptional()
  @IsEnum(DataSetStatus)
  status?: string;
}
