import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuotationLineItemDto } from './quotation-line-item.dto';

export class CreateQuotationDto {
  @IsString()
  @Length(2, 255)
  title: string;

  @IsUUID()
  clientId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotationLineItemDto)
  lineItems: QuotationLineItemDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string | null;

  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
