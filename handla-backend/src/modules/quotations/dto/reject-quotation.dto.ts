import { IsOptional, IsString, Length } from 'class-validator';

export class RejectQuotationDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
