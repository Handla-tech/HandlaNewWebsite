import { IsOptional, IsDateString, IsUUID, IsIn } from 'class-validator';

/**
 * REP — shared date-range query for reports.
 *
 * `from` / `to` are inclusive ISO dates (YYYY-MM-DD). When omitted, the service
 * defaults to the current calendar year. `currency` optionally filters to a
 * single currency (records without a currency are grouped under "UNSPECIFIED").
 */
export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsIn(['month', 'quarter', 'year'])
  groupBy?: 'month' | 'quarter' | 'year';
}
