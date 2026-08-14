/**
 * Ensures the centralized bcrypt cost factor stays at a safe baseline and
 * honours the BCRYPT_ROUNDS override.
 */
describe('security.constants — BCRYPT_ROUNDS', () => {
  const original = process.env.BCRYPT_ROUNDS;

  afterEach(() => {
    if (original === undefined) delete process.env.BCRYPT_ROUNDS;
    else process.env.BCRYPT_ROUNDS = original;
    jest.resetModules();
  });

  it('defaults to 12 (OWASP baseline) when unset', () => {
    delete process.env.BCRYPT_ROUNDS;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BCRYPT_ROUNDS } = require('../security.constants');
    expect(BCRYPT_ROUNDS).toBe(12);
  });

  it('is never weaker than 10', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BCRYPT_ROUNDS } = require('../security.constants');
    expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(10);
  });

  it('honours the BCRYPT_ROUNDS override', () => {
    process.env.BCRYPT_ROUNDS = '14';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BCRYPT_ROUNDS } = require('../security.constants');
    expect(BCRYPT_ROUNDS).toBe(14);
  });
});
