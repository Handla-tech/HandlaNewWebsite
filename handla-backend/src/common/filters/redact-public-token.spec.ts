import { redactPublicToken } from './http-exception.filter';

/**
 * INFO-01 Phase 10 — token/URL log redaction regression.
 * Proves no public capability token survives into logs or error bodies.
 */
describe('redactPublicToken (INFO-01 Phase 10)', () => {
  const T = 'abcDEF123_-ghiJKL456mnoPQR789stuVWX012yz';

  it('masks the unified /public/token/:token segment for all three doc types', () => {
    for (const type of ['invoices', 'quotations', 'contracts']) {
      const out = redactPublicToken(`/erp/${type}/public/token/${T}`);
      expect(out).toBe(`/erp/${type}/public/token/[REDACTED]`);
      expect(out).not.toContain(T);
    }
  });

  it('masks the legacy /quotations/public/:token read + action routes', () => {
    expect(redactPublicToken(`/erp/quotations/public/${T}`)).toBe(
      '/erp/quotations/public/[REDACTED]',
    );
    expect(redactPublicToken(`/erp/quotations/public/${T}/accept`)).not.toContain(T);
    expect(redactPublicToken(`/erp/quotations/public/${T}/reject`)).not.toContain(T);
  });

  it('preserves a trailing query string but still masks the token', () => {
    const out = redactPublicToken(`/erp/invoices/public/token/${T}?x=1`);
    expect(out).toBe('/erp/invoices/public/token/[REDACTED]?x=1');
    expect(out).not.toContain(T);
  });

  it('leaves unrelated URLs untouched', () => {
    expect(redactPublicToken('/erp/invoices/123')).toBe('/erp/invoices/123');
    expect(redactPublicToken('')).toBe('');
  });
});
