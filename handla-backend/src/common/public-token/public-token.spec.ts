import { NotFoundException, GoneException } from '@nestjs/common';

import { PublicTokenService } from './public-token.service';
import {
  generatePublicToken,
  isWellFormedPublicToken,
  PUBLIC_TOKEN_BYTES,
} from './public-token.util';
import { PublicTokenColumns, PublicTokenState } from './public-token.types';

/**
 * INFO-01 — Baseline security tests for the shared public capability-token
 * model. Covers generation entropy/shape, structural validation, and the full
 * lifecycle: generate → rotate (old dies) → revoke → expiry, using fake timers
 * (no sleeps).
 */

function blankEntity(): PublicTokenColumns {
  return {
    publicToken: null,
    publicTokenExpiresAt: null,
    publicTokenRevokedAt: null,
    publicTokenCreatedAt: null,
  };
}

describe('generatePublicToken()', () => {
  it('produces 256-bit base64url tokens (43 chars, url-safe charset)', () => {
    for (let i = 0; i < 50; i++) {
      const t = generatePublicToken();
      // 32 bytes → ceil(32/3)*4 = 44 with padding; base64url strips '=' → 43.
      expect(t).toHaveLength(43);
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(t).not.toContain('=');
      expect(t).not.toContain('+');
      expect(t).not.toContain('/');
    }
  });

  it('uses 32 random bytes of entropy', () => {
    expect(PUBLIC_TOKEN_BYTES).toBe(32);
  });

  it('is non-sequential / unique across many generations (no collisions)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generatePublicToken());
    expect(seen.size).toBe(5000);
  });

  it('is not derived from any input (two calls differ)', () => {
    expect(generatePublicToken()).not.toEqual(generatePublicToken());
  });
});

describe('isWellFormedPublicToken()', () => {
  it('accepts a generated token and a legacy UUID', () => {
    expect(isWellFormedPublicToken(generatePublicToken())).toBe(true);
    expect(isWellFormedPublicToken('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects malformed / oversized / non-string input', () => {
    expect(isWellFormedPublicToken('')).toBe(false);
    expect(isWellFormedPublicToken('short')).toBe(false); // < 16
    expect(isWellFormedPublicToken('a'.repeat(65))).toBe(false); // > 64
    expect(isWellFormedPublicToken('has spaces here!!')).toBe(false);
    expect(isWellFormedPublicToken('inject;drop--table--x')).toBe(false);
    expect(isWellFormedPublicToken(null as unknown as string)).toBe(false);
    expect(isWellFormedPublicToken(undefined as unknown as string)).toBe(false);
    expect(isWellFormedPublicToken(12345 as unknown as string)).toBe(false);
  });
});

describe('PublicTokenService lifecycle', () => {
  let svc: PublicTokenService;

  beforeEach(() => {
    svc = new PublicTokenService();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ensureToken generates a token when none exists', () => {
    const e = blankEntity();
    const created = svc.ensureToken(e);
    expect(created).toBe(true);
    expect(e.publicToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(e.publicTokenCreatedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(e.publicTokenRevokedAt).toBeNull();
    expect(svc.classify(e)).toBe(PublicTokenState.ACTIVE);
  });

  it('ensureToken is idempotent for an already-active token', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    const first = e.publicToken;
    const created2 = svc.ensureToken(e);
    expect(created2).toBe(false);
    expect(e.publicToken).toBe(first);
  });

  it('rotateToken issues a new token and the OLD one immediately fails', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    const tokenA = e.publicToken as string;
    expect(svc.match(e, tokenA)).toBe(PublicTokenState.ACTIVE);

    svc.rotateToken(e);
    const tokenB = e.publicToken as string;

    expect(tokenB).not.toBe(tokenA);
    // Old token A no longer matches → NOT_FOUND (safe).
    expect(svc.match(e, tokenA)).toBe(PublicTokenState.NOT_FOUND);
    // New token B works.
    expect(svc.match(e, tokenB)).toBe(PublicTokenState.ACTIVE);
  });

  it('revokeToken causes the token to be REVOKED immediately', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    const token = e.publicToken as string;
    svc.revokeToken(e);
    expect(e.publicTokenRevokedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(svc.match(e, token)).toBe(PublicTokenState.REVOKED);
  });

  it('setExpiry + fake clock: token EXPIRES after the deadline', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    const token = e.publicToken as string;
    svc.setExpiry(e, new Date('2026-01-01T01:00:00.000Z')); // +1h

    // Before expiry.
    expect(svc.match(e, token)).toBe(PublicTokenState.ACTIVE);

    // Advance past expiry.
    jest.setSystemTime(new Date('2026-01-01T01:00:00.001Z'));
    expect(svc.match(e, token)).toBe(PublicTokenState.EXPIRED);
  });

  it('null expiry = permanent (never expires)', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    const token = e.publicToken as string;
    svc.setExpiry(e, null);
    jest.setSystemTime(new Date('2099-01-01T00:00:00.000Z'));
    expect(svc.match(e, token)).toBe(PublicTokenState.ACTIVE);
  });

  it('ensureToken on a revoked entity re-issues a fresh, clean token', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    svc.revokeToken(e);
    expect(svc.classify(e)).toBe(PublicTokenState.REVOKED);

    const created = svc.ensureToken(e); // regenerate after revoke
    expect(created).toBe(true);
    expect(e.publicTokenRevokedAt).toBeNull();
    expect(svc.classify(e)).toBe(PublicTokenState.ACTIVE);
  });
});

describe('PublicTokenService.assertActive() → HTTP mapping', () => {
  let svc: PublicTokenService;

  beforeEach(() => {
    svc = new PublicTokenService();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('passes for an active matching token', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    expect(() => svc.assertActive(e, e.publicToken as string)).not.toThrow();
  });

  it('404 for a malformed token (no DB oracle)', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    expect(() => svc.assertActive(e, 'bad')).toThrow(NotFoundException);
  });

  it('404 for a wrong (rotated-away) token — does NOT reveal the record exists', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    const old = e.publicToken as string;
    svc.rotateToken(e);
    expect(() => svc.assertActive(e, old)).toThrow(NotFoundException);
  });

  it('404 when entity is null (unknown token)', () => {
    expect(() => svc.assertActive(null, generatePublicToken())).toThrow(NotFoundException);
  });

  it('410 Gone for a revoked token', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    const token = e.publicToken as string;
    svc.revokeToken(e);
    expect(() => svc.assertActive(e, token)).toThrow(GoneException);
  });

  it('410 Gone for an expired token', () => {
    const e = blankEntity();
    svc.ensureToken(e);
    const token = e.publicToken as string;
    svc.setExpiry(e, new Date('2026-01-01T00:30:00.000Z'));
    jest.setSystemTime(new Date('2026-01-01T00:30:00.001Z'));
    expect(() => svc.assertActive(e, token)).toThrow(GoneException);
  });
});
