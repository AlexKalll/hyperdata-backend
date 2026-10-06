import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Length,
  ValidateIf,
  IsObject,
  IsUrl,
  Min,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { Transform, Type } from 'class-transformer';

export class GetTaskDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by name (partial match)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter by public visibility (true/false)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  is_public?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by contributor test requirement (true/false)',
  })
  @IsOptional()
  @IsBoolean()
  require_contributor_test?: boolean;

  @ApiPropertyOptional({ description: 'Filter by closed status (true/false)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  is_closed?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by archived status (true/false)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  is_archived?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by distribution started flag (true/false)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  distribution_started?: boolean;

  @ApiPropertyOptional({ description: 'Search term (name or description)' })
  @IsOptional()
  @IsUUID()
  task_type_id: string;
}
class IdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;
}

class LocationDto {
  @ApiProperty()
  @IsString()
  name: string;
}

class AgeDto {
  @ApiProperty()
  @IsNumber()
  min: number;

  @ApiProperty()
  @IsNumber()
  max: number;
}

class GenderDto {
  @ApiProperty()
  @IsNumber()
  male: number;

  @ApiProperty()
  @IsNumber()
  female: number;
}
export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @Length(1)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUUID()
  project_id: string;

  @ApiProperty()
  @IsUUID()
  task_type_id: string;

  @ApiProperty()
  @IsUUID()
  language_id: string;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  is_public: boolean = true;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  require_contributor_test: boolean = false;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  max_contributor_per_micro_task: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_contributor_per_facilitator?: number;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_dataset_per_reviewer: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  max_micro_task_per_contributor: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minimum_seconds?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maximum_seconds?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  batch?: number;

  @ApiProperty()
  @IsNumber()
  appriximate_time_per_batch: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  reviewer_payment_per_microtask: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  contributor_payment_per_microtask: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(1)
  contributor_completion_time_limit?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(1)
  max_expected_no_of_contributors?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(1)
  reviewer_completion_time_limit?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  minimum_characters_length?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maximum_characters_length?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  max_retry_per_task: number = 0;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_dialect_specific: boolean = false;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.is_dialect_specific)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dialects?: string[] = [];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_age_specific: boolean = false;

  @ApiProperty({ required: false, type: AgeDto })
  @ValidateIf((o) => o.is_age_specific)
  @IsObject()
  @ValidateNested()
  age?: AgeDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  is_sector_specific: boolean = false;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.is_sector_specific)
  @IsArray()
  @IsString({ each: true })
  sectors?: string[] = [];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_gender_specific: boolean = false;

  @ApiProperty({ required: false, type: GenderDto })
  @ValidateIf((o) => o.is_gender_specific)
  @ValidateNested()
  @Type(() => GenderDto)
  gender?: GenderDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_location_specific: boolean = false;

  @ApiProperty({ required: false, type: LocationDto, isArray: true })
  @IsOptional()
  @ValidateIf((o) => o.is_location_specific)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationDto)
  locations?: LocationDto[] = [];
}

export class UpdateTaskDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  require_contributor_test?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  task_type_id?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  language_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Min(1)
  contributor_completion_time_limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Min(1)
  reviewer_completion_time_limit?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(1)
  max_expected_no_of_contributors?: number;
}

export class UpdateTaskRequirementDto {
  // minimum and maximum seconds
  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minimum_seconds?: number;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maximum_seconds?: number;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_contributor_per_micro_task?: number;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_retry_per_task?: number;

