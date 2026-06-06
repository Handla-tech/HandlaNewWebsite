import { IsString, IsOptional, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractDetailsDto } from './contract-details.dto';

/**
 * Update DTO for contracts.
 *
 * Updatable: title, body, details (only while contract is DRAFT).
 * Status transitions go through dedicated endpoints:
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

  @ApiPropertyOptional({ type: ContractDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContractDetailsDto)
  details?: ContractDetailsDto;
}
