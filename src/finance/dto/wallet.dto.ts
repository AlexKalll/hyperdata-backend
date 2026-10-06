import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, Matches, Max, Min } from 'class-validator';
import { PaginationDto } from 'src/common/dto/Pagination.dto';

export class WithdrawMoneyDto {
  @ApiProperty({
    description: 'Payment Method',
    enum: ['Telebirr', 'CBE Birr'],
  })
  @IsEnum(['Telebirr', 'CBE Birr'])
  paymentMethod: 'Telebirr' | 'CBE Birr';

  @ApiProperty({ description: 'Phone Number' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phoneNumber: string;

  @ApiProperty({ description: 'Amount to withdraw' })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  amount: number;
}
export class GetTransactionDto extends PaginationDto {
  @ApiProperty({
    description: 'Transaction type',
    enum: ['Credit', 'Withdraw'],
  })
  @IsEnum(['Credit', 'Withdraw'])
  type: 'Credit' | 'Withdraw';
}

export class ScoreValueDto {
  @ApiProperty({ description: 'Score Value' })
  @IsNumber()
  scoreValue: number;
}
