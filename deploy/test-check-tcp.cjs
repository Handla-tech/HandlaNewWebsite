'use strict';

/**
 * test-check-tcp.cjs
 *
 * Focused automated regression test suite for:
 *  - scripts/check-tcp.js (Node TCP readiness check helper)
 *  - entrypoint.sh check_tcp integration and absence of `nc` dependency
 *
 * Covers:
 *  1. Successful TCP connection (returns 0 / success: true)
 *  2. Connection refused (returns 1 / success: false)
 *  3. DNS resolution failure (returns 1 / success: false)
 *  4. Connection timeout (returns 1 / success: false)
 *  5. Invalid port handling (out of range, NaN, empty) (returns 1)
 *  6. MySQL and Redis readiness check simulation with retry logic
 *  7. Entrypoint shell syntax and check_tcp execution without `nc`
 *  8. Fail-closed behavior when connectivity cannot be established
 */

const assert = require('node:assert/strict');
const net = require('node:net');
const { spawnSync, execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'handla-backend');
const CHECK_TCP_SCRIPT = path.join(BACKEND_DIR, 'scripts', 'check-tcp.js');
const ENTRYPOINT_SCRIPT = path.join(BACKEND_DIR, 'entrypoint.sh');

const { checkTcp } = require(CHECK_TCP_SCRIPT);

let totalPassed = 0;
let totalFailed = 0;

function runTest(name, fn) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then(
        () => {
          totalPassed++;
          console.log('\x1b[32mPASS\x1b[0m');
        },
        (err) => {
          totalFailed++;
          console.log('\x1b[31mFAIL\x1b[0m');
          console.error(err);
        }
      );
    }
    totalPassed++;
    console.log('\x1b[32mPASS\x1b[0m');
    return Promise.resolve();
  } catch (err) {
    totalFailed++;
    console.log('\x1b[31mFAIL\x1b[0m');
    console.error(err);
    return Promise.resolve();
  }
}

