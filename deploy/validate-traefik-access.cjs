'use strict';

/**
 * validate-traefik-access.cjs
 *
 * Fail-closed validator for the Handla Traefik "Full Access" policy.
 * Reads the merged Docker Compose JSON configuration from stdin (produced by
 * `docker compose config --format json`) and exits non-zero with an explicit
 * error message on ANY discrepancy.
 *
 * Invariants enforced:
 *  1. Exactly the expected set of Traefik labels on each service — no extras,
 *     no missing, no altered values.
 *  2. Exactly ONE router per service.
 *  3. TLS enabled on websecure entrypoint with a valid certresolver.
 *  4. Correct Host rules (exact string match).
 *  5. Correct middleware assignment on each router.
 *  6. handla-quarantine is DEFINED (for definition completeness) but NOT
 *     ATTACHED to any router on either service.
 *  7. Correct rate limit average and burst on the API.
 *  8. Permanent www→apex redirect on the web service.
 *  9. Redirect regex and replacement match exactly (prevents open-redirect).
 * 10. Correct Traefik Docker network and backend service ports.
 * 11. traefik.enable=true on both services.
 * 12. No ratelimit.period key on the API rate-limit middleware (period changes
 *     Traefik semantics from "average per second" to "average per period").
 *
 * Tested against Docker Compose v5.1.3 (VPS) and v5.6.0 (local Mac).
 * Both versions produce identical label output for this label set.
 */

const fs = require('node:fs');

function fail(message) {
  console.error(`[traefik-validator] FAIL: ${message}`);
  process.exit(1);
}

/**
 * Parse service labels into a flat key→value map.
 * Handles both array format (['key=value', ...]) and object format ({key: value}).
 * Fails closed on any malformed entry or duplicate key.
 */
function labelsOf(service, name) {
  if (!service) fail(`Missing service: ${name}`);

  const raw = service.labels;
  if (!raw) fail(`Missing labels on service: ${name}`);

  if (Array.isArray(raw)) {
    const labels = {};
    for (const item of raw) {
      if (typeof item !== 'string' || !item.includes('=')) {
        fail(`Invalid label format in ${name}: ${JSON.stringify(item)}`);
      }
      const index = item.indexOf('=');
      const key = item.slice(0, index).trim();
      if (!key) fail(`Empty label key in ${name}: ${JSON.stringify(item)}`);
      if (Object.hasOwn(labels, key)) {
        fail(`Duplicate label key in ${name}: ${key}`);
      }
      labels[key] = item.slice(index + 1);
    }
    return labels;
  }

  if (typeof raw === 'object' && raw !== null) return raw;

  fail(`Unsupported labels format in ${name}: ${typeof raw}`);
}

/**
 * Validate router configuration for a service.
 * Enforces: exactly one router, correct rule, TLS enabled, websecure entrypoint,
 * non-empty certresolver, and correct middleware list.
 */
function checkRouter(labels, serviceName, routerName, expectedRule, expectedMiddlewares) {
  const prefix = `traefik.http.routers.${routerName}.`;

  // Collect all router definitions for this service
  const routerRuleKeys = Object.keys(labels)
    .filter(key => key.startsWith('traefik.http.routers.') && key.endsWith('.rule'));

  if (routerRuleKeys.length === 0) {
    fail(`${serviceName}: no Traefik router defined`);
  }

  if (routerRuleKeys.length !== 1) {
    const routerNames = routerRuleKeys.map(k =>
      k.replace('traefik.http.routers.', '').replace('.rule', ''));
    fail(`${serviceName}: expected exactly 1 router, found ${routerRuleKeys.length}: ${routerNames.join(', ')}`);
  }

  if (routerRuleKeys[0] !== `${prefix}rule`) {
    const actual = routerRuleKeys[0].replace('traefik.http.routers.', '').replace('.rule', '');
    fail(`${serviceName}: unexpected router name '${actual}', expected '${routerName}'`);
  }

  const rule = labels[`${prefix}rule`];
  if (rule !== expectedRule) {
    fail(`${serviceName}: Host rule mismatch\n  expected: ${expectedRule}\n  actual:   ${rule}`);
  }

  if (String(labels[`${prefix}tls`]) !== 'true') {
    fail(`${serviceName}: TLS must be enabled (traefik.http.routers.${routerName}.tls=true)`);
  }

  const entrypoint = labels[`${prefix}entrypoints`];
  if (entrypoint !== 'websecure') {
    fail(`${serviceName}: expected websecure entrypoint, got '${entrypoint}'`);
  }

  const certresolver = labels[`${prefix}tls.certresolver`];
  if (!certresolver || certresolver.trim() === '') {
    fail(`${serviceName}: missing or empty TLS certresolver`);
  }

  const middlewares = labels[`${prefix}middlewares`];
  if (middlewares !== expectedMiddlewares) {
    fail(`${serviceName}: middleware mismatch on router ${routerName}\n  expected: ${expectedMiddlewares}\n  actual:   ${middlewares}`);
  }
}

