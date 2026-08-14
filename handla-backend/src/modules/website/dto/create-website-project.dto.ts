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

export class CreateWebsiteProjectDto {
  @ApiProperty({ description: 'Project title', maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional({ description: 'Client / company name (null to clear)', maxLength: 150 })
  @IsOptional()
  @ValidateIf((o) => o.clientName !== null)
  @IsString()
  @MaxLength(150)
  clientName?: string | null;

  @ApiPropertyOptional({ description: 'Short one-line summary (null to clear)', maxLength: 255 })
  @IsOptional()
  @ValidateIf((o) => o.summary !== null)
  @IsString()
  @MaxLength(255)
  summary?: string | null;

  @ApiProperty({ description: 'Full project description', minLength: 10 })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiPropertyOptional({ description: 'Category label (null to clear)', maxLength: 80 })
  @IsOptional()
  @ValidateIf((o) => o.category !== null)
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @ApiPropertyOptional({ description: 'Cover image URL (null to clear)', maxLength: 2048 })
  @IsOptional()
  @ValidateIf((o) => o.imageUrl !== null)
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Live / case-study URL (null to clear)', maxLength: 2048 })
  @IsOptional()
  @ValidateIf((o) => o.projectUrl !== null)
  @IsUrl({}, { message: 'projectUrl must be a valid URL' })
  @MaxLength(2048)
  projectUrl?: string | null;

  @ApiPropertyOptional({ description: 'Tech-stack / tag list', type: [String] })
  @IsOptional()
  @ValidateIf((o) => o.tags !== null)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[] | null;

  @ApiPropertyOptional({ description: 'Highlight in the landing featured section', default: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Manual sort order (lower = first)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
