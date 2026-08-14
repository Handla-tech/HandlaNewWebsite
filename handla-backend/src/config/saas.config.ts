import { registerAs } from '@nestjs/config';

/**
 * SAAS-1 — Configuration for the SaaS Control Plane (Phase 11).
 *
 * Secrets (outbound product keys, inbound callback key) live in env, never in
 * the database as plaintext. Handla stores at most a SHA-256 hash for display.
 */
export default registerAs('saas', () => ({
  /**
   * Shared secret products must present when calling Handla's @Public()
   * internal callback endpoints. Empty ⇒ internal API disabled (fail closed).
   */
  inboundKey: process.env.SAAS_INTERNAL_INBOUND_KEY || '',

  /**
   * Outbound service-to-service keys Handla presents to each product, keyed by
   * product code. Read from SAAS_OUTBOUND_KEY_<CODE> env vars.
   */
  outboundKeys: {
    mudar: process.env.SAAS_OUTBOUND_KEY_MUDAR || '',
    matjari: process.env.SAAS_OUTBOUND_KEY_MATJARI || '',
    manara: process.env.SAAS_OUTBOUND_KEY_MANARA || '',
  } as Record<string, string>,

  /** Fallback outbound key when a product-specific one is not set. */
  defaultOutboundKey: process.env.SAAS_OUTBOUND_KEY_DEFAULT || '',

  /** Per-request timeout (ms) for outbound provisioning calls. */
  timeoutMs: parseInt(process.env.SAAS_PROVISION_TIMEOUT_MS || '20000', 10),

  /**
   * Root DNS zone for tenant subdomains. Product zone defaults to
   * "<code>.<rootZone>" when a product has no explicit subdomainZone.
   */
  rootZone: process.env.SAAS_ROOT_ZONE || 'handla.tech',

  /** How often (ms) the provisioning worker polls for queued jobs. */
  workerIntervalMs: parseInt(process.env.SAAS_WORKER_INTERVAL_MS || '5000', 10),

  /** Max attempts before a provisioning job is marked FAILED. */
  maxAttempts: parseInt(process.env.SAAS_MAX_ATTEMPTS || '3', 10),

  /**
   * When true, products default to the in-process "mock" provisioner unless a
   * real provisioner/base URL is configured. Handy for local/dev.
   */
  useMockByDefault:
    (process.env.SAAS_USE_MOCK ?? 'true').toLowerCase() !== 'false',
}));

export interface SaasConfig {
  inboundKey: string;
  outboundKeys: Record<string, string>;
  defaultOutboundKey: string;
  timeoutMs: number;
  rootZone: string;
  workerIntervalMs: number;
  maxAttempts: number;
  useMockByDefault: boolean;
}
