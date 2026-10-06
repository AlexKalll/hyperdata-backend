import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTaskPaymentDto {
  @IsString()
  @IsNotEmpty()
  task_id: string;

  @IsNumber()
  @Min(0)
  contributor_credit_per_microtask: number;

  @IsNumber()
  @Min(0)
  reviewer_credit_per_microtask: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  created_by?: string;
}
