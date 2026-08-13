import { IsString, IsNumber, Min, Length } from 'class-validator';

export class PurchaseLineItemDto {
  @IsString()
  @Length(1, 500)
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;
}
