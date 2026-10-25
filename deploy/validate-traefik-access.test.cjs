'use strict';

/**
 * validate-traefik-access.test.cjs
 *
 * Automated regression test suite for deploy/validate-traefik-access.cjs.
 *
 * Tests:
 *  - Positive: valid Full Access configuration passes
 *  - Negative: each category of mutation is rejected
 *
 * Requirements:
 *  - Runnable on a fresh checkout (only requires Node.js + Docker)
 *  - No dependency on /tmp or developer-specific paths
 *  - Uses synthetic secrets only (DATABASE_USER=handla_runtime etc.)
 *  - Does NOT contact production services
 *  - Tests Compose-to-validator integration (baseline comes from docker compose config)
 *  - Tests configuration producer failures
 *  - Tests forbidden router and middleware changes
 *  - Validates redirect behavior, TLS policy, rate limiting, and network config
 */

const assert = require('node:assert/strict');
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// ─── Locate repo root relative to this file ──────────────────────────────────
// Avoids any dependency on cwd or developer-specific paths.
const REPO_ROOT = path.resolve(__dirname, '..');
const VALIDATOR = path.join(REPO_ROOT, 'deploy', 'validate-traefik-access.cjs');
const COMPOSE_BASE = path.join(REPO_ROOT, 'docker-compose.yml');
const COMPOSE_TRAEFIK = path.join(REPO_ROOT, 'deploy', 'docker-compose.traefik.yml');
const COMPOSE_FULL_ACCESS = path.join(REPO_ROOT, 'deploy', 'docker-compose.full-access.yml');
const BACKEND_ENV = path.join(REPO_ROOT, 'handla-backend', '.env');

// If handla-backend/.env is missing (e.g. clean checkout in CI), create a temporary
// synthetic file for Compose interpolation, and clean it up on process exit.
let createdSyntheticBackendEnv = false;
if (!fs.existsSync(BACKEND_ENV)) {
  fs.writeFileSync(BACKEND_ENV, '# synthetic non-sensitive env for local/CI test validation\nPORT=3001\nDATABASE_NAME=handla_db\n', { encoding: 'utf8', mode: 0o600 });
  createdSyntheticBackendEnv = true;
}

// Ensure cleanup of synthetic env file on exit if created by this process
function cleanupSyntheticEnv() {
  if (createdSyntheticBackendEnv && fs.existsSync(BACKEND_ENV)) {
    try {
      fs.unlinkSync(BACKEND_ENV);
    } catch (_) {}
  }
}
process.on('exit', cleanupSyntheticEnv);
process.on('SIGINT', () => { cleanupSyntheticEnv(); process.exit(130); });
process.on('SIGTERM', () => { cleanupSyntheticEnv(); process.exit(143); });

// ─── Synthetic secrets — never real credentials ───────────────────────────────
const SYNTHETIC_ENV = {
  ...process.env,
  DATABASE_USER:          'handla_runtime',
  DATABASE_PASSWORD:      'local_test_only_not_real',
  DATABASE_ROOT_PASSWORD: 'local_test_only_not_real',
  REDIS_PASSWORD:         'local_test_only_not_real',
};

