import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
  IsNumberString,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_-]*$/, {
    message: 'code must be lowercase alphanumeric (dash/underscore allowed)',
  })
  code: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  priceMonthly?: string;

  @IsOptional()
  @IsNumberString()
  priceYearly?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  entitlements?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  priceMonthly?: string;

  @IsOptional()
  @IsNumberString()
  priceYearly?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  entitlements?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
