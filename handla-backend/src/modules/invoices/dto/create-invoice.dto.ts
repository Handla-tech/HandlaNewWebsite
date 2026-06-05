import {
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineItemDto } from './line-item.dto';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Client UUID this invoice is for' })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    type: [LineItemDto],
    description: 'At least one line item required',
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems: LineItemDto[];

  @ApiPropertyOptional({ example: 15, description: 'Tax rate percentage (0–100)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Payment via bank transfer preferred.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
