import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsEmail,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { BillingInterval } from '../../../common/enums';

/**
 * SAAS-1 — Convert a qualified AI lead into a Client + provisioned Tenant.
 *
 * Two entry modes (exactly one is required):
 *   - `conversationId`: promote the AI conversation's lead (reads
 *     ConversationAiState.leadData), creating/reusing a User + Client.
 *   - `clientId`: the caller already has a Client; skip promotion.
 *
 * In both modes a tenant is then created on (productId, planId).
 */
export class ConvertLeadDto {
  /** AI conversation whose lead should be promoted (mode A). */
  @ValidateIf((o) => !o.clientId)
  @IsUUID()
  conversationId?: string;

  /** Existing client to attach the tenant to (mode B). */
  @ValidateIf((o) => !o.conversationId)
  @IsUUID()
  clientId?: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  planId: string;

  /** Tenant display name; falls back to the lead's company/name when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tenantName?: string;

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

  /**
   * Contact email for the new Client user (mode A). When omitted, the email
   * from the lead data is used; if neither is present the conversion fails.
   */
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;
}
