import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
} from '@nestjs/common';

import {
  PublicTokenColumns,
  PublicTokenState,
  PublicDocumentType,
  PublicLinkManagementResult,
} from './public-token.types';
import { generatePublicToken, isWellFormedPublicToken } from './public-token.util';

/**
 * INFO-01 — Centralized public-document token lifecycle + validation.
 *
 * This service is intentionally document-type-agnostic: it operates on the
 * shared `PublicTokenColumns` shape carried by Invoice / Quotation / Contract,
 * so the exact same generate / rotate / revoke / expiry / validate semantics
 * apply everywhere. Each per-document service owns the repository lookup (which
 * enforces document-type scoping — a token is only ever queried within its own
 * table), then delegates the *lifecycle* + *state validation* here.
 *
 * Lifecycle mutation helpers are pure (they mutate the passed entity in memory
 * and return it); persistence stays with the calling service inside its own
 * transaction/repo. This keeps this service free of any repository binding and
 * trivially unit-testable with fake timers.
 */
@Injectable()
export class PublicTokenService {
  private readonly logger = new Logger(PublicTokenService.name);

  /**
   * Ensure the entity has an ACTIVE token, generating one if absent.
   * Does not rotate an existing active token (idempotent "generate link").
   * @returns `true` if a new token was generated, `false` if one already existed.
   */
  ensureToken(entity: PublicTokenColumns, now: Date = new Date()): boolean {
    if (entity.publicToken && this.classify(entity, now) === PublicTokenState.ACTIVE) {
      return false;
    }
    // No token yet, OR the stored token is revoked/expired → mint a fresh one
    // and clear the terminal flags so the new link starts clean.
    this.assignFreshToken(entity, now);
    return true;
  }

  /**
   * Rotate: unconditionally mint a NEW token, immediately invalidating the old
   * one (the old string simply no longer matches any stored value). Clears
   * revocation and resets creation time; preserves the current expiry policy by
   * default (caller may pass a new expiry).
   */
  rotateToken(
    entity: PublicTokenColumns,
    opts: { expiresAt?: Date | null } = {},
    now: Date = new Date(),
  ): void {
    const nextExpiry =
      opts.expiresAt !== undefined ? opts.expiresAt : entity.publicTokenExpiresAt ?? null;
    this.assignFreshToken(entity, now);
    entity.publicTokenExpiresAt = nextExpiry;
  }

  /** Revoke the current token. The public link stops working immediately. */
  revokeToken(entity: PublicTokenColumns, now: Date = new Date()): void {
    if (!entity.publicToken) return;
    entity.publicTokenRevokedAt = now;
  }

  /**
   * Set (or clear) the expiry of the CURRENT token.
   * `null` = permanent link (only when the caller explicitly chooses it).
   */
  setExpiry(entity: PublicTokenColumns, expiresAt: Date | null): void {
    entity.publicTokenExpiresAt = expiresAt;
  }

  /**
   * Classify the lifecycle state of an entity's token WITHOUT comparing against
   * a supplied token (used internally + for admin status display).
   */
  classify(entity: PublicTokenColumns, now: Date = new Date()): PublicTokenState {
    if (!entity.publicToken) return PublicTokenState.NOT_FOUND;
    if (entity.publicTokenRevokedAt) return PublicTokenState.REVOKED;
    if (entity.publicTokenExpiresAt && entity.publicTokenExpiresAt.getTime() <= now.getTime()) {
      return PublicTokenState.EXPIRED;
    }
    return PublicTokenState.ACTIVE;
  }

  /**
   * Compare a caller-supplied token against the entity and classify the result.
   * A mismatch is reported as NOT_FOUND (never leaks that the record exists but
   * the token is wrong) — this covers the "old rotated token" case, which no
   * longer matches the stored value.
   */
  match(
    entity: PublicTokenColumns | null | undefined,
    suppliedToken: string,
    now: Date = new Date(),
  ): PublicTokenState {
    if (!entity || !entity.publicToken) return PublicTokenState.NOT_FOUND;
    // Constant-time-ish equality: lengths differ ⇒ mismatch; otherwise compare.
    if (!this.safeEquals(entity.publicToken, suppliedToken)) {
      return PublicTokenState.NOT_FOUND;
    }
    return this.classify(entity, now);
  }