  @ApiPropertyOptional({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  is_dialect_specific: boolean = false;

  @ApiPropertyOptional({ type: [IdDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdDto)
  dialects?: IdDto[];

  @ApiPropertyOptional({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  is_age_specific?: boolean = false;

  @ApiPropertyOptional({ type: AgeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgeDto)
  age?: AgeDto;

  @ApiPropertyOptional({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  is_sector_specific?: boolean = false;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  sectors?: string[];

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsBoolean()
  is_gender_specific?: boolean = false;

  @ApiPropertyOptional({ type: GenderDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => GenderDto)
  gender?: GenderDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_location_specific: boolean = false;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  locations?: LocationDto[];

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  batch?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  minimum_characters_length?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maximum_characters_length?: number;
}
export class UpdateTaskInstructionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  image_instruction_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  video_instruction_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  audio_instruction_url?: string;
}
export class FindTaskMembersDto extends PaginationDto {
  @ApiProperty({
    enum: ['Contributor', 'Reviewer', 'Facilitator'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['Contributor', 'Reviewer', 'Facilitator'])
  role?: 'Contributor' | 'Reviewer' | 'Facilitator';

  @ApiProperty({
    enum: ['Active', 'InActive', 'Flagged', 'Rejected', 'Pending'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['Active', 'InActive', 'Flagged', 'Rejected', 'Pending'])
  status?: 'Active' | 'InActive' | 'Flagged' | 'Rejected' | 'Pending';
}

export class FindFacilitatorContributorsDto extends PaginationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  facilitator_id: string;
}
export class GetTaskMembersFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by first name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Filter by middle name' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ description: 'Filter by last name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Filter by email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Filter by phone number' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({ description: 'Filter by gender (e.g., Male, Female)' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    type: 'boolean',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return Boolean(value); // fallback
  })
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Filter by birth date (YYYY-MM-DD)' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'User Status on The Task',
    enum: ['Active', 'InActive', 'Flagged'],
  })
  @IsOptional()
  @IsEnum(['Active', 'InActive', 'Flagged'])
  status?: 'Active' | 'InActive' | 'Flagged';

  @ApiPropertyOptional({
    description: 'User Role on The Task',
    enum: ['Contributor', 'Reviewer', 'Facilitator'],
  })
  @IsOptional()
  @IsEnum(['Contributor', 'Reviewer', 'Facilitator'])
  role?: 'Contributor' | 'Reviewer' | 'Facilitator';
}
export class GetTaskAnAssignedMembersDto extends PaginationDto {
  @ApiProperty({
    enum: ['Contributor', 'Reviewer', 'Facilitator'],
    required: false,
  })
  @IsEnum(['Contributor', 'Reviewer', 'Facilitator'])
  role: 'Contributor' | 'Reviewer' | 'Facilitator';

  @ApiPropertyOptional({ description: 'Filter by first name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Filter by middle name' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ description: 'Filter by last name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Filter by email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Filter by phone number' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Search user by his name , email or phone',
  })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: ['Male', 'Female'],
    description: 'Filter by gender (e.g., Male, Female)',
  })
  @IsOptional()
  @IsEnum(['Male', 'Female'])
  gender?: 'Male' | 'Female';
}

export class UpdateTaskPaymentDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  contributor_credit_per_microtask: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  reviewer_credit_per_microtask: number;
}

export class ImportContributorFromOtherTaskDto {
  @ApiProperty({
    required: false,
    enum: ['Active', 'InActive', 'Flagged', 'Rejected', 'Pending', 'All'],
  })
  @IsOptional()
  @IsEnum(['Active', 'InActive', 'Flagged', 'Rejected', 'Pending'])
  status?: 'Active' | 'InActive' | 'Flagged' | 'Rejected' | 'Pending' | 'All';

  @ApiProperty({})
  @IsNumber()
  limit: number;

  @ApiProperty({ required: false })
  @IsOptional()
  minNumberOfAcceptedDataSets?: number;

  @ApiProperty({})
  @IsUUID()
  sourceTaskId: string;

  @ApiProperty({ enum: ['Pending', 'Approved', 'Rejected', 'Flagged', 'All'] })
  @IsOptional()
  @IsEnum(['Pending', 'Approved', 'Rejected', 'Flagged', 'All'])
  datasetStatus: 'Pending' | 'Approved' | 'Rejected' | 'Flagged' | 'All';
}
export class ExportContributorsOfATaskDto {
  @ApiProperty({
    required: false,
    enum: ['Active', 'InActive', 'Flagged', 'Rejected', 'Pending'],
  })
  @IsOptional()
  @IsEnum(['Active', 'InActive', 'Flagged', 'Rejected', 'Pending'])
  status?: 'Active' | 'InActive' | 'Flagged' | 'Rejected' | 'Pending';

  @ApiProperty({})
  @IsNumber()
  limit: number;

  @ApiProperty({ required: false })
  @IsOptional()
  minNumberOfAcceptedDataSets?: number;

  @ApiProperty({ enum: ['Pending', 'Approved', 'Rejected', 'Flagged', 'All'] })
  @IsOptional()
  @IsEnum(['Pending', 'Approved', 'Rejected', 'Flagged', 'All'])
  datasetStatus: 'Pending' | 'Approved' | 'Rejected' | 'Flagged' | 'All';
}
