// get-micro-tasks.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsIn,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { Transform } from 'class-transformer';

export class GetMicroTasksDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Filter by text' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Filter by type' })
  @IsOptional()
  @IsIn(['text', 'audio', 'image'])
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by whether it is a test task' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  @IsBoolean()
  is_test?: boolean;

  @ApiPropertyOptional({ description: 'Filter by target dataset match flag' })
  @IsOptional()
  @IsNumber()
  has_meet_target_dataset?: number;
}
export class CreateMicroTaskDto {
  @ApiPropertyOptional({
    description: 'Indicates if the micro task is a test task',
  })
  @IsOptional()
  @IsBoolean()
  is_test?: boolean;

  @ApiPropertyOptional({ description: 'The text content of the micro task' })
  @IsOptional()
  @IsString()
  text?: string;
  @ApiPropertyOptional({ description: 'Instructions for the micro task' })
  @IsOptional()
  @IsString()
  instruction?: string;

  @ApiPropertyOptional({ description: 'The ID of the associated task' })
  @IsString()
  task_id: string;
}
export class ImportMicroTaskFromOtherTaskDto {
  @ApiPropertyOptional({
    description: 'The ID of the source task to import from',
  })
  @IsUUID()
  source_task_id: string;

  @ApiPropertyOptional({
    description: 'The limit on the number of micro tasks to import',
  })
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Flag indicating import from micro task',
  })
  @IsBoolean()
  from_micro_task: boolean;

  @ApiPropertyOptional({ description: 'Flag indicating import from data set' })
  @IsBoolean()
  from_data_set: boolean;
}

// export class UpdateMicroTaskDto extends createZodDto(updateMicroTaskSchema) {}
export class UpdateMicroTaskDto {
  @ApiPropertyOptional({ description: 'The text content of the micro task' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Instructions for the micro task' })
  @IsOptional()
  @IsString()
  instruction?: string;
}
