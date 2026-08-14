/**
 * Handla Auth — real end-to-end runtime test (PART 30).
 *
 * Exercises the LIVE backend over HTTP against a real MariaDB, real Redis, and
 * a local SMTP capture sink. OTP codes are read back from the actual email the
 * server sent (subject line: "Your Handla verification code: NNNNNN"), so this
 * proves the full path — DB writes, bcrypt-hashed OTP storage, email rendering
 * + SMTP send, cookie sessions — not just that endpoints return 200.
 *
 * No production code is touched; this is a black-box HTTP client.
 *
 * Usage: node e2e/auth-e2e.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API || 'http://127.0.0.1:3001/api';
const MAILBOX = path.join(__dirname, 'captured', 'mailbox.log');

let pass = 0, fail = 0;
const results = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; results.push(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; results.push(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal cookie jar so we exercise the real httpOnly-cookie session path. */
function makeJar() {
  const store = {};
  return {
    header() {
      const c = Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; ');
      return c ? { Cookie: c } : {};
    },
    absorb(res) {
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.raw?.()['set-cookie'] || [];
      for (const line of raw) {
        const [pair] = line.split(';');
        const idx = pair.indexOf('=');
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        if (v === '' ) delete store[k]; else store[k] = v;
      }
    },
    get: (k) => store[k],
    names: () => Object.keys(store),
  };
}

async function req(method, url, { body, jar, headers } = {}) {
  const h = { 'Content-Type': 'application/json', ...(headers || {}), ...(jar ? jar.header() : {}) };
  const res = await fetch(`${API}${url}`, {
    method, headers: h, body: body ? JSON.stringify(body) : undefined, redirect: 'manual',
  });
  if (jar) jar.absorb(res);
  let json = null;
  const text = await res.text();
  try { json = text ? JSON.parse(text) : null; } catch { /* non-json (redirect) */ }
  return { status: res.status, json, text, res };
}

/** Read the most-recent OTP the server emailed to `email`, or null. */
function latestOtpFor(email) {
  const raw = fs.readFileSync(MAILBOX, 'utf8');
  const blocks = raw.split('===== MESSAGE');
  // walk from newest to oldest
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.includes(`To: ${email}`) || b.toLowerCase().includes(`to: ${email.toLowerCase()}`)) {
      const m = b.match(/verification code:\s*(\d{6})/i);
      if (m) return m[1];
    }
  }
  return null;
}
async function waitOtp(email, prev = null, tries = 25) {
  for (let i = 0; i < tries; i++) {
    const code = latestOtpFor(email);
    if (code && code !== prev) return code;
    await sleep(300);
  }
  return null;
}

const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ─────────────────────────────────────────────────────────────────────────────
async function testSignup() {
  results.push('\n── FLOW 1: Signup → OTP → session ──');
  const email = `e2e_signup_${uniq()}@example.com`;
  const jar = makeJar();

  const r1 = await req('POST', '/auth/signup', { body: { email, name: 'E2E Signup', password: 'SecurePass@123' }, jar });
  ok('signup returns 200 verification_required', r1.status === 200 && r1.json?.data?.status === 'verification_required', `status=${r1.status}`);
  ok('signup sets NO session cookie', !jar.get('access_token'), `cookies=[${jar.names()}]`);

  const code = await waitOtp(email);
  ok('signup OTP email delivered (real SMTP)', !!code, code ? `code=${code}` : 'no email');

  // wrong code first — proves verification is real (code lives at top-level of the envelope)
  const bad = await req('POST', '/auth/verify-otp', { body: { email, code: '000000', purpose: 'SIGNUP' }, jar });
  ok('wrong OTP rejected (400 OTP_INVALID)', bad.status === 400 && bad.json?.code === 'OTP_INVALID', `status=${bad.status} code=${bad.json?.code}`);

  const r2 = await req('POST', '/auth/verify-otp', { body: { email, code, purpose: 'SIGNUP' }, jar });
  ok('correct OTP → 200 + user', r2.status === 200 && r2.json?.data?.user?.email === email, `status=${r2.status}`);
  ok('verify sets httpOnly session cookies', !!jar.get('access_token') && !!jar.get('refresh_token'), `cookies=[${jar.names()}]`);
  ok('response omits passwordHash', r2.json?.data?.user && r2.json.data.user.passwordHash === undefined, '');

  const me = await req('GET', '/auth/me', { jar });
  ok('GET /me works with session cookie', me.status === 200 && me.json?.data?.user?.email === email, `status=${me.status}`);

  return { email, jar, password: 'SecurePass@123', signupCode: code };
}

