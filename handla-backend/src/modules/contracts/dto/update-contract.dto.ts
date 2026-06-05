import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Update DTO for contracts.
 *
 * Only `title` and `body` are updatable directly.
 * Status transitions are handled by dedicated endpoints:
 *   POST /contracts/:id/send     — DRAFT → SENT
 *   POST /contracts/:id/accept   — SENT  → SIGNED  (CLIENT)
 *   POST /contracts/:id/reject   — SENT  → REJECTED (CLIENT)
 */
export class UpdateContractDto {
  @ApiPropertyOptional({ example: 'Revised Service Agreement', minLength: 2, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated body text...', minLength: 10 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  body?: string;
}
