import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, ValidateIf } from 'class-validator';
import { createZodDto } from 'nestjs-zod';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { z } from 'zod';
export class CreateFlagTypeDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Flag type name',
    example: 'In appropriate words',
  })
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Flag description' })
  @IsString()
  description?: string;
}
export const createRejectionTypeSchema = z.object({
  name: z.string().regex(/\S/, 'name must contain non-whitespace text'),
  description: z.string().optional(),
});

export class CreateRejectionTypeDto extends createZodDto(
  createRejectionTypeSchema,
) {
  @IsString()
  @Matches(/\S/, { message: 'name must contain non-whitespace text' })
  name: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  description?: string;
}
export class UpdateRejectionTypeDto extends createZodDto(
  createRejectionTypeSchema.partial(),
) {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/, { message: 'name must contain non-whitespace text' })
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  description?: string;
}
