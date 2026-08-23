/**
 * INFO-01 — Shared public-document capability-token model.
 *
 * These types describe the unified, document-type-agnostic shape used by the
 * invoice / quotation / contract public-link hardening. Each protected entity
 * carries the same four columns (see `PublicTokenColumns`) so a single
 * generator / validator / management surface can serve all three.
 */

/**
 * The three business-document types that expose capability-style public links.
 * The literal values double as the token "namespace" so a token minted for one
 * document type can never authorize a different one (defence-in-depth beyond the
 * per-service repository lookup — see PublicTokenService).
 */
export enum PublicDocumentType {
  INVOICE = 'invoice',
  QUOTATION = 'quotation',
  CONTRACT = 'contract',
}

/**
 * The mixin-style column contract every public-linkable entity satisfies.
 * Kept as a plain interface (not a TypeORM `EntitySchema` mixin) so each entity
 * keeps its own explicit, migration-visible `@Column` decorators — matching the
 * existing Handla convention of hand-written entity columns + explicit
 * migrations (no DATABASE_SYNCHRONIZE).
 */
export interface PublicTokenColumns {
  /** Opaque, high-entropy capability token. NULL until a link is generated. */
  publicToken: string | null;
  /** When the current token expires. NULL = never expires (permanent link). */
  publicTokenExpiresAt: Date | null;
  /** When the current token was explicitly revoked. NULL = not revoked. */
  publicTokenRevokedAt: Date | null;
  /** When the current token was generated / last rotated (audit). */
  publicTokenCreatedAt: Date | null;
}

/**
 * Result of resolving a public token to a lifecycle state. Consumers should map
 * these to HTTP status codes centrally (see PublicTokenService.assertActive):
 *   - NOT_FOUND  → 404 (invalid/unknown token OR legacy fallback miss)
 *   - REVOKED    → 410 Gone
 *   - EXPIRED    → 410 Gone
 *   - ACTIVE     → proceed
 *
 * Note: NOT_FOUND is deliberately indistinguishable from "no such document" so
 * the token remains the only existence oracle (no "document exists but token
 * expired" leakage).
 */
export enum PublicTokenState {
  ACTIVE = 'ACTIVE',
  NOT_FOUND = 'NOT_FOUND',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

/**
 * Safe management-metadata returned by the generate/rotate/revoke/set-expiry
 * admin endpoints. Deliberately minimal: it exposes the shareable public URL
 * (which necessarily contains the token, since the admin is the one sharing it)
 * plus lifecycle status — and NOTHING else about the underlying record.
 *
 * `publicUrl` / `token` are ONLY populated for operations that (re)issue a live
 * token (generate/rotate/set-expiry on an active link). Revoke returns them as
 * null so a revoked token is never echoed back.
 */
export interface PublicLinkManagementResult {
  documentType: PublicDocumentType;
  documentId: string;
  /** Full shareable public URL (token route). Null when there is no live token. */
  publicUrl: string | null;
  /** The token value — same caveat as publicUrl. Callers usually surface the URL. */
  token: string | null;
  state: PublicTokenState;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date | null;
}
