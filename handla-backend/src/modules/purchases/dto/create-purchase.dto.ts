import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
  Length,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseLineItemDto } from './purchase-line-item.dto';
import { PurchaseStatus } from '../../../common/enums';

export class CreatePurchaseDto {
  @IsString()
  supplierId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineItemDto)
  lineItems: PurchaseLineItemDto[];

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
  @IsString()
  @Length(0, 20)
  accountCode?: string | null;

  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @IsOptional()
  @IsDateString()
  orderDate?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