/**
 * Verify that the quarantine middleware is DEFINED on the service
 * (for configuration completeness / audit trail) but is NOT ATTACHED
 * to any router. The definition existing without attachment is intentional:
 * it keeps the quarantine definition in the merged config as an explicit,
 * auditable marker that the IP allowlist is fully configured but inactive.
 */
function checkQuarantineNotAttached(labels, serviceName) {
  for (const [key, value] of Object.entries(labels)) {
    if (
      key.startsWith('traefik.http.routers.') &&
      key.endsWith('.middlewares')
    ) {
      const middlewareList = String(value).split(',').map(x => x.trim()).filter(Boolean);
      if (middlewareList.includes('handla-quarantine')) {
        fail(`${serviceName}: quarantine middleware is attached to router '${key}' — must be removed before Full Access can be verified`);
      }
    }
  }
}

/**
 * Exact label policy enforcement. Fails if any expected label is missing,
 * any actual Traefik label is unexpected, or any value differs.
 */
function checkExactLabels(serviceName, actualLabels, expectedLabels) {
  const actualKeys = Object.keys(actualLabels)
    .filter(key => key.startsWith('traefik.'))
    .sort();

  const expectedKeys = Object.keys(expectedLabels).sort();

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    const missing = expectedKeys.filter(key => !actualKeys.includes(key));
    const unexpected = actualKeys.filter(key => !expectedKeys.includes(key));
    const parts = [];
    if (missing.length > 0) parts.push(`missing=[${missing.join(', ')}]`);
    if (unexpected.length > 0) parts.push(`unexpected=[${unexpected.join(', ')}]`);
    fail(`${serviceName}: Traefik label set mismatch — ${parts.join('; ')}`);
  }

  for (const [key, expectedValue] of Object.entries(expectedLabels)) {
    const actualValue = String(actualLabels[key]);
    if (actualValue !== expectedValue) {
      fail(`${serviceName}: label '${key}' value mismatch\n  expected: ${expectedValue}\n  actual:   ${actualValue}`);
    }
  }
}

// ─── Main validation ──────────────────────────────────────────────────────────

let rawInput;
try {
  rawInput = fs.readFileSync(0, 'utf8');
} catch (err) {
  fail(`Failed to read stdin: ${err.message}`);
}

if (!rawInput || !rawInput.trim()) {
  fail('Empty or missing Docker Compose JSON on stdin — cannot validate');
}

let config;
try {
  config = JSON.parse(rawInput);
} catch (err) {
  fail(`Failed to parse Docker Compose JSON: ${err.message}`);
}

const services = config?.services;
if (!services || typeof services !== 'object') {
  fail('Docker Compose config is missing the "services" key');
}

const apiService = services.api;
const webService = services.web;

if (!apiService) fail('Missing "api" service in Compose config');
if (!webService) fail('Missing "web" service in Compose config');

const api = labelsOf(apiService, 'api');
const web = labelsOf(webService, 'web');

// ── 1. Router checks ──────────────────────────────────────────────────────────
checkRouter(
  api,
  'api',
  'handla-api',
  'Host(`api.handla.tech`)',
  'handla-api-ratelimit'
);

checkRouter(
  web,
  'web',
  'handla-web',
  'Host(`handla.tech`) || Host(`www.handla.tech`)',
  'handla-www-redirect'
);

// ── 2. Quarantine: defined but NOT attached on either service ─────────────────
checkQuarantineNotAttached(api, 'api');
checkQuarantineNotAttached(web, 'web');

// ── 3. Rate limit checks (API) ────────────────────────────────────────────────
const ratePrefix = 'traefik.http.middlewares.handla-api-ratelimit.ratelimit.';

