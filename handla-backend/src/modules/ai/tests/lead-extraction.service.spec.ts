import { LeadExtractionService } from '../services/lead-extraction.service';
import { StructuredAiResponse } from '../dto/ai-response.dto';
import { AiIntent, LeadStatus } from '../../../common/enums';

function aiResponse(partial: Partial<StructuredAiResponse>): StructuredAiResponse {
  return {
    reply: 'ok',
    intent: AiIntent.LEAD_INQUIRY,
    extracted_data: {},
    missing_fields: [],
    lead_status: LeadStatus.NEW,
    needs_human: false,
    escalation_reason: '',
    ...partial,
  };
}

describe('LeadExtractionService', () => {
  const svc = new LeadExtractionService();

  it('merges new fields into existing lead data', () => {
    const res = svc.merge({ name: 'Sara' }, aiResponse({ extracted_data: { company: 'Acme' } }));
    expect(res.leadData).toEqual({ name: 'Sara', company: 'Acme' });
  });

  it('maps synonym keys to canonical fields (email/phone -> contact)', () => {
    const res = svc.merge(null, aiResponse({ extracted_data: { email: 'a@b.com', company_name: 'Acme' } }));
    expect(res.leadData.contact).toBe('a@b.com');
    expect(res.leadData.company).toBe('Acme');
  });

  it('never overwrites a captured field with an empty value', () => {
    const res = svc.merge({ name: 'Sara' }, aiResponse({ extracted_data: { name: '   ' } }));
    expect(res.leadData.name).toBe('Sara');
  });

  it('computes missing required fields', () => {
    const res = svc.merge(null, aiResponse({ extracted_data: { name: 'Sara' } }));
    expect(res.missingFields).toEqual(
      expect.arrayContaining(['company', 'product', 'contact', 'use_case']),
    );
    expect(res.missingFields).not.toContain('name');
  });

  it('derives QUALIFIED only when all required fields are present', () => {
    const full = {
      name: 'Sara',
      company: 'Acme',
      product: 'mudar',
      contact: 'a@b.com',
      use_case: 'inventory',
    };
    const res = svc.merge(full, aiResponse({ lead_status: LeadStatus.NEW }));
    expect(res.missingFields).toHaveLength(0);
    expect(res.leadStatus).toBe(LeadStatus.QUALIFIED);
  });

  it('derives QUALIFYING when partial data captured', () => {
    const res = svc.merge({ name: 'Sara' }, aiResponse({}));
    expect(res.leadStatus).toBe(LeadStatus.QUALIFYING);
  });

  it('derives NEW when nothing captured', () => {
    const res = svc.merge(null, aiResponse({}));
    expect(res.leadStatus).toBe(LeadStatus.NEW);
  });

  it('honours model DISQUALIFIED regardless of captured data', () => {
    const full = {
      name: 'Sara',
      company: 'Acme',
      product: 'mudar',
      contact: 'a@b.com',
      use_case: 'inventory',
    };
    const res = svc.merge(full, aiResponse({ lead_status: LeadStatus.DISQUALIFIED }));
    expect(res.leadStatus).toBe(LeadStatus.DISQUALIFIED);
  });

  it('does not auto-mark CONVERTED from qualification alone', () => {
    const full = {
      name: 'Sara',
      company: 'Acme',
      product: 'mudar',
      contact: 'a@b.com',
      use_case: 'inventory',
    };
    // model claims NEW but data is complete => we grant QUALIFIED, not CONVERTED
    const res = svc.merge(full, aiResponse({ lead_status: LeadStatus.NEW }));
    expect(res.leadStatus).not.toBe(LeadStatus.CONVERTED);
  });
});
