import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { BillingInterval, TenantStatus } from '../../../common/enums';

export class CreateTenantDto {
  /** Existing client (account anchor) — reuses the ERP Client model. */
  @IsUUID()
  clientId: string;

  @IsUUID()
  productId: string;

  /** Plan to start the tenant on (also seeds the subscription). */
  @IsUUID()
  planId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  /** URL-safe subdomain label; auto-derived from name when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: 'slug must be a valid DNS label (lowercase, digits, hyphens)',
  })
  slug?: string;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;
}

export class TenantsQueryDto {
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ChangePlanDto {
  @IsUUID()
  planId: string;
}

export class TenantActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  reason?: string;
}

/**
 * Payload products POST back to Handla's internal callback endpoint to report
 * the outcome of an async provisioning job.
 */
export class ProvisioningCallbackDto {
  /** Idempotency key echoed from the original request. */
  @IsString()
  @MaxLength(64)
  requestId: string;

  /** 'succeeded' | 'failed' */
  @IsString()
  @MaxLength(16)
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalTenantId?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  error?: string;
}
