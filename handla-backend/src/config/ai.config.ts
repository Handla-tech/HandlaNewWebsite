import { registerAs } from '@nestjs/config';

/**
 * Configuration for the Handla AI Assistant (Phase 10).
 *
 * The assistant is layered ON TOP of the existing chat system — it does not
 * introduce a second messaging pipeline. These settings control the single
 * OpenAI call made per inbound client message and the safety guardrails.
 */
export default registerAs('ai', () => ({
  /** OpenAI API key. When empty the assistant is DISABLED (graceful no-op). */
  apiKey: process.env.OPENAI_API_KEY || '',

  /** Chat completion model. Defaults to a small, cheap, JSON-capable model. */
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  /** OpenAI-compatible base URL (allows Azure / proxy overrides). */
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',

  /** Hard ceiling on the completion length (cost control). */
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '600', 10),

  /** Deterministic-ish output; low temperature reduces hallucination. */
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.2'),

  /** Per-request timeout in ms — after this we fall back gracefully. */
  timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '20000', 10),

  /**
   * Master switch. Even with a key present, set AI_ASSISTANT_ENABLED=false to
   * mute the bot globally (e.g. during an incident).
   */
  enabled:
    (process.env.AI_ASSISTANT_ENABLED ?? 'true').toLowerCase() !== 'false',

  /** How many recent messages to feed into the model as verbatim context. */
  recentMessageWindow: parseInt(process.env.AI_RECENT_WINDOW || '12', 10),

  /** Max KB snippets injected into a single prompt (cost + focus control). */
  maxKbSnippets: parseInt(process.env.AI_MAX_KB_SNIPPETS || '6', 10),

  /**
   * When true the AI never auto-replies to messages from ADMIN/EMPLOYEE users;
   * it only reacts to CLIENT/LEAD turns. (Always the intended behaviour.)
   */
  replyToClientsOnly: true,
}));

export interface AiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  enabled: boolean;
  recentMessageWindow: number;
  maxKbSnippets: number;
  replyToClientsOnly: boolean;
}