const rlAverage = String(api[`${ratePrefix}average`]);
if (rlAverage !== '100') {
  fail(`api: rate limit average must be 100, got '${rlAverage}'`);
}

const rlBurst = String(api[`${ratePrefix}burst`]);
if (rlBurst !== '50') {
  fail(`api: rate limit burst must be 50, got '${rlBurst}'`);
}

// Detect presence of ratelimit.period, which changes Traefik semantics from
// "requests per second averaged over a sliding window" to "requests per period".
// An unexpected period key is a policy change that must be reviewed explicitly.
if (Object.hasOwn(api, `${ratePrefix}period`)) {
  fail(`api: unexpected 'ratelimit.period' key detected — this changes rate limit semantics. Review required before deployment.`);
}

// ── 4. Redirect checks (web) ──────────────────────────────────────────────────
const redirectPrefix = 'traefik.http.middlewares.handla-www-redirect.redirectregex.';

const permanent = web[`${redirectPrefix}permanent`];
if (permanent !== 'true' && permanent !== true) {
  fail(`web: www→apex redirect must be permanent (got '${permanent}')`);
}

const regex = web[`${redirectPrefix}regex`];
const expectedRegex = '^https://www\\.handla\\.tech/(.*)';
if (regex !== expectedRegex) {
  fail(`web: redirect regex mismatch\n  expected: ${expectedRegex}\n  actual:   ${regex}`);
}

// $${1} is the Compose-escaped form of Traefik's $1 capture group reference.
// After Docker Compose interpolation the stored value is literally "$${1}".
const replacement = web[`${redirectPrefix}replacement`];
const expectedReplacement = 'https://handla.tech/$${1}';
if (replacement !== expectedReplacement) {
  fail(`web: redirect replacement mismatch (possible open-redirect)\n  expected: ${expectedReplacement}\n  actual:   ${replacement}`);
}

// ── 5. Exact label policy (no unknown keys, no altered values) ────────────────
// This is the most strict check: the complete expected label set for both
// services must match exactly. Any addition, removal, or mutation fails the
// deployment. Maintain this list manually in sync with docker-compose.traefik.yml
// and deploy/docker-compose.full-access.yml.
const expectedLabels = {
  api: {
    'traefik.enable': 'true',
    'traefik.docker.network': 'proxy',
    'traefik.http.routers.handla-api.rule': 'Host(`api.handla.tech`)',
    'traefik.http.routers.handla-api.entrypoints': 'websecure',
    'traefik.http.routers.handla-api.tls': 'true',
    'traefik.http.routers.handla-api.tls.certresolver': 'letsencrypt',
    'traefik.http.routers.handla-api.middlewares': 'handla-api-ratelimit',
    'traefik.http.services.handla-api.loadbalancer.server.port': '3001',
    'traefik.http.middlewares.handla-api-ratelimit.ratelimit.average': '100',
    'traefik.http.middlewares.handla-api-ratelimit.ratelimit.burst': '50',
    // Quarantine definition preserved for audit completeness (not attached to router)
    'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
  },
  web: {
    'traefik.enable': 'true',
    'traefik.docker.network': 'proxy',
    'traefik.http.routers.handla-web.rule': 'Host(`handla.tech`) || Host(`www.handla.tech`)',
    'traefik.http.routers.handla-web.entrypoints': 'websecure',
    'traefik.http.routers.handla-web.tls': 'true',
    'traefik.http.routers.handla-web.tls.certresolver': 'letsencrypt',
    'traefik.http.routers.handla-web.middlewares': 'handla-www-redirect',
    'traefik.http.services.handla-web.loadbalancer.server.port': '3000',
    'traefik.http.middlewares.handla-www-redirect.redirectregex.regex': '^https://www\\.handla\\.tech/(.*)',
    'traefik.http.middlewares.handla-www-redirect.redirectregex.replacement': 'https://handla.tech/$${1}',
    'traefik.http.middlewares.handla-www-redirect.redirectregex.permanent': 'true',
    // Quarantine definition preserved for audit completeness (not attached to router)
    'traefik.http.middlewares.handla-quarantine.ipallowlist.sourcerange': '127.0.0.1/32',
  },
};

checkExactLabels('api', api, expectedLabels.api);
checkExactLabels('web', web, expectedLabels.web);

console.log('[traefik-validator] PASS: Full Access policy verified');
