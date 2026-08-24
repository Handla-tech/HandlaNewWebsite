/**
 * MySQL runtime/migrator split — migration DataSource credential resolution.
 *
 * The migration DataSource (used by entrypoint.sh migration step + `typeorm`
 * CLI) must prefer the dedicated migrator identity (DDL privileges) and fall
 * back to the runtime DATABASE_USER only when the migrator vars are unset. This
 * guarantees the production runtime process (`node dist/main`) can authenticate
 * as a DML-only user while migrations run under a separate DDL user.
 *
 * We test the pure `resolveMigrationCredentials` helper with an explicit env
 * map so the assertions are deterministic and do not depend on a loaded `.env`.
 */
import { resolveMigrationCredentials } from './data-source';

describe('resolveMigrationCredentials (migrator/runtime split)', () => {
  it('uses the migrator identity when DATABASE_MIGRATION_USER is set', () => {
    const creds = resolveMigrationCredentials({
      DATABASE_USER: 'handla_runtime',
      DATABASE_PASSWORD: 'runtime-pw',
      DATABASE_MIGRATION_USER: 'handla_migrator',
      DATABASE_MIGRATION_PASSWORD: 'migrator-pw',
    });
    expect(creds.username).toBe('handla_migrator');
    expect(creds.password).toBe('migrator-pw');
  });

  it('falls back to the runtime user when migrator vars are unset (back-compat)', () => {
    const creds = resolveMigrationCredentials({
      DATABASE_USER: 'handla_runtime',
      DATABASE_PASSWORD: 'runtime-pw',
    });
    expect(creds.username).toBe('handla_runtime');
    expect(creds.password).toBe('runtime-pw');
  });

  it('uses migrator user but runtime password when only the migrator user is set', () => {
    const creds = resolveMigrationCredentials({
      DATABASE_USER: 'handla_runtime',
      DATABASE_PASSWORD: 'shared-pw',
      DATABASE_MIGRATION_USER: 'handla_migrator',
      // DATABASE_MIGRATION_PASSWORD intentionally unset
    });
    expect(creds.username).toBe('handla_migrator');
    expect(creds.password).toBe('shared-pw');
  });

  it('defaults username to root and password to undefined when nothing is configured', () => {
    const creds = resolveMigrationCredentials({});
    expect(creds.username).toBe('root');
    expect(creds.password).toBeUndefined();
  });

  it('never returns the runtime identity when a distinct migrator identity is provided', () => {
    const creds = resolveMigrationCredentials({
      DATABASE_USER: 'handla_runtime',
      DATABASE_PASSWORD: 'runtime-pw',
      DATABASE_MIGRATION_USER: 'handla_migrator',
      DATABASE_MIGRATION_PASSWORD: 'migrator-pw',
    });
    expect(creds.username).not.toBe('handla_runtime');
    expect(creds.password).not.toBe('runtime-pw');
  });

  it('empty-string migrator user is treated as unset (falls back to runtime)', () => {
    const creds = resolveMigrationCredentials({
      DATABASE_USER: 'handla_runtime',
      DATABASE_PASSWORD: 'runtime-pw',
      DATABASE_MIGRATION_USER: '',
      DATABASE_MIGRATION_PASSWORD: '',
    });
    expect(creds.username).toBe('handla_runtime');
    expect(creds.password).toBe('runtime-pw');
  });
});