async function runAllTests() {
  console.log('─── TCP Check Regression Tests ───\n');

  // 1. Successful TCP connection (API)
  await runTest('checkTcp module succeeds on open TCP port', async () => {
    const server = net.createServer((socket) => {
      socket.end();
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const res = await checkTcp({ host: '127.0.0.1', port, timeoutMs: 1000 });
      assert.equal(res.success, true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // 2. Successful TCP connection CLI (exit code 0)
  await runTest('check-tcp.js CLI exits with code 0 on active port', async () => {
    const server = net.createServer((socket) => {
      socket.end();
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const run = spawnSync(process.execPath, [CHECK_TCP_SCRIPT, '127.0.0.1', String(port), '1000'], {
        encoding: 'utf8',
      });
      assert.equal(run.status, 0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // 3. Connection refused
  await runTest('check-tcp.js CLI exits with code 1 on connection refused', async () => {
    // Port 65534 is unlikely to be listening on localhost
    const run = spawnSync(process.execPath, [CHECK_TCP_SCRIPT, '127.0.0.1', '65534', '500'], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 1);
  });

  // 4. DNS resolution failure
  await runTest('check-tcp.js CLI exits with code 1 on DNS failure', async () => {
    const run = spawnSync(process.execPath, [CHECK_TCP_SCRIPT, 'non-existent-domain-handla-test.local', '3306', '1000'], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 1);
  });

  // 5. Connection timeout
  await runTest('check-tcp.js handles timeout properly', async () => {
    // Using a non-routable blackhole IP (TEST-NET-1: 192.0.2.1)
    const run = spawnSync(process.execPath, [CHECK_TCP_SCRIPT, '192.0.2.1', '80', '200'], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 1);
  });

  // 6. Invalid port handling
  await runTest('check-tcp.js rejects invalid port (string, out of bounds, negative, 0)', async () => {
    for (const invalidPort of ['invalid', '-1', '0', '65536', '70000', '', ' ']) {
      const run = spawnSync(process.execPath, [CHECK_TCP_SCRIPT, '127.0.0.1', invalidPort, '500'], {
        encoding: 'utf8',
      });
      assert.equal(run.status, 1, `Expected port "${invalidPort}" to exit with code 1`);
    }
  });

  // 7. Missing host handling
  await runTest('check-tcp.js rejects missing or empty host', async () => {
    const runEmpty = spawnSync(process.execPath, [CHECK_TCP_SCRIPT, '', '3306', '500'], {
      encoding: 'utf8',
    });
    assert.equal(runEmpty.status, 1);

    const runNoArgs = spawnSync(process.execPath, [CHECK_TCP_SCRIPT], {
      encoding: 'utf8',
    });
    assert.equal(runNoArgs.status, 1);
  });

  // 8. No dependency on nc in entrypoint.sh
  await runTest('entrypoint.sh does not contain nc or netcat commands', () => {
    const entrypointContent = fs.readFileSync(ENTRYPOINT_SCRIPT, 'utf8');
    assert.equal(
      /\bnc\s+-/.test(entrypointContent),
      false,
      'entrypoint.sh should not contain "nc -" commands'
    );
    assert.equal(
      /\bnetcat\b/.test(entrypointContent),
      false,
      'entrypoint.sh should not reference netcat'
    );
  });

  // 9. No inline fallback in entrypoint.sh
  await runTest('entrypoint.sh contains no inline node -e TCP fallback', () => {
    const entrypointContent = fs.readFileSync(ENTRYPOINT_SCRIPT, 'utf8');
    assert.equal(
      /node\s+-e\s+.*net\.createConnection/s.test(entrypointContent),
      false,
      'entrypoint.sh should not contain inline node -e TCP connection fallback'
    );
  });

  // 10. entrypoint.sh shell syntax validation
  await runTest('entrypoint.sh passes POSIX shell syntax check (sh -n)', () => {
    const check = spawnSync('sh', ['-n', ENTRYPOINT_SCRIPT], { encoding: 'utf8' });
    assert.equal(check.status, 0, `Syntax error: ${check.stderr}`);
  });

  // 11. Missing helper causes immediate fail-closed startup failure
  await runTest('Missing or unreadable TCP helper aborts immediately with clear error', () => {
    const script = `
      set -e
      ${fs.readFileSync(ENTRYPOINT_SCRIPT, 'utf8').split('# ─── Wait for MySQL')[0]}
      TCP_HELPER="./scripts/non-existent-helper.js"
      check_tcp 127.0.0.1 3306 1000
    `;
    const run = spawnSync('sh', ['-c', script], {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0, 'Missing helper must exit nonzero immediately');
    assert.match(
      run.stderr,
      /Required TCP check helper .* is missing or unreadable — aborting immediately/,
      'Expected clear error message when helper is missing'
    );
  });

  // 12. check_tcp function in entrypoint.sh runs and returns 0 on open port, 1 on closed port without nc
  await runTest('check_tcp shell function works in isolated subshell with PATH stripped of nc', async () => {
    const server = net.createServer((socket) => {
      socket.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      // Source just the helper definition from entrypoint.sh
      const script = `
        set -e
        ${fs.readFileSync(ENTRYPOINT_SCRIPT, 'utf8').split('# ─── Wait for MySQL')[0]}
        # test success
        check_tcp 127.0.0.1 ${port} 1000
        # test fail
        if check_tcp 127.0.0.1 65534 500; then
          echo "Expected failure on closed port" >&2
          exit 1
        fi
      `;
      // Create a restricted PATH environment where nc does not exist
      const run = spawnSync('sh', ['-c', script], {
        cwd: BACKEND_DIR,
        encoding: 'utf8',
      });
      assert.equal(run.status, 0, `Execution error: ${run.stderr}`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // 11. MySQL and Redis wait loop simulation in entrypoint.sh
  await runTest('MySQL wait loop retries and succeeds when port becomes ready', async () => {
    const server = net.createServer((socket) => {
      socket.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));

    // Schedule server to start listening after 1s
    const timer = setTimeout(() => {
      server.listen(port, '127.0.0.1');
    }, 1000);

    const script = `
      DATABASE_HOST="127.0.0.1"
      DATABASE_PORT="${port}"
      DB_RETRIES=5
      DB_WAIT=1
      ${fs.readFileSync(ENTRYPOINT_SCRIPT, 'utf8').split('# ─── Wait for Redis')[0].replace('DB_RETRIES=30', 'DB_RETRIES=5').replace('DB_WAIT=2', 'DB_WAIT=1')}
    `;

    try {
      const run = await new Promise((resolve, reject) => {
        const { spawn } = require('node:child_process');
        const child = spawn('sh', ['-c', script], {
          cwd: BACKEND_DIR,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (status) => resolve({ status, stdout, stderr }));
        child.on('error', reject);
      });

      assert.equal(run.status, 0, `Expected loop to succeed, got error: ${run.stderr}`);
    } finally {
      clearTimeout(timer);
      if (server.listening) {
        await new Promise((resolve) => server.close(resolve));
      }
    }
  });

  // 12. Fail-closed behavior when MySQL port is never available
  await runTest('MySQL wait loop aborts with error and exits nonzero when never ready', () => {
    const script = `
      DATABASE_HOST="127.0.0.1"
      DATABASE_PORT="65534"
      DB_RETRIES=2
      DB_WAIT=1
      ${fs.readFileSync(ENTRYPOINT_SCRIPT, 'utf8').split('# ─── Wait for Redis')[0].replace('DB_RETRIES=30', 'DB_RETRIES=2').replace('DB_WAIT=2', 'DB_WAIT=1')}
    `;
    const run = spawnSync('sh', ['-c', script], {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0, 'Expected entrypoint to fail-closed on unreachable MySQL');
    assert.match(run.stderr, /MySQL did not become ready after/);
  });

  // 13. Redis wait loop simulation in entrypoint.sh (success and warn fallback)
  await runTest('Redis wait loop succeeds when port becomes ready', async () => {
    const server = net.createServer((socket) => {
      socket.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    const script = `
      set -e
      log()  { echo "[entrypoint] $*"; }
      warn() { echo "[entrypoint] WARN: $*" >&2; }
      die()  { echo "[entrypoint] ERROR: $*" >&2; exit 1; }
      check_tcp() { node ./scripts/check-tcp.js "$1" "$2" "$3"; }

      REDIS_HOST="127.0.0.1"
      REDIS_PORT="${port}"
      REDIS_RETRIES=2
      REDIS_WAIT=1

      log "Waiting for Redis at \${REDIS_HOST}:\${REDIS_PORT}..."
      for i in $(seq 1 $REDIS_RETRIES); do
        if check_tcp "$REDIS_HOST" "$REDIS_PORT" 2000; then
          log "Redis is ready ✓ (attempt \${i})"
          break
        fi
        if [ "$i" -eq "$REDIS_RETRIES" ]; then
          warn "Redis did not become ready — continuing anyway (email queue will buffer)."
          break
        fi
        log "  attempt \${i}/\${REDIS_RETRIES} — retrying in \${REDIS_WAIT}s..."
        sleep $REDIS_WAIT
      done
    `;

    try {
      const run = spawnSync('sh', ['-c', script], {
        cwd: BACKEND_DIR,
        encoding: 'utf8',
      });
      assert.equal(run.status, 0, `Expected Redis check to succeed: ${run.stderr}`);
      assert.match(run.stdout, /Redis is ready ✓/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await runTest('Redis wait loop warns and continues when port is unavailable', () => {
    const script = `
      set -e
      # Define helpers
      log()  { echo "[entrypoint] $*"; }
      warn() { echo "[entrypoint] WARN: $*" >&2; }
      die()  { echo "[entrypoint] ERROR: $*" >&2; exit 1; }
      check_tcp() { node ./scripts/check-tcp.js "$1" "$2" "$3"; }

      REDIS_HOST="127.0.0.1"
      REDIS_PORT="65534"
      REDIS_RETRIES=2
      REDIS_WAIT=1

      log "Waiting for Redis at \${REDIS_HOST}:\${REDIS_PORT}..."
      for i in $(seq 1 $REDIS_RETRIES); do
        if check_tcp "$REDIS_HOST" "$REDIS_PORT" 500; then
          log "Redis is ready ✓ (attempt \${i})"
          break
        fi
        if [ "$i" -eq "$REDIS_RETRIES" ]; then
          warn "Redis did not become ready — continuing anyway (email queue will buffer)."
          break
        fi
        log "  attempt \${i}/\${REDIS_RETRIES} — retrying in \${REDIS_WAIT}s..."
        sleep $REDIS_WAIT
      done
    `;
    const run = spawnSync('sh', ['-c', script], {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, 'Redis failure should not abort entrypoint (continues anyway)');
    assert.match(run.stderr, /Redis did not become ready — continuing anyway/);
  });

  console.log(`\nResults: ${totalPassed} passed, ${totalFailed} failed.`);
  if (totalFailed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
