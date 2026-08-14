import { Injectable } from '@nestjs/common';

import {
  LEAD_REQUIRED_FIELDS,
  LeadField,
  StructuredAiResponse,
} from '../dto/ai-response.dto';
import { LeadStatus } from '../../../common/enums';

export interface MergedLeadState {
  leadData: Record<string, unknown>;
  missingFields: string[];
  leadStatus: LeadStatus;
}

/**
 * Owns the lead-qualification workflow logic. The AI proposes extracted fields
 * and a lead_status; NestJS (this service) is the source of truth that MERGES
 * new data into the accumulated state and DERIVES the authoritative status.
 *
 * We never trust the model's lead_status blindly — we recompute missing_fields
 * from the merged data and only let the model DOWNGRADE (e.g. DISQUALIFIED) or
 * request escalation; QUALIFIED is granted by us only when all fields exist.
 */
@Injectable()
export class LeadExtractionService {
  /**
   * Merge the model's freshly extracted_data into the persisted leadData and
   * recompute the authoritative missing_fields + lead_status.
   */
  merge(
    existing: Record<string, unknown> | null,
    ai: StructuredAiResponse,
  ): MergedLeadState {
    const leadData: Record<string, unknown> = { ...(existing ?? {}) };

    // Only accept known-primitive values; never let extraction overwrite an
    // already-captured field with an empty value.
    for (const [k, v] of Object.entries(ai.extracted_data ?? {})) {
      const key = this.canonicalKey(k);
      if (!key) continue;
      if (v === null || v === undefined) continue;
      const val = typeof v === 'string' ? v.trim() : v;
      if (val === '' ) continue;
      leadData[key] = val;
    }

    const missingFields = this.computeMissing(leadData);
    const leadStatus = this.deriveStatus(missingFields, ai.lead_status);

    return { leadData, missingFields, leadStatus };
  }

  /** Required fields not yet present in the merged lead data. */
  computeMissing(leadData: Record<string, unknown>): string[] {
    return LEAD_REQUIRED_FIELDS.filter((f) => !this.has(leadData, f));
  }

  /**
   * Authoritative status derivation:
   *  - If the model says DISQUALIFIED or CONVERTED, honour that (human/terminal
   *    intent it detected).
   *  - Otherwise: no data → NEW; some but incomplete → QUALIFYING; complete →
   *    QUALIFIED. We never auto-mark CONVERTED (that happens on real conversion).
   */
  deriveStatus(missingFields: string[], modelStatus: LeadStatus): LeadStatus {
    if (modelStatus === LeadStatus.DISQUALIFIED) return LeadStatus.DISQUALIFIED;
    if (modelStatus === LeadStatus.CONVERTED) return LeadStatus.CONVERTED;

    const captured = LEAD_REQUIRED_FIELDS.length - missingFields.length;
    if (missingFields.length === 0) return LeadStatus.QUALIFIED;
    if (captured > 0) return LeadStatus.QUALIFYING;
    return LeadStatus.NEW;
  }

  private has(leadData: Record<string, unknown>, field: LeadField): boolean {
    const v = leadData[field];
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  /** Maps common model synonyms to canonical lead field keys. */
  private canonicalKey(raw: string): string | null {
    const k = (raw || '').toLowerCase().trim();
    const map: Record<string, LeadField> = {
      name: 'name',
      full_name: 'name',
      customer_name: 'name',
      company: 'company',
      company_name: 'company',
      organization: 'company',
      business: 'company',
      product: 'product',
      product_interest: 'product',
      interested_product: 'product',
      contact: 'contact',
      email: 'contact',
      phone: 'contact',
      phone_number: 'contact',
      use_case: 'use_case',
      usecase: 'use_case',
      need: 'use_case',
      requirement: 'use_case',
      goal: 'use_case',
    };
    if (map[k]) return map[k];
    // Allow storing extra, non-required fields too (budget, timeline, etc.)
    if (/^[a-z][a-z0-9_]{1,40}$/.test(k)) return k;
    return null;
  }
}
