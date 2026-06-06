import {
  IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsEnum,
  IsDateString, ValidateNested, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ContractType {
  FIXED_PRICE   = 'FIXED_PRICE',
  HOURLY        = 'HOURLY',
  RETAINER      = 'RETAINER',
  MILESTONE     = 'MILESTONE',
  MAINTENANCE   = 'MAINTENANCE',
  CONSULTATION  = 'CONSULTATION',
}

export enum OwnershipType {
  CLIENT_OWNS_EVERYTHING            = 'CLIENT_OWNS_EVERYTHING',
  OWNERSHIP_TRANSFERS_AFTER_PAYMENT = 'OWNERSHIP_TRANSFERS_AFTER_PAYMENT',
  SHARED_OWNERSHIP                  = 'SHARED_OWNERSHIP',
}

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

/** One payment milestone in the schedule. */
export class PaymentMilestoneDto {
  @ApiProperty({ example: 'Deposit' })
  @IsString()
  @MaxLength(120)
  name: string;

  /** Percentage of total (0-100). Either percentage OR amount may be set. */
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentage?: number;

  /** Absolute amount in the contract currency. */
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

/**
 * Comprehensive contract details. ALL fields are optional so existing
 * minimal-form contracts (title + body only) remain backward-compatible.
 *
 * When this object is provided, the service auto-renders a structured `body`
 * string from it (still saved on the Contract.body column) so the existing
 * PDF / HTML template flow keeps working without changes.
 */
export class ContractDetailsDto {
  // ── CONTRACT INFORMATION ─────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'CN-2026-001' })
  @IsOptional() @IsString() @MaxLength(64)
  contractNumber?: string;

  @ApiPropertyOptional({ enum: ContractType })
  @IsOptional() @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({ example: 'Acme Marketing Website' })
  @IsOptional() @IsString() @MaxLength(255)
  projectName?: string;

  // ── CLIENT INFORMATION ───────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  clientName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  clientCompany?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  clientEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  clientPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  clientAddress?: string;

  // ── PROJECT DETAILS ──────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000)
  projectDescription?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000)
  scopeOfWork?: string;

  /** Free-form list of deliverables — one per line on the frontend. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  deliverables?: string[];

  /** Things explicitly NOT included. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  excludedServices?: string[];

  // ── TIMELINE ─────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional() @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional() @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: '3 months' })
  @IsOptional() @IsString() @MaxLength(120)
  estimatedDuration?: string;

  // ── FINANCIAL DETAILS ────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional() @IsString() @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional() @IsNumber() @Min(0)
  totalValue?: number;

  // ── PAYMENT SCHEDULE ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ type: [PaymentMilestoneDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMilestoneDto)
  paymentMilestones?: PaymentMilestoneDto[];

  // ── REVISIONS ────────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  freeRevisions?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  additionalRevisionCost?: number;

  // ── WARRANTY & SUPPORT ───────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '30 days' })
  @IsOptional() @IsString() @MaxLength(120)
  warrantyPeriod?: string;

  @ApiPropertyOptional({ example: '90 days' })
  @IsOptional() @IsString() @MaxLength(120)
  supportPeriod?: string;

  // ── INTELLECTUAL PROPERTY ────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: OwnershipType })
  @IsOptional() @IsEnum(OwnershipType)
  ownershipType?: OwnershipType;

  // ── CONFIDENTIALITY ──────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  ndaIncluded?: boolean;

  // ── HOSTING & DEPLOYMENT ─────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  hostingIncluded?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  domainIncluded?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  sslIncluded?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  deploymentIncluded?: boolean;

  // ── LATE PAYMENT ─────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '1.5% per month' })
  @IsOptional() @IsString() @MaxLength(255)
  latePaymentPenalty?: string;

  // ── TERMINATION ──────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  terminationTerms?: string;

  // ── ACCEPTANCE ───────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 7 })
  @IsOptional() @IsNumber() @Min(0)
  acceptancePeriodDays?: number;

  // ── GENERAL TERMS ────────────────────────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000)
  termsAndConditions?: string;
}
