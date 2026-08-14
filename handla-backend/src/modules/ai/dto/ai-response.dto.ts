import { AiIntent, LeadStatus } from '../../../common/enums';

/**
 * The STRICT contract the model must return as JSON. Every AI completion is
 * parsed and validated against this shape before any part of it is used or
 * shown to a customer. If validation fails we fall back gracefully.
 */
export interface StructuredAiResponse {
  /** The natural-language message to send back to the customer. */
  reply: string;

  /** Classified intent of the customer's latest turn. */
  intent: AiIntent;

  /**
   * Structured fields the model extracted from the conversation so far
   * (name, company, product, budget, timeline, email, phone, use_case...).
   * Free-form map; validated/normalised by LeadExtractionService.
   */
  extracted_data: Record<string, unknown>;

  /** Required lead fields still missing (drives the qualification loop). */
  missing_fields: string[];

  /** The model's assessment of the lead's qualification status. */
  lead_status: LeadStatus;

  /** True when a human agent should take over. */
  needs_human: boolean;

  /** Why a human is needed (empty string when needs_human=false). */
  escalation_reason: string;
}

/** Result of validating a raw model output. */
export interface AiValidationResult {
  ok: boolean;
  value?: StructuredAiResponse;
  error?: string;
}

/**
 * Canonical list of the lead fields Handla wants to capture during
 * qualification. `missing_fields` is always a subset of these keys.
 */
export const LEAD_REQUIRED_FIELDS = [
  'name',
  'company',
  'product', // which Handla product: mudar | matjari | manara
  'contact', // email or phone
  'use_case',
] as const;

export type LeadField = (typeof LEAD_REQUIRED_FIELDS)[number];
