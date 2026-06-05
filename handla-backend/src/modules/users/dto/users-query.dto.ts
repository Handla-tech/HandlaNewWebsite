import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';

export class UsersQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (max 200)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: UserRole, description: 'Filter by role' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Search by name or email (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'When true, only return CLIENT-role users who do NOT yet have a clients record. ' +
      'Used by the Create Client modal to show only eligible users.',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ key, obj }) => {
    // Use obj[key] (raw source) to bypass enableImplicitConversion which
    // converts non-empty strings to `true` before @Transform sees `value`.
    const raw = obj[key];
    if (raw === 'false' || raw === false || raw === 0) return false;
    if (raw === 'true'  || raw === true  || raw === 1) return true;
    return undefined; // treat anything else as "not provided"
  })
  @IsBoolean()
  withoutClientRecord?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, return ONLY archived users. ' +
      'When false (default), archived users are excluded from results. ' +
      'Used by the admin archive view.',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ key, obj }) => {
    // Use obj[key] (raw source) to bypass enableImplicitConversion which
    // converts non-empty strings to `true` before @Transform sees `value`.
    // Axios sends 'false' as a string; this correctly maps it to boolean false.
    const raw = obj[key];
    if (raw === 'false' || raw === false || raw === 0) return false;
    if (raw === 'true'  || raw === true  || raw === 1) return true;
    return undefined; // treat anything else as "not provided"
  })
  @IsBoolean()
  isArchived?: boolean;
}
