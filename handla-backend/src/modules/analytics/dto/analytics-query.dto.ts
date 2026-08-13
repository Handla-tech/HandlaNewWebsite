import { IsOptional, IsString, IsDateString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ANL — shared query for analytics dashboard endpoints.
 * `from`/`to` default to the last 30 days. `site` scopes to one property.
 */
export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  site?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['hour', 'day', 'month'])
  interval?: 'hour' | 'day' | 'month';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
