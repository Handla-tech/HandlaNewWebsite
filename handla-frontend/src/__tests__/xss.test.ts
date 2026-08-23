/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PENTEST — XSS (JSON-LD sink hardening + CSP backstop) — frontend
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Handla renders ALL user-influenced content (chat messages, project titles,
 * profile fields, testimonials) through React JSX `{value}` interpolation,
 * which HTML-escapes by default — there is exactly ONE dangerouslySetInnerHTML
 * in the codebase (JsonLd), and it is fed only static schema data today.
 *
 * Per the brief ("do not rely exclusively on React escaping"), we:
 *   XSS-01  prove the JsonLd sink is hardened: a `</script>`/tag-breakout
 *           payload is neutralised, and when injected into a real DOM <script>
 *           it creates NO extra element / executes nothing.
 *   XSS-02  re-assert the CSP directives that form the runtime XSS backstop
 *           (no unsafe-eval, object-src none, base-uri self, frame-ancestors none).
 */
import { safeJsonLd } from '@/lib/json-ld';

// Load the real next.config.js to inspect the emitted CSP (same source as prod).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require('../../next.config.js');

describe('PENTEST — XSS: JsonLd sink (XSS-01)', () => {
  it('escapes < > & so a </script> breakout cannot occur', () => {
    const evil = {
      name: '</script><img src=x onerror=alert(1)>',
      note: 'a & b < c > d',
    };
    const out = safeJsonLd(evil);
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    // Raw ampersands are escaped too (defence against entity tricks).
    expect(out).not.toMatch(/&(?!amp;)/); // no bare & left (all are \u0026)
    expect(out).toContain('\\u003c');
    expect(out).toContain('\\u003e');
  });

  it('escapes U+2028 / U+2029 line separators', () => {
    const out = safeJsonLd({ x: 'line1\u2028line2\u2029end' });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
  });

  it('remains valid JSON after escaping (round-trips)', () => {
    const data = { a: '</script>', b: 'x & y', c: 1, nested: { d: '<b>' } };
    const escaped = safeJsonLd(data);
    // The browser JSON parser decodes \u003c etc back to the original chars.
    expect(JSON.parse(escaped)).toEqual(data);
  });

  it('runtime DOM: injecting the escaped payload creates NO extra element', () => {
    // Simulate exactly what <JsonLd> does: put the escaped string inside a
    // <script type="application/ld+json"> via innerHTML and confirm the DOM did
    // not spawn an <img>/<script> breakout element.
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    const host = document.createElement('div');
    host.appendChild(script);
    document.body.appendChild(host);

    script.innerHTML = safeJsonLd({ name: '</script><img src=x onerror="alert(1)">' });

    expect(host.querySelectorAll('img').length).toBe(0);
    expect(host.querySelectorAll('script').length).toBe(1); // only our own
    document.body.removeChild(host);
  });
});

describe('PENTEST — XSS: CSP backstop (XSS-02)', () => {
  let csp: string;

  beforeAll(async () => {
    const headers = await nextConfig.headers();
    const rule = headers.find((h: any) => h.source === '/:path*');
    const cspHeader = rule.headers.find(
      (h: any) => h.key === 'Content-Security-Policy',
    );
    csp = cspHeader.value as string;
  });

  it('has no unsafe-eval in script-src (blocks eval-based XSS)', () => {
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) || '';
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it('object-src none (blocks <object>/<embed> plugin XSS)', () => {
    expect(csp).toMatch(/object-src\s+'none'/);
  });

  it('base-uri self (blocks <base> tag hijack)', () => {
    expect(csp).toMatch(/base-uri\s+'self'/);
  });

  it('frame-ancestors none (blocks clickjacking/UI-redress)', () => {
    expect(csp).toMatch(/frame-ancestors\s+'none'/);
  });

  it('img-src has no wildcard * (limits data-exfil via image beacons)', () => {
    const imgSrc = csp.split(';').find((d) => d.trim().startsWith('img-src')) || '';
    expect(imgSrc).not.toMatch(/\*(?!\.)/); // no bare * (scoped *.host is fine)
  });
});
