import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

export class AttemptsDto {
  @ApiProperty()
  @IsUUID()
  micro_task_id: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'text_data_set must contain non-whitespace text' })
  text_data_set: string;
}
export class CreateMultipleDataSetDto {
  @ApiProperty({ type: [AttemptsDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AttemptsDto)
  attempts: AttemptsDto[];
  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  is_test: boolean = false;
}