// ─── Build the baseline merged Compose config ─────────────────────────────────
// This integration-tests the full Compose file stack, verifying that the
// three files merge into the expected effective configuration.
console.log('Building baseline from docker compose config...');
let baseline;
try {
  const raw = execFileSync(
    'docker',
    [
      'compose',
      '--env-file', '/dev/null',
      '-f', COMPOSE_BASE,
      '-f', COMPOSE_TRAEFIK,
      '-f', COMPOSE_FULL_ACCESS,
      'config', '--format', 'json',
    ],
    {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      env: SYNTHETIC_ENV,
    }
  );
  baseline = JSON.parse(raw);
} catch (err) {
  console.error('FATAL: Failed to build baseline from docker compose config:', err.message);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Run the validator with the given config object on stdin.
 * Returns { status, stdout, stderr }.
 */
function runValidator(config) {
  return spawnSync(
    process.execPath,
    [VALIDATOR],
    {
      input: JSON.stringify(config),
      encoding: 'utf8',
      cwd: REPO_ROOT,
    }
  );
}

/**
 * Deep clone baseline and mutate a single label on a service.
 * Works for both array and object label formats.
 */
function mutateLabelValue(serviceName, key, newValue) {
  const config = JSON.parse(JSON.stringify(baseline));
  const raw = config.services[serviceName].labels;

  if (Array.isArray(raw)) {
    const prefix = `${key}=`;
    // Remove existing entry for this key (if any), then add the new value
    const filtered = raw.filter(item => !item.startsWith(`${key}=`));
    filtered.push(`${key}=${newValue}`);
    config.services[serviceName].labels = filtered;
  } else {
    config.services[serviceName].labels = { ...raw, [key]: newValue };
  }

  return config;
}

/**
 * Deep clone baseline and add a new label (no existing entry removed).
 * Used to test "unexpected extra label" rejection.
 */
function addLabel(serviceName, key, value) {
  const config = JSON.parse(JSON.stringify(baseline));
  const raw = config.services[serviceName].labels;

  if (Array.isArray(raw)) {
    config.services[serviceName].labels = [...raw, `${key}=${value}`];
  } else {
    config.services[serviceName].labels = { ...raw, [key]: value };
  }

  return config;
}

/**
 * Deep clone baseline and remove a label entirely.
 * Used to test "missing required label" rejection.
 */
function removeLabel(serviceName, key) {
  const config = JSON.parse(JSON.stringify(baseline));
  const raw = config.services[serviceName].labels;

  if (Array.isArray(raw)) {
    config.services[serviceName].labels = raw.filter(item => !item.startsWith(`${key}=`));
  } else {
    const labels = { ...raw };
    delete labels[key];
    config.services[serviceName].labels = labels;
  }

  return config;
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expectPass(name, config) {
  const result = runValidator(config);
  if (result.status === 0) {
    console.log(`PASS: ${name}`);
    passed++;
  } else {
    console.error(`FAIL: ${name} — expected pass but got exit ${result.status}`);
    console.error('  stderr:', result.stderr?.trim());
    failed++;
  }
}

function expectFail(name, config) {
  const result = runValidator(config);
  if (result.status !== 0) {
    console.log(`PASS: ${name} rejected`);
    passed++;
  } else {
    console.error(`FAIL: ${name} — was incorrectly accepted (exit 0)`);
    console.error('  stdout:', result.stdout?.trim());
    failed++;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Positive: valid baseline must pass
expectPass('valid Full Access configuration', baseline);

// ── TLS / HTTPS policy ────────────────────────────────────────────────────────
expectFail('disabled TLS on API',
  mutateLabelValue('api', 'traefik.http.routers.handla-api.tls', 'false'));

expectFail('disabled TLS on web',
  mutateLabelValue('web', 'traefik.http.routers.handla-web.tls', 'false'));

expectFail('wrong entrypoint on API',
  mutateLabelValue('api', 'traefik.http.routers.handla-api.entrypoints', 'web'));

expectFail('missing certresolver on API',
  mutateLabelValue('api', 'traefik.http.routers.handla-api.tls.certresolver', ''));

// ── Host rules ────────────────────────────────────────────────────────────────
expectFail('wrong API Host rule',
  mutateLabelValue('api', 'traefik.http.routers.handla-api.rule', 'Host(`api.handla.net`)'));

expectFail('wrong web Host rule',
  mutateLabelValue('web', 'traefik.http.routers.handla-web.rule', 'Host(`handla.net`)'));

// ── Traefik exposure ──────────────────────────────────────────────────────────
expectFail('traefik.enable=false on API',
  mutateLabelValue('api', 'traefik.enable', 'false'));

expectFail('traefik.enable=false on web',
  mutateLabelValue('web', 'traefik.enable', 'false'));

// ── Docker network ────────────────────────────────────────────────────────────
expectFail('wrong Docker network on API',
  mutateLabelValue('api', 'traefik.docker.network', 'other-network'));

expectFail('wrong Docker network on web',
  mutateLabelValue('web', 'traefik.docker.network', 'internal'));

// ── Backend service ports ─────────────────────────────────────────────────────
expectFail('wrong API service port',
  mutateLabelValue('api', 'traefik.http.services.handla-api.loadbalancer.server.port', '9999'));

expectFail('wrong web service port',
  mutateLabelValue('web', 'traefik.http.services.handla-web.loadbalancer.server.port', '8080'));

// ── Rate limiting ─────────────────────────────────────────────────────────────
expectFail('API rate limit average too high',
  mutateLabelValue('api', 'traefik.http.middlewares.handla-api-ratelimit.ratelimit.average', '999'));

expectFail('API rate limit average removed',
  removeLabel('api', 'traefik.http.middlewares.handla-api-ratelimit.ratelimit.average'));

expectFail('API rate limit burst changed',
  mutateLabelValue('api', 'traefik.http.middlewares.handla-api-ratelimit.ratelimit.burst', '200'));

expectFail('API ratelimit.period introduced (changes semantics)',
  addLabel('api', 'traefik.http.middlewares.handla-api-ratelimit.ratelimit.period', '1h'));

// ── Router middlewares ────────────────────────────────────────────────────────
expectFail('API router middleware removed',
  mutateLabelValue('api', 'traefik.http.routers.handla-api.middlewares', ''));

expectFail('web router middleware removed',
  mutateLabelValue('web', 'traefik.http.routers.handla-web.middlewares', ''));

expectFail('quarantine reattached to API router',
  mutateLabelValue('api', 'traefik.http.routers.handla-api.middlewares', 'handla-api-ratelimit,handla-quarantine'));

expectFail('quarantine reattached to web router',
  mutateLabelValue('web', 'traefik.http.routers.handla-web.middlewares', 'handla-www-redirect,handla-quarantine'));

// ── Extra / unexpected routers ────────────────────────────────────────────────
expectFail('extra router on API service',
  addLabel('api', 'traefik.http.routers.handla-bypass.rule', 'Host(`bypass.handla.tech`)'));

expectFail('extra router on web service',
  addLabel('web', 'traefik.http.routers.handla-staging.rule', 'Host(`staging.handla.tech`)'));

// Regression tests: ensure legacy VPS-local routers (handla-public-api, handla-marketing)
// cannot be accidentally reintroduced as secondary routers on api or web.
expectFail('legacy handla-public-api router on API rejected',
  addLabel('api', 'traefik.http.routers.handla-public-api.rule', 'Host(`api.handla.tech`) && PathPrefix(`/api/v1/public`)'));

expectFail('legacy handla-marketing router on web rejected',
  addLabel('web', 'traefik.http.routers.handla-marketing.rule', 'Host(`handla.tech`) && PathPrefix(`/marketing`)'));

// ── Redirect policy (open-redirect prevention) ────────────────────────────────
expectFail('redirect to external domain',
  mutateLabelValue('web', 'traefik.http.middlewares.handla-www-redirect.redirectregex.replacement', 'https://attacker.example/$1'));

expectFail('redirect regex broadened to all traffic',
  mutateLabelValue('web', 'traefik.http.middlewares.handla-www-redirect.redirectregex.regex', '^https://(.*)'));

expectFail('redirect changed to non-permanent',
  mutateLabelValue('web', 'traefik.http.middlewares.handla-www-redirect.redirectregex.permanent', 'false'));

expectFail('redirect permanent label removed',
  removeLabel('web', 'traefik.http.middlewares.handla-www-redirect.redirectregex.permanent'));

// ── Invalid configuration inputs ──────────────────────────────────────────────

// Empty stdin
{
  const result = spawnSync(process.execPath, [VALIDATOR], {
    input: '',
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  if (result.status !== 0) {
    console.log('PASS: empty stdin rejected');
    passed++;
  } else {
    console.error('FAIL: empty stdin was incorrectly accepted');
    failed++;
  }
}

// Invalid JSON
{
  const result = spawnSync(process.execPath, [VALIDATOR], {
    input: 'not-json{',
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  if (result.status !== 0) {
    console.log('PASS: invalid JSON rejected');
    passed++;
  } else {
    console.error('FAIL: invalid JSON was incorrectly accepted');
    failed++;
  }
}

// Missing services key
{
  const result = runValidator({ networks: {} });
  if (result.status !== 0) {
    console.log('PASS: missing services key rejected');
    passed++;
  } else {
    console.error('FAIL: missing services key was incorrectly accepted');
    failed++;
  }
}

// Missing api service
{
  const config = JSON.parse(JSON.stringify(baseline));
  delete config.services.api;
  const result = runValidator(config);
  if (result.status !== 0) {
    console.log('PASS: missing api service rejected');
    passed++;
  } else {
    console.error('FAIL: missing api service was incorrectly accepted');
    failed++;
  }
}

// Missing web service
{
  const config = JSON.parse(JSON.stringify(baseline));
  delete config.services.web;
  const result = runValidator(config);
  if (result.status !== 0) {
    console.log('PASS: missing web service rejected');
    passed++;
  } else {
    console.error('FAIL: missing web service was incorrectly accepted');
    failed++;
  }
}

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`\n[FAIL] ${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll regression tests passed.');
}
