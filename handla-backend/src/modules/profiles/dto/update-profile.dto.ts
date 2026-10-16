import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Fields ANY user is allowed to change about themselves OR that ADMIN can
 * change about any user. Role / archive / disable flags are NOT here — those
 * are managed by the dedicated UsersController routes with stricter checks.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;



  @ApiPropertyOptional({ description: 'Short bio', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @ApiPropertyOptional({ description: 'Phone number (free-form)', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string | null;

  @ApiPropertyOptional({ description: 'Job title', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string | null;

  @ApiPropertyOptional({ description: 'Company / organisation', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string | null;

  @ApiPropertyOptional({ description: 'Location (city, country)', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string | null;
}
