/**
 * INFO-01 Phase 12 — robots / indexing regression.
 *
 * Public capability document pages (invoice / quotation / contract) must never
 * be crawled or advertised. These tests lock in three guarantees so they cannot
 * silently regress:
 *   1. The dynamic robots.ts disallows the three public document route families.
 *   2. The static public/robots.txt disallows the same families.
 *   3. The sitemap never contains a public capability URL.
 */
import * as fs from 'fs';
import * as path from 'path';
import robots from '../app/robots';
import sitemap from '../app/sitemap';

const PUBLIC_DOC_FAMILIES = [
  '/invoice/public/',
  '/quotation/public/',
  '/contract/public/',
];

describe('INFO-01 Phase 12 — robots.ts (dynamic)', () => {
  it('disallows every public document route family', () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = ([] as string[]).concat((rule as any).disallow ?? []);
    for (const fam of PUBLIC_DOC_FAMILIES) {
      expect(disallow).toContain(fam);
    }
  });

  it('still disallows the pre-existing private areas (no regression)', () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = ([] as string[]).concat((rule as any).disallow ?? []);
    for (const fam of ['/auth', '/dashboard/', '/admin/', '/erp/', '/api/']) {
      expect(disallow).toContain(fam);
    }
  });
});

describe('INFO-01 Phase 12 — public/robots.txt (static, served)', () => {
  const txt = fs.readFileSync(
    path.join(process.cwd(), 'public', 'robots.txt'),
    'utf8',
  );

  it('disallows every public document route family', () => {
    for (const fam of PUBLIC_DOC_FAMILIES) {
      expect(txt).toContain(`Disallow: ${fam}`);
    }
  });
});

describe('INFO-01 Phase 12 — sitemap.ts', () => {
  const entries = sitemap();

  it('never lists a public capability document URL', () => {
    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/(invoice|quotation|contract)\/public\//);
    }
  });

  it('only advertises genuine marketing/product routes', () => {
    // Sanity: at least the localized home pages are present.
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/(erp|dashboard|admin|api|auth)(\/|$)/);
    }
  });
});
