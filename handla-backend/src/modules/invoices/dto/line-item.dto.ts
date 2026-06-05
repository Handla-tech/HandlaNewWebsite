import {
  IsString,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for a single invoice line item.
 * Used inside CreateInvoiceDto.lineItems (ValidateNested).
 */
export class LineItemDto {
  @ApiProperty({ example: 'Web development — 20 hours', maxLength: 500 })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: 20, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty({ example: 150, minimum: 0 })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}