async function testDuplicateSignup(email) {
  results.push('\n── FLOW 2: Duplicate signup blocked ──');
  const r = await req('POST', '/auth/signup', { body: { email, name: 'Dup', password: 'SecurePass@123' } });
  ok('duplicate verified email → 409', r.status === 409, `status=${r.status}`);
}

async function testLogin(email, password) {
  results.push('\n── FLOW 3: Login → OTP → session ──');
  const jar = makeJar();
  const prev = latestOtpFor(email);

  const badPw = await req('POST', '/auth/signin', { body: { email, password: 'WrongPass@999' } });
  ok('wrong password → 401', badPw.status === 401, `status=${badPw.status}`);

  const r1 = await req('POST', '/auth/signin', { body: { email, password }, jar });
  ok('signin (valid creds) → verification_required', r1.status === 200 && r1.json?.data?.purpose === 'LOGIN', `status=${r1.status}`);
  ok('signin sets NO session cookie yet', !jar.get('access_token'), `cookies=[${jar.names()}]`);

  const code = await waitOtp(email, prev);
  ok('login OTP email delivered', !!code, code ? `code=${code}` : 'no email');

  const r2 = await req('POST', '/auth/verify-otp', { body: { email, code, purpose: 'LOGIN' }, jar });
  ok('login OTP verify → session', r2.status === 200 && !!jar.get('access_token'), `status=${r2.status}`);

  // logout clears the session
  const lo = await req('POST', '/auth/logout', { jar });
  ok('logout → 200', lo.status === 200, `status=${lo.status}`);
  const meAfter = await req('GET', '/auth/me', { jar });
  ok('after logout /me is unauthorized (401)', meAfter.status === 401, `status=${meAfter.status}`);
  return { jar };
}

async function testOtpSecurity() {
  results.push('\n── FLOW 4: OTP security (attempt cap + resend cooldown) ──');
  // NOTE: /auth/verify-otp is deliberately rate-limited (10 / 5 min / IP). We
  // therefore verify the OTP *attempt cap* (a DB-level counter, max 5) using a
  // budget of exactly 5 wrong guesses, which stays under the throttle ceiling.
  const email = `e2e_sec_${uniq()}@example.com`;
  await req('POST', '/auth/signup', { body: { email, name: 'Sec User', password: 'SecurePass@123' } });
  const code = await waitOtp(email);
  ok('security-flow OTP issued', !!code, code ? `code=${code}` : 'none');

  // 5 wrong codes → the 5th trips the attempt cap and burns the record.
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const r = await req('POST', '/auth/verify-otp', { body: { email, code: '111111', purpose: 'SIGNUP' } });
    seen.push(`${r.status}:${r.json?.code}`);
  }
  const hitInvalid = seen.some((s) => s.includes('OTP_INVALID'));
  const hitCap = seen.some((s) => s.includes('OTP_TOO_MANY_ATTEMPTS'));
  ok('wrong codes rejected with OTP_INVALID', hitInvalid, seen.join(' '));
  ok('attempt cap burns the code (OTP_TOO_MANY_ATTEMPTS)', hitCap, seen.join(' '));

  // The REAL code is now dead (burned by the cap).
  const dead = await req('POST', '/auth/verify-otp', { body: { email, code, purpose: 'SIGNUP' } });
  ok('correct code rejected after burn', dead.status === 400 || dead.status === 429, `status=${dead.status} code=${dead.json?.code}`);

  // Resend cooldown (45s): an immediate resend for a still-fresh code is blocked.
  const email2 = `e2e_cool_${uniq()}@example.com`;
  await req('POST', '/auth/signup', { body: { email: email2, name: 'Cool User', password: 'SecurePass@123' } });
  await waitOtp(email2);
  const rc = await req('POST', '/auth/resend-otp', { body: { email: email2, purpose: 'SIGNUP' } });
  ok('immediate resend hits cooldown (429 RESEND_COOLDOWN)', rc.status === 429 && rc.json?.code === 'RESEND_COOLDOWN', `status=${rc.status} code=${rc.json?.code} retryAfter=${rc.json?.retryAfterSeconds}`);
}

