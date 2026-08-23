/**
 * PENTEST regression (FE-01) — Next.js response security headers.
 *
 * The HTML documents served by Next.js previously carried NO security headers
 * (only the API had helmet). This test loads the real next.config.js and asserts
 * the headers() config emits a complete, safe header set for every route, so the
 * protection cannot silently regress.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require('../../next.config.js');

describe('FE-01 — Next.js security headers', () => {
  let headerMap: Record<string, string>;

  beforeAll(async () => {
    const rules = await nextConfig.headers();
    // Applies to every route.
    const all = rules.find((r: any) => r.source === '/:path*');
    expect(all).toBeDefined();
    headerMap = Object.fromEntries(all.headers.map((h: any) => [h.key.toLowerCase(), h.value]));
  });

  it('applies headers to every route via /:path*', () => {
    expect(headerMap).toBeTruthy();
  });

  it('sets X-Frame-Options: DENY (clickjacking)', () => {
    expect(headerMap['x-frame-options']).toBe('DENY');
  });

  it('sets X-Content-Type-Options: nosniff', () => {
    expect(headerMap['x-content-type-options']).toBe('nosniff');
  });

  it('sets a strict Referrer-Policy', () => {
    expect(headerMap['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('sets a Permissions-Policy that disables sensitive features', () => {
    const pp = headerMap['permissions-policy'];
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
  });

  it('sets HSTS with a 1-year max-age + preload', () => {
    const hsts = headerMap['strict-transport-security'];
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  describe('Content-Security-Policy', () => {
    let csp: string;
    beforeAll(() => { csp = headerMap['content-security-policy']; });

    it('is present', () => {
      expect(csp).toBeTruthy();
    });

    it("defaults to 'self'", () => {
      expect(csp).toContain("default-src 'self'");
    });

    it("blocks framing (frame-ancestors 'none') and objects", () => {
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });

    it("locks base-uri and form-action to 'self'", () => {
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });

    it('allows the API + WebSocket origins in connect-src', () => {
      expect(csp).toMatch(/connect-src[^;]*'self'/);
      expect(csp).toMatch(/connect-src[^;]*ws:/);
      expect(csp).toMatch(/connect-src[^;]*wss:/);
    });

    it('restricts img-src to self/data/blob/S3 only (no wildcard *)', () => {
      const imgSrc = csp.split(';').find((d) => d.trim().startsWith('img-src')) || '';
      expect(imgSrc).toContain("'self'");
      expect(imgSrc).toContain('https://*.amazonaws.com');
      // Must NOT be an open wildcard.
      expect(imgSrc).not.toMatch(/img-src[^;]*\s\*(\s|$)/);
    });

    it('does NOT allow unsafe-eval in script-src', () => {
      const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) || '';
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });
  });
});
