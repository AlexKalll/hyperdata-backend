import { IsBoolean } from 'class-validator';
import { PaginationDto } from 'src/common/dto/Pagination.dto';

import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDate,
  IsNumber,
  Length,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  first_name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MinLength(3)
  middle_name: string;

  @ApiProperty({ required: false })
  @IsString()
  @MinLength(9)
  phone_number: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  last_name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ type: String, example: '2000-01-01' })
  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  @IsDate({ message: 'Invalid date format' })
  birth_date: Date;

  @ApiProperty({ enum: ['Male', 'Female'] })
  @IsEnum(['Male', 'Female'])
  gender: 'Male' | 'Female';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woreda?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dialect_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  language_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  region_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zone_id?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  role_id: string;
}

export class FirstContributorUpdateDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  first_name: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  middle_name: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  last_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  // change to null if email is not provided or empty
  @Transform(({ value }) => (value === '' ? null : value))
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ type: String, example: '2000-01-01' })
  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  // verify birth date and age is greater than 18
  @IsDate({ message: 'Invalid date format' })
  birth_date: Date;

  @ApiProperty({ enum: ['Male', 'Female'] })
  @IsEnum(['Male', 'Female'])
  gender: 'Male' | 'Female';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woreda?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dialect_id?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  language_id: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  region_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zone_id?: string;
}
export class UpdateProfileDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(3)
  first_name?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(3)
  middle_name?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(3)
  last_name?: string;

  @ApiPropertyOptional({ format: 'email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(9)
  phone_number?: string;

  @ApiProperty({ type: String, example: '2000-01-01' })
  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @Type(() => Date)
  @IsDate({ message: 'Invalid date format' })
  birth_date?: Date;

  @ApiProperty({ enum: ['Male', 'Female'] })
  @IsOptional()
  @IsEnum(['Male', 'Female'])
  gender: 'Male' | 'Female';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woreda?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dialect_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  language_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  region_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zone_id?: string;
}
export class UpdateUserDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(3)
  first_name?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(3)
  middle_name?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(3)
  last_name?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MinLength(9)
  phone_number?: string;

  @ApiProperty({ enum: ['Male', 'Female'] })
  @IsOptional()
  @IsEnum(['Male', 'Female'])
  gender: 'Male' | 'Female';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  woreda?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dialect_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  language_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  region_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zone_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  role_id?: string;
}

export class SignUpDto {
  @ApiProperty()
  @IsString()
  @MinLength(9)
  phone_number: string;
}
export class VerifyAccountDto {
  @ApiProperty({ minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty()
  @IsString()
  @MinLength(9)
  phone: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  current_password: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  new_password: string;
}

export class UserSearchWithPaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  role_id?: string;
}

export class UserSearchWithSpecificRoleDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class GetUsersFilterDto extends PaginationDto {
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

  @ApiPropertyOptional({ description: 'Filter by active status' })
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

  @ApiPropertyOptional({ description: 'Filter by Role' })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({ description: 'Filter by Language' })
  @IsOptional()
  @IsUUID()
  language_id?: string;

  @ApiPropertyOptional({ description: 'Filter by Dialect' })
  @IsOptional()
  @IsUUID()
  dialect_id?: string;

  @ApiPropertyOptional({ description: 'Filter by Created Date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  created_start_date?: Date;

  @ApiPropertyOptional({ description: 'Filter by Created Date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  created_end_date?: Date;
}
export class GetContributorFilterDto extends PaginationDto {
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

  @ApiPropertyOptional({ description: 'Filter by active status' })
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

  @ApiPropertyOptional({ description: 'Filter by Role' })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({ description: 'Filter by Role' })
  @IsOptional()
  @IsUUID()
  language_id?: string;

  @ApiPropertyOptional({ description: 'Filter by Role' })
  @IsOptional()
  @IsUUID()
  dialect_id?: string;
}
