import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseType } from '../../../common/enums';

export class CreateExpenseDto {
  @ApiProperty({ enum: ExpenseType, description: 'INCOME or EXPENSE' })
  @IsEnum(ExpenseType)
  type: ExpenseType;

  @ApiProperty({ example: 'Software', description: 'Category label (2–100 chars)' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  category: string;

  @ApiProperty({ example: 250.0, description: 'Amount (must be > 0)' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Monthly AWS bill' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;
}