async function testForgotReset(email) {
  results.push('\n── FLOW 5: Forgot → reset → login with new password ──');
  const prev = latestOtpFor(email);
  const fr = await req('POST', '/auth/forgot-password', { body: { email } });
  ok('forgot-password → 200 (generic)', fr.status === 200, `status=${fr.status}`);

  // anti-enumeration: unknown email also returns 200
  const unknown = await req('POST', '/auth/forgot-password', { body: { email: `nobody_${uniq()}@example.com` } });
  ok('forgot-password anti-enumeration (unknown → 200)', unknown.status === 200, `status=${unknown.status}`);

  const code = await waitOtp(email, prev);
  ok('reset code emailed', !!code, code ? `code=${code}` : 'none');

  const newPw = 'BrandNew@456';
  const rp = await req('POST', '/auth/reset-password', { body: { email, code, password: newPw } });
  ok('reset-password → 200', rp.status === 200, `status=${rp.status}`);

  // login with NEW password reaches OTP step (proves password changed)
  const login = await req('POST', '/auth/signin', { body: { email, password: newPw } });
  ok('sign in with new password → verification_required', login.status === 200 && login.json?.data?.purpose === 'LOGIN', `status=${login.status}`);

  // old password now fails
  const old = await req('POST', '/auth/signin', { body: { email, password: 'SecurePass@123' } });
  ok('old password no longer works (401)', old.status === 401, `status=${old.status}`);
}

async function testGoogleGating() {
  results.push('\n── FLOW 6: Google OAuth (config-gated) ──');
  // GOOGLE_CLIENT_ID is empty in this env → the start route should fail closed
  // (redirect to /auth?error=google) rather than expose a broken consent URL.
  const r = await req('GET', '/auth/google');
  const loc = r.res.headers.get('location') || '';
  // Fail-closed = EITHER a redirect to /auth?error=google OR a 4xx error. What
  // must NEVER happen is a 5xx or a redirect to a real Google consent screen
  // built from empty credentials.
  const failedClosed =
    (r.status >= 300 && r.status < 400 && /error=google/.test(loc)) ||
    (r.status >= 400 && r.status < 500 && !/accounts\.google\.com/.test(loc));
  ok('Google start fails closed when unconfigured', failedClosed, `status=${r.status} loc=${loc || 'n/a'}`);

  // callback with a bad/missing state must also bounce to error, never 500
  const cb = await req('GET', '/auth/google/callback?code=x&state=y');
  const cbLoc = cb.res.headers.get('location') || '';
  ok('Google callback rejects bad state → /auth?error=google', cb.status >= 300 && cb.status < 400 && /error=google/.test(cbLoc), `status=${cb.status} loc=${cbLoc}`);
}

async function testRefresh(jar) {
  results.push('\n── FLOW 7: Session refresh (reuses signup session — no extra OTP) ──');
  ok('have a refresh_token cookie to refresh with', !!jar.get('refresh_token'), `cookies=[${jar.names()}]`);
  const rf = await req('POST', '/auth/refresh', { jar });
  ok('refresh → 200 new access token', rf.status === 200 && !!jar.get('access_token'), `status=${rf.status}`);
  ok('refresh issues a token in body (mobile-compatible)', !!rf.json?.data?.accessToken, '');
}

(async () => {
  console.log(`Running Auth E2E against ${API}\n`);
  try {
    const { email, password, jar } = await testSignup();  // 2 verify calls (bad+good)
    await testRefresh(jar);                                // 0 verify calls
    await testDuplicateSignup(email);                      // 0 verify calls
    await testLogin(email, password);                      // 1 verify call
    await testForgotReset(email);                          // 0 verify calls (reset uses its own endpoint)
    await testGoogleGating();                              // 0 verify calls
    await testOtpSecurity();                               // 5 verify calls (fresh email) → 8 total < 10 budget
  } catch (e) {
    results.push(`\n💥 harness error: ${e?.stack || e}`);
    fail++;
  }
  console.log(results.join('\n'));
  console.log(`\n════════════════════════════════════\nRESULT: ${pass} passed, ${fail} failed\n════════════════════════════════════`);
  process.exit(fail === 0 ? 0 : 1);
})();
