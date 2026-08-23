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

    // ─── CSP-FIX regression (Google Fonts + S3 upload) ──────────────────────
    // Chat attachment uploads (browser-direct presigned PUT) and the Space
    // Grotesk Google Fonts stylesheet were blocked by a too-narrow CSP. These
    // assertions pin the exact origins so the fix cannot silently regress.
    const S3_ORIGIN = 'https://handla-uploads.s3.eu-north-1.amazonaws.com';
    const GOOGLE_FONTS_STYLESHEET = 'https://fonts.googleapis.com';
    const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';

    function directive(name: string): string {
      return csp.split(';').find((d) => d.trim().startsWith(`${name} `) || d.trim() === name) || '';
    }

    it('allows the Google Fonts stylesheet origin where styles are permitted', () => {
      const styleSrc = directive('style-src');
      expect(styleSrc).toContain("'self'");
      expect(styleSrc).toContain("'unsafe-inline'");
      expect(styleSrc).toContain(GOOGLE_FONTS_STYLESHEET);
    });

    it('allows the Google Fonts file origin (fonts.gstatic.com) in font-src', () => {
      const fontSrc = directive('font-src');
      expect(fontSrc).toContain("'self'");
      expect(fontSrc).toContain(GOOGLE_FONTS_FILES);
    });

    it('allows the exact S3 upload bucket origin in connect-src (presigned PUT)', () => {
      const connectSrc = directive('connect-src');
      expect(connectSrc).toContain(S3_ORIGIN);
    });

    it('allows the exact S3 upload bucket origin in img-src (attachment display)', () => {
      const imgSrc = directive('img-src');
      expect(imgSrc).toContain(S3_ORIGIN);
      expect(imgSrc).toContain("'self'");
      expect(imgSrc).toContain('data:');
      expect(imgSrc).toContain('blob:');
    });

    it('restricts img-src to the EXACT bucket only — no broad *.amazonaws.com', () => {
      const imgSrc = directive('img-src');
      // Narrowest-origin principle: the previous broad wildcard is gone.
      expect(imgSrc).not.toContain('*.amazonaws.com');
      // And certainly not an open wildcard.
      expect(imgSrc).not.toMatch(/img-src[^;]*\s\*(\s|$)/);
    });

    it('does NOT allow unsafe-eval in script-src', () => {
      const scriptSrc = directive('script-src');
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    // ─── Anti-broadening guardrails ─────────────────────────────────────────
    // Prove the fix did not open the policy up in dangerous ways.
    it('does NOT become overly permissive (no wildcard connect/style/default/img)', () => {
      // No bare `*` as a full source in any of these directives.
      expect(csp).not.toMatch(/connect-src[^;]*\s\*(\s|;|$)/);
      expect(csp).not.toMatch(/style-src[^;]*\s\*(\s|;|$)/);
      expect(csp).not.toMatch(/img-src[^;]*\s\*(\s|;|$)/);
      // default-src stays exactly 'self'.
      expect(directive('default-src').trim()).toBe("default-src 'self'");
      // No scheme-only wildcards like `https:` opening every origin.
      expect(directive('connect-src')).not.toMatch(/\shttps:(\s|;|$)/);
      expect(directive('style-src')).not.toMatch(/\shttps:(\s|;|$)/);
      // No unsafe-eval anywhere in the policy.
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it('preserves the core hardening directives unchanged', () => {
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain('upgrade-insecure-requests');
    });
  });
});
