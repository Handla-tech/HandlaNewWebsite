import {
  IsString,
  IsOptional,
  IsInt,
  IsUrl,
  IsBoolean,
  IsArray,
  Min,
  MaxLength,
  MinLength,
  ValidateIf,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebsiteProductDto {
  @ApiProperty({ description: 'Product name', maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ description: 'Short tagline (null to clear)', maxLength: 255 })
  @IsOptional()
  @ValidateIf((o) => o.tagline !== null)
  @IsString()
  @MaxLength(255)
  tagline?: string | null;

  @ApiProperty({ description: 'Full product description', minLength: 10 })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiPropertyOptional({ description: 'Category label (null to clear)', maxLength: 80 })
  @IsOptional()
  @ValidateIf((o) => o.category !== null)
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @ApiPropertyOptional({ description: 'Cover / logo image URL (null to clear)', maxLength: 2048 })
  @IsOptional()
  @ValidateIf((o) => o.imageUrl !== null)
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: 'External / demo URL (null to clear)', maxLength: 2048 })
  @IsOptional()
  @ValidateIf((o) => o.productUrl !== null)
  @IsUrl({}, { message: 'productUrl must be a valid URL' })
  @MaxLength(2048)
  productUrl?: string | null;

  @ApiPropertyOptional({ description: 'Display price string (null to clear)', maxLength: 80 })
  @IsOptional()
  @ValidateIf((o) => o.price !== null)
  @IsString()
  @MaxLength(80)
  price?: string | null;

  @ApiPropertyOptional({ description: 'Feature bullet list', type: [String] })
  @IsOptional()
  @ValidateIf((o) => o.features !== null)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  features?: string[] | null;

  @ApiPropertyOptional({ description: 'Highlight on the landing page', default: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Manual sort order (lower = first)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
