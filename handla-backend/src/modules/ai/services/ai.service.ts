import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AiConfig } from '../../../config/ai.config';
import {
  StructuredAiResponse,
  AiValidationResult,
} from '../dto/ai-response.dto';
import { AiIntent, LeadStatus } from '../../../common/enums';

export interface ChatMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Thin, dependency-free wrapper around the OpenAI Chat Completions API
 * (called via native fetch — no SDK / native module added) plus STRICT
 * validation of the model's JSON output.
 *
 * The AI is the language-understanding layer only. Anything it returns is
 * validated here before the orchestrator is allowed to act on it.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly cfg: AiConfig;

  constructor(private readonly configService: ConfigService) {
    this.cfg = this.configService.get<AiConfig>('ai')!;
  }

  /** Whether the assistant can actually call the model. */
  isConfigured(): boolean {
    return this.cfg.enabled && !!this.cfg.apiKey;
  }

  /**
   * Calls the model once and returns the raw assistant text (JSON string).
   * Returns null on any transport error / timeout so callers can fall back.
   */
  async complete(messages: ChatMessageParam[]): Promise<string | null> {
    if (!this.isConfigured()) {
      this.logger.warn('AiService.complete called while not configured — skipping.');
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          temperature: this.cfg.temperature,
          max_tokens: this.cfg.maxTokens,
          response_format: { type: 'json_object' },
          messages,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`OpenAI HTTP ${res.status}: ${body.slice(0, 300)}`);
        return null;
      }

      const json: any = await res.json();
      const content: string | undefined = json?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error('OpenAI response missing message content');
        return null;
      }
      return content;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        this.logger.error(`OpenAI request timed out after ${this.cfg.timeoutMs}ms`);
      } else {
        this.logger.error(`OpenAI request failed: ${(err as Error)?.message}`);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Parses + strictly validates raw model output into a StructuredAiResponse.
   * Coerces/normalises where safe; rejects when the core contract is broken.
   */
  validate(raw: string | null): AiValidationResult {
    if (!raw) return { ok: false, error: 'empty model output' };

    let parsed: any;
    try {
      parsed = JSON.parse(this.stripFences(raw));
    } catch {
      return { ok: false, error: 'output was not valid JSON' };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: 'output was not a JSON object' };
    }

    // reply — required non-empty string
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
    if (!reply) return { ok: false, error: 'missing "reply"' };

    // intent — must be a known enum value, else default GENERAL_QUESTION
    const intent: AiIntent = Object.values(AiIntent).includes(parsed.intent)
      ? parsed.intent
      : AiIntent.GENERAL_QUESTION;

    // lead_status — must be a known enum value, else NEW
    const lead_status: LeadStatus = Object.values(LeadStatus).includes(parsed.lead_status)
      ? parsed.lead_status
      : LeadStatus.NEW;

    // extracted_data — must be a plain object of primitives
    const extracted_data = this.normaliseExtracted(parsed.extracted_data);

    // missing_fields — array of strings
    const missing_fields: string[] = Array.isArray(parsed.missing_fields)
      ? parsed.missing_fields.filter((x: unknown) => typeof x === 'string')
      : [];

    // needs_human — boolean
    const needs_human = parsed.needs_human === true;

    // escalation_reason — string (only meaningful when needs_human)
    const escalation_reason =
      typeof parsed.escalation_reason === 'string' ? parsed.escalation_reason.trim() : '';

    const value: StructuredAiResponse = {
      reply,
      intent,
      extracted_data,
      missing_fields,
      lead_status,
      needs_human,
      escalation_reason: needs_human ? escalation_reason : '',
    };
    return { ok: true, value };
  }

  private normaliseExtracted(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed) out[k] = trimmed;
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      }
    }
    return out;
  }

  private stripFences(raw: string): string {
    return raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
}
