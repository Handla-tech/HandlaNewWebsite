/**
 * INFO-01 — public-doc.config secure-default regression.
 *
 * Pins the hardened behaviour: legacy raw-id public links are OFF unless an
 * operator explicitly opts in with PUBLIC_DOC_LEGACY_ID_LINKS=true. This guards
 * against a future regression that silently re-opens the enumerable raw-UUID
 * public-access surface.
 */
import publicDocConfig from './public-doc.config';

describe('publicDoc.config — legacyIdLinks secure default', () => {
  const KEY = 'PUBLIC_DOC_LEGACY_ID_LINKS';
  const orig = process.env[KEY];
  afterEach(() => {
    if (orig === undefined) delete process.env[KEY];
    else process.env[KEY] = orig;
  });

  it('defaults to FALSE when the env var is unset', () => {
    delete process.env[KEY];
    expect(publicDocConfig().legacyIdLinks).toBe(false);
  });

  it('is FALSE for empty string', () => {
    process.env[KEY] = '';
    expect(publicDocConfig().legacyIdLinks).toBe(false);
  });

  it('is FALSE for the literal "false"', () => {
    process.env[KEY] = 'false';
    expect(publicDocConfig().legacyIdLinks).toBe(false);
  });

  it('is TRUE only for the explicit literal "true" opt-in', () => {
    process.env[KEY] = 'true';
    expect(publicDocConfig().legacyIdLinks).toBe(true);
  });

  it('is FALSE for any other truthy-looking value (no accidental enable)', () => {
    for (const v of ['TRUE', '1', 'yes', 'on', 'enabled']) {
      process.env[KEY] = v;
      expect(publicDocConfig().legacyIdLinks).toBe(false);
    }
  });

  it('defaultExpiryDays parses to a number, 0 when unset', () => {
    delete process.env.PUBLIC_DOC_DEFAULT_EXPIRY_DAYS;
    expect(publicDocConfig().defaultExpiryDays).toBe(0);
    process.env.PUBLIC_DOC_DEFAULT_EXPIRY_DAYS = '30';
    expect(publicDocConfig().defaultExpiryDays).toBe(30);
    delete process.env.PUBLIC_DOC_DEFAULT_EXPIRY_DAYS;
  });
});
