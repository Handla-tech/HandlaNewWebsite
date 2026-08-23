import {
  IsOptional,
  IsBoolean,
  IsISO8601,
  IsIn,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * INFO-01 — Ensures a supplied ISO date string is strictly in the future.
 * Used for the public-link expiry so a client cannot set an already-expired
 * (or nonsensical) expiration.
 */
@ValidatorConstraint({ name: 'IsFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true; // optional
    if (typeof value !== 'string') return false;
    const t = Date.parse(value);
    if (Number.isNaN(t)) return false;
    return t > Date.now();
  }
  defaultMessage(_args: ValidationArguments): string {
    return 'expiresAt must be a valid ISO-8601 date/time in the future';
  }
}

/**
 * DTO for generating / regenerating a public capability link.
 *
 * The token itself is ALWAYS server-generated — this DTO deliberately does NOT
 * accept a `publicToken` field, and the global ValidationPipe
 * (whitelist + forbidNonWhitelisted) rejects any request that tries to smuggle
 * one (or any other unexpected field).
 *
 * Expiry may be expressed either as:
 *   - `expiresInDays`: a convenient preset number of days from now, OR
 *   - `expiresAt`: an explicit future ISO-8601 timestamp, OR
 *   - `permanent: true`: no expiry (only when explicitly chosen).
 * If none is provided, the server applies its configured default
 * (PUBLIC_DOC_DEFAULT_EXPIRY_DAYS; 0 = permanent).
 */
export class ManagePublicLinkDto {
  @ApiPropertyOptional({
    description: 'Preset expiry, in whole days from now. Mutually exclusive with expiresAt/permanent.',
    enum: [1, 7, 14, 30, 60, 90, 180, 365],
    example: 30,
  })
  @IsOptional()
  @IsIn([1, 7, 14, 30, 60, 90, 180, 365], {
    message: 'expiresInDays must be one of: 1, 7, 14, 30, 60, 90, 180, 365',
  })
  expiresInDays?: number;

  @ApiPropertyOptional({
    description: 'Explicit future expiry (ISO-8601). Mutually exclusive with expiresInDays/permanent.',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Validate(IsFutureDateConstraint)
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Explicitly request a permanent (never-expiring) link. Overrides expiry inputs.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  permanent?: boolean;
}
