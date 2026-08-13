import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Length,
  IsDateString,
} from 'class-validator';
import { LedgerDirection } from '../../../common/enums';

/**
 * DTO for a MANUAL ledger entry. Non-manual entries are created internally by
 * the invoice/expense/purchase hooks and never through this DTO.
 */
export class CreateLedgerEntryDto {
  @IsDateString()
  entryDate: string;

  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  clientId?: string | null;

  @IsEnum(LedgerDirection)
  direction: LedgerDirection;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string | null;
}
