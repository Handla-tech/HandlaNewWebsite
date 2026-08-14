import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';

export class CreateProductDto {
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
  @IsString()
  @MaxLength(255)
  subdomainZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  provisioner?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(512)
  provisioningBaseUrl?: string;

  /** Plaintext outbound key; stored only as a SHA-256 hash for display. */
  @IsOptional()
  @IsString()
  provisioningKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subdomainZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  provisioner?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(512)
  provisioningBaseUrl?: string;

  @IsOptional()
  @IsString()
  provisioningKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
