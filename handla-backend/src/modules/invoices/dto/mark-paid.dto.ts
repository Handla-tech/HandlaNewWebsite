import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for marking an invoice as paid.
 * paidAt defaults to now() if not provided.
 */
export class MarkPaidDto {
  @ApiPropertyOptional({
    description: 'Timestamp when payment was received; defaults to current time',
    example: '2026-06-15T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
