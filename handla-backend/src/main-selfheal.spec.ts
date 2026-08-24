/**
 * MySQL runtime/migrator split — runtime schema self-heal gating.
 *
 * The runtime DDL self-heal (idempotent ALTER/CREATE) must be SKIPPED in
 * production (migrations are authoritative, runtime user is DML-only) unless
 * RUNTIME_SCHEMA_SELFHEAL=true is explicitly set for exceptional recovery.
 */
import { shouldRunSchemaSelfHeal } from './main';

describe('shouldRunSchemaSelfHeal', () => {
  it('runs in development (undefined flag)', () => {
    expect(shouldRunSchemaSelfHeal('development', undefined)).toBe(true);
  });

  it('runs in test env', () => {
    expect(shouldRunSchemaSelfHeal('test', undefined)).toBe(true);
  });

  it('runs when NODE_ENV is unset', () => {
    expect(shouldRunSchemaSelfHeal(undefined, undefined)).toBe(true);
  });

  it('is SKIPPED in production by default (runtime user is DML-only)', () => {
    expect(shouldRunSchemaSelfHeal('production', undefined)).toBe(false);
    expect(shouldRunSchemaSelfHeal('production', 'false')).toBe(false);
    expect(shouldRunSchemaSelfHeal('production', '')).toBe(false);
  });

  it('only the explicit recovery opt-in re-enables it in production', () => {
    expect(shouldRunSchemaSelfHeal('production', 'true')).toBe(true);
    // Any other truthy-looking value stays disabled (fail-safe).
    expect(shouldRunSchemaSelfHeal('production', '1')).toBe(false);
    expect(shouldRunSchemaSelfHeal('production', 'yes')).toBe(false);
    expect(shouldRunSchemaSelfHeal('production', 'TRUE')).toBe(false);
  });
});