  /**
   * Assert that a supplied token is ACTIVE for the given entity, throwing the
   * canonical safe HTTP error otherwise. This is the single choke-point every
   * public read/action route funnels through.
   *
   *   invalid / unknown / mismatch / rotated-away → 404 NotFound
   *   revoked                                     → 410 Gone
   *   expired                                     → 410 Gone
   *
   * Errors carry generic messages only — no document identifiers, no hint about
   * whether a record exists behind an invalid token.
   */
  assertActive(
    entity: PublicTokenColumns | null | undefined,
    suppliedToken: string,
    now: Date = new Date(),
  ): void {
    // Structural pre-check keeps malformed probes off the DB-shaped path.
    if (!isWellFormedPublicToken(suppliedToken)) {
      throw new NotFoundException('Document not found');
    }
    const state = this.match(entity, suppliedToken, now);
    switch (state) {
      case PublicTokenState.ACTIVE:
        return;
      case PublicTokenState.REVOKED:
        throw new GoneException('This link has been revoked and is no longer available');
      case PublicTokenState.EXPIRED:
        throw new GoneException('This link has expired and is no longer available');
      case PublicTokenState.NOT_FOUND:
      default:
        throw new NotFoundException('Document not found');
    }
  }

  /**
   * Resolve a ManagePublicLinkDto-shaped input into a concrete expiry Date|null.
   *  - permanent:true            → null (never expires)
   *  - expiresAt (ISO)           → that instant
   *  - expiresInDays (preset)    → now + N days
   *  - none provided             → configured default (defaultExpiryDays; 0=null)
   */
  resolveExpiry(
    input: { expiresInDays?: number; expiresAt?: string; permanent?: boolean } | undefined,
    defaultExpiryDays: number,
    now: Date = new Date(),
  ): Date | null {
    const dto = input ?? {};
    if (dto.permanent === true) return null;
    if (dto.expiresAt) {
      const t = Date.parse(dto.expiresAt);
      // Structurally validated by the DTO; guard again defensively.
      if (!Number.isNaN(t) && t > now.getTime()) return new Date(t);
      return null;
    }
    if (typeof dto.expiresInDays === 'number' && dto.expiresInDays > 0) {
      return new Date(now.getTime() + dto.expiresInDays * 24 * 60 * 60 * 1000);
    }
    // No explicit choice → apply configured default (0 ⇒ permanent).
    if (defaultExpiryDays > 0) {
      return new Date(now.getTime() + defaultExpiryDays * 24 * 60 * 60 * 1000);
    }
    return null;
  }

  /**
   * Build a safe admin-facing status view of a token's lifecycle. Deliberately
   * does NOT include the token value itself — callers that need the shareable
   * URL construct it separately and return it only on generate/rotate.
   */
  statusView(entity: PublicTokenColumns, now: Date = new Date()): {
    hasToken: boolean;
    state: PublicTokenState;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date | null;
  } {
    return {
      hasToken: !!entity.publicToken,
      state: this.classify(entity, now),
      expiresAt: entity.publicTokenExpiresAt ?? null,
      revokedAt: entity.publicTokenRevokedAt ?? null,
      createdAt: entity.publicTokenCreatedAt ?? null,
    };
  }

  /**
   * Frontend public-page path segment for each document type. These match the
   * existing Next.js public routes (which already carry `noindex, nofollow`):
   *   /invoice/public/token/:token
   *   /quotation/public/token/:token
   *   /contract/public/token/:token
   * (the quotation page historically used /quotation/public/:token — the new
   * unified token route adds the explicit /token/ segment for all three.)
   */
  buildPublicUrl(
    type: PublicDocumentType,
    token: string | null,
    frontendBaseUrl: string,
  ): string | null {
    if (!token) return null;
    const base = (frontendBaseUrl || '').replace(/\/+$/, '');
    return `${base}/${type}/public/token/${token}`;
  }

  /**
   * Assemble the safe management-metadata result for an admin endpoint. Only
   * surfaces the URL/token when the token is currently ACTIVE.
   */
  buildManagementResult(
    type: PublicDocumentType,
    documentId: string,
    entity: PublicTokenColumns,
    frontendBaseUrl: string,
    now: Date = new Date(),
  ): PublicLinkManagementResult {
    const state = this.classify(entity, now);
    const isLive = state === PublicTokenState.ACTIVE;
    return {
      documentType: type,
      documentId,
      token: isLive ? entity.publicToken : null,
      publicUrl: isLive ? this.buildPublicUrl(type, entity.publicToken, frontendBaseUrl) : null,
      state,
      expiresAt: entity.publicTokenExpiresAt ?? null,
      revokedAt: entity.publicTokenRevokedAt ?? null,
      createdAt: entity.publicTokenCreatedAt ?? null,
    };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private assignFreshToken(entity: PublicTokenColumns, now: Date): void {
    entity.publicToken = generatePublicToken();
    entity.publicTokenCreatedAt = now;
    entity.publicTokenRevokedAt = null;
    // NOTE: expiry is managed by the caller (ensure/rotate/setExpiry); we do not
    // silently impose one here so "permanent unless explicitly chosen" holds.
    // We intentionally do NOT log the token value (Phase 10).
    this.logger.log('Public capability token (re)generated');
  }

  private safeEquals(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }
}
