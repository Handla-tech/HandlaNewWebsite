import {
  IsString, IsUUID, IsOptional, MinLength, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractDetailsDto } from './contract-details.dto';

export class CreateContractDto {
  @ApiProperty({ example: 'Service Agreement — Acme Corp', minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  /**
   * Free-form contract body. Optional when `details` is provided — in that
   * case the service auto-generates a structured body from the details so
   * the PDF / HTML template stays populated.
   */
  @ApiPropertyOptional({ example: 'This agreement is made between Handla Tech and the Client...', minLength: 10 })
  @IsOptional()
  @IsString()
  @MinLength(10)
  body?: string;

  @ApiProperty({ example: 'a1b2c3d4-...', description: 'UUID of the client this contract belongs to' })
  @IsUUID()
  clientId: string;

  /** Comprehensive structured contract data (optional). */
  @ApiPropertyOptional({ type: ContractDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContractDetailsDto)
  details?: ContractDetailsDto;
}
