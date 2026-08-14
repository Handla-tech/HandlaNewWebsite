import { ConfigService } from '@nestjs/config';
import { AiService } from '../services/ai.service';
import { AiIntent, LeadStatus } from '../../../common/enums';

function makeService(overrides: Record<string, unknown> = {}): AiService {
  const cfg = {
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 600,
    temperature: 0.2,
    timeoutMs: 20000,
    enabled: true,
    recentMessageWindow: 12,
    maxKbSnippets: 6,
    replyToClientsOnly: true,
    ...overrides,
  };
  const configService = { get: () => cfg } as unknown as ConfigService;
  return new AiService(configService);
}

describe('AiService.validate (structured output contract)', () => {
  const svc = makeService();

  it('accepts a well-formed JSON response', () => {
    const raw = JSON.stringify({
      reply: 'Hello! How can I help?',
      intent: AiIntent.GENERAL_QUESTION,
      extracted_data: { name: 'Sara' },
      missing_fields: ['company'],
      lead_status: LeadStatus.QUALIFYING,
      needs_human: false,
      escalation_reason: '',
    });
    const res = svc.validate(raw);
    expect(res.ok).toBe(true);
    expect(res.value?.reply).toBe('Hello! How can I help?');
    expect(res.value?.intent).toBe(AiIntent.GENERAL_QUESTION);
    expect(res.value?.extracted_data.name).toBe('Sara');
  });

  it('rejects non-JSON output', () => {
    expect(svc.validate('not json at all').ok).toBe(false);
  });

  it('rejects output missing a reply', () => {
    const raw = JSON.stringify({ intent: 'GENERAL_QUESTION', reply: '   ' });
    expect(svc.validate(raw).ok).toBe(false);
  });

  it('rejects empty / null input', () => {
    expect(svc.validate(null).ok).toBe(false);
    expect(svc.validate('').ok).toBe(false);
  });

  it('coerces unknown intent to GENERAL_QUESTION and unknown status to NEW', () => {
    const raw = JSON.stringify({
      reply: 'ok',
      intent: 'NONSENSE',
      lead_status: 'WHATEVER',
      extracted_data: {},
      missing_fields: [],
      needs_human: false,
    });
    const res = svc.validate(raw);
    expect(res.ok).toBe(true);
    expect(res.value?.intent).toBe(AiIntent.GENERAL_QUESTION);
    expect(res.value?.lead_status).toBe(LeadStatus.NEW);
  });

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"reply":"hi","intent":"SMALL_TALK","extracted_data":{},"missing_fields":[],"lead_status":"NEW","needs_human":false,"escalation_reason":""}\n```';
    const res = svc.validate(raw);
    expect(res.ok).toBe(true);
    expect(res.value?.reply).toBe('hi');
  });

  it('clears escalation_reason when needs_human is false', () => {
    const raw = JSON.stringify({
      reply: 'ok',
      intent: 'GENERAL_QUESTION',
      extracted_data: {},
      missing_fields: [],
      lead_status: 'NEW',
      needs_human: false,
      escalation_reason: 'should be dropped',
    });
    const res = svc.validate(raw);
    expect(res.value?.escalation_reason).toBe('');
  });

  it('drops non-primitive / empty extracted_data values', () => {
    const raw = JSON.stringify({
      reply: 'ok',
      intent: 'LEAD_INQUIRY',
      extracted_data: { name: 'Sara', junk: { nested: true }, blank: '  ' },
      missing_fields: [],
      lead_status: 'QUALIFYING',
      needs_human: false,
      escalation_reason: '',
    });
    const res = svc.validate(raw);
    expect(res.value?.extracted_data).toEqual({ name: 'Sara' });
  });

  it('isConfigured() reflects key + enabled flag', () => {
    expect(makeService().isConfigured()).toBe(true);
    expect(makeService({ apiKey: '' }).isConfigured()).toBe(false);
    expect(makeService({ enabled: false }).isConfigured()).toBe(false);
  });
});
