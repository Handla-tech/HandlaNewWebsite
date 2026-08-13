import { IsOptional, IsDateString } from 'class-validator';

export class MarkPurchasePaidDto {
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
