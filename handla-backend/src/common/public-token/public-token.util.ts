import { randomBytes } from 'crypto';

/**
 * INFO-01 — Public capability-token generation.
 *
 * Requirements (from the security task):
 *  - cryptographically strong / non-predictable / non-sequential
 *  - high entropy
 *  - NOT derived from entity id, email, timestamps, or any hash of those
 *  - regeneration must produce an unrelated value (guaranteed: fresh CSPRNG)
 *
 * Implementation: 32 bytes (256 bits) from Node's CSPRNG (`crypto.randomBytes`)
 * encoded as URL-safe base64 (`base64url`). base64url yields a 43-character
 * token containing only [A-Za-z0-9_-] — safe in a path segment, a query string,
 * a QR code, and an email link with no percent-encoding. 256 bits is far beyond
 * enumeration range and comfortably fits the `varchar(64)` column.
 *
 * We deliberately do NOT use:
 *   Math.random()      — not cryptographically secure
 *   Date.now()/uuid v1 — time-correlated / partially predictable
 *   hash(entityId)     — deterministic from a low-entropy input
 */
export const PUBLIC_TOKEN_BYTES = 32;

/** Generate a fresh opaque public capability token (43 chars, base64url). */
export function generatePublicToken(): string {
  return randomBytes(PUBLIC_TOKEN_BYTES).toString('base64url');
}

/**
 * Structural validation of a client-supplied token BEFORE any DB lookup.
 * Rejects obviously malformed input cheaply (defence against probing / oversized
 * inputs) and keeps the DB query shape predictable. This is NOT authorization —
 * a structurally valid token still must match a live record.
 *
 * Accepts base64url tokens in a sane length band. The lower bound also admits
 * legacy UUID-v4 identifiers (36 chars) so the same guard can front the
 * transitional legacy-id compatibility path without a second validator.
 */
export function isWellFormedPublicToken(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // base64url charset, plus '-' already covered; UUID adds '-' too.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(value)) return false;
  return true;
}
