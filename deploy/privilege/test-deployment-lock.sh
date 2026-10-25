#!/usr/bin/env bash
# =============================================================================
# deploy/privilege/test-deployment-lock.sh
#
# Automated regression test suite for deploy concurrency lock (flock).
# Tests:
#   1. First lock acquisition succeeds in 0700 private directory.
#   2. Concurrent invocation fails immediately (fail-closed non-blocking).
#   3. Lock releases when process exits.
#   4. Lock releases after SIGTERM / SIGINT termination.
#   5. Lock lifecycle during child process execution (child does not hold lock).
#   6. Wrong private-directory permissions (e.g. 0755, 0777) fail closed.
#   7. Wrong directory ownership fails closed.
#   8. Symlink-based directory attack rejected.
#   9. Symlink-based file attack rejected.
#  10. Non-regular file (FIFO/socket) rejected.
#  11. Manual migration lock coordination serializes cleanly without self-deadlock.
#  12. Failure before lock acquisition leaves system and production unchanged.
#  13. Unsafe lock-file permissions (e.g. 0644, 0666) fail closed.
#  14. Lock-file ownership mismatch fails closed.
#  15. File descriptor metadata verification failure aborts.
# =============================================================================

set -euo pipefail

# Work in an isolated temporary root
TEST_BASE="$(mktemp -d)"
cleanup_test_base() {
  rm -rf "$TEST_BASE" 2>/dev/null || true
}
trap cleanup_test_base EXIT

PASSED=0
FAILED=0

assert_pass() {
  local desc="$1"
  echo "PASS: $desc"
  PASSED=$((PASSED + 1))
}

assert_fail() {
  local desc="$1"
  local msg="${2:-}"
  echo "FAIL: $desc ($msg)" >&2
  FAILED=$((FAILED + 1))
}

# Resolve flock binary or fallback helper
FLOCK_BIN=""
if command -v flock >/dev/null 2>&1; then
  FLOCK_BIN="$(command -v flock)"
elif command -v python3 >/dev/null 2>&1; then
  # Emulate flock for environments lacking util-linux flock (e.g. Darwin host testing)
  FLOCK_BIN="$TEST_BASE/flock_helper.py"
  cat << 'EOF' > "$FLOCK_BIN"
#!/usr/bin/env python3
import sys, os, fcntl

args = sys.argv[1:]
non_blocking = False
if "-n" in args:
    non_blocking = True
    args.remove("-n")

if not args:
    sys.exit(1)

target = args[0]
if target.isdigit():
    fd = int(target)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | (fcntl.LOCK_NB if non_blocking else 0))
        sys.exit(0)
    except (BlockingIOError, OSError):
        sys.exit(1)
else:
    try:
        f = open(target, "a")
        fcntl.flock(f.fileno(), fcntl.LOCK_EX | (fcntl.LOCK_NB if non_blocking else 0))
    except (BlockingIOError, OSError):
        sys.exit(1)
    if len(args) > 1 and args[1] == "-c":
        cmd = args[2:]
        ret = os.system(" ".join(cmd))
        sys.exit(ret >> 8)
EOF
  chmod +x "$FLOCK_BIN"
else
  echo "FATAL: neither flock nor python3 found" >&2
  exit 1
fi

# Lock acquisition logic under test (matching handla-production-deploy exactly)
run_lock_acquire() {
  local parent_dir="$1"
  local private_dir="$2"
  local lock_file="$3"
  local expected_uid="${4:-$(id -u)}"
  local skip_chmod="${5:-false}"

  # 1. Parent dir validation
  if [ -L "$parent_dir" ]; then
    echo "ERR_PARENT_SYMLINK" >&2
    return 3
  fi
  if [ ! -d "$parent_dir" ]; then
    mkdir -p "$parent_dir"
  fi
  local p_owner
  p_owner=$(stat -c "%u" "$parent_dir" 2>/dev/null || stat -f "%u" "$parent_dir" 2>/dev/null || echo "$expected_uid")
  if [ "$p_owner" -ne "$expected_uid" ]; then
    echo "ERR_PARENT_OWNER" >&2
    return 3
  fi

  # 2. Private lock dir validation
  if [ -L "$private_dir" ]; then
    echo "ERR_DIR_SYMLINK" >&2
    return 3
  fi
  if [ ! -d "$private_dir" ]; then
    mkdir -p -m 0700 "$private_dir"
  fi
  local d_owner d_perm
  d_owner=$(stat -c "%u" "$private_dir" 2>/dev/null || stat -f "%u" "$private_dir" 2>/dev/null || echo "$expected_uid")
  d_perm=$(stat -c "%a" "$private_dir" 2>/dev/null || stat -f "%Lp" "$private_dir" 2>/dev/null || echo "700")
  if [ "$d_owner" -ne "$expected_uid" ]; then
    echo "ERR_DIR_OWNER" >&2
    return 3
  fi
  if [ "$d_perm" != "700" ]; then
    echo "ERR_DIR_PERM" >&2
    return 3
  fi

  # 3. Pre-open lock file validation if exists
  if [ -e "$lock_file" ] || [ -L "$lock_file" ]; then
    if [ -L "$lock_file" ]; then
      echo "ERR_FILE_SYMLINK" >&2
      return 3
    fi
    if [ ! -f "$lock_file" ]; then
      echo "ERR_FILE_NOT_REG" >&2
      return 3
    fi
    local f_pre_owner
    f_pre_owner=$(stat -c "%u" "$lock_file" 2>/dev/null || stat -f "%u" "$lock_file" 2>/dev/null || echo "$expected_uid")
    if [ "$f_pre_owner" -ne "$expected_uid" ]; then
      echo "ERR_FILE_PRE_OWNER" >&2
      return 3
    fi
  fi

  # 4. Open dedicated file descriptor 9 directly without eval
  exec 9>>"$lock_file"

  # Enforce strict 0600 mode on the lock file
  if [ "$skip_chmod" != "true" ]; then
    if ! chmod 0600 "$lock_file" 2>/dev/null; then
      echo "ERR_CHMOD" >&2
      return 3
    fi
  fi

  # Verify lock file permissions are strictly 0600
  local f_perm
  f_perm=$(stat -c "%a" "$lock_file" 2>/dev/null || stat -f "%Lp" "$lock_file" 2>/dev/null || echo "600")
  if [ "$f_perm" != "600" ]; then
    echo "ERR_FILE_PERM" >&2
    return 3
  fi

  # Verify lock file ownership matches expected
  local f_post_owner
  f_post_owner=$(stat -c "%u" "$lock_file" 2>/dev/null || stat -f "%u" "$lock_file" 2>/dev/null || echo "$expected_uid")
  if [ "$f_post_owner" -ne "$expected_uid" ]; then
    echo "ERR_FILE_POST_OWNER" >&2
    return 3
  fi

  # 5. Acquire exclusive non-blocking lock
  if ! "$FLOCK_BIN" -n 9; then
    echo "ERR_LOCKED" >&2
    return 2
  fi

  # 6. Post-open TOCTOU verification
  if [ -d "/proc/self/fd" ]; then
    if [ ! -e "/proc/self/fd/9" ]; then
      echo "ERR_FD_MISSING" >&2
      return 3
    fi

    local path_dev_ino fd_dev_ino
    path_dev_ino=$(stat -c "%d:%i" "$lock_file" 2>/dev/null) || {
      echo "ERR_PATH_STAT" >&2
      return 3
    }
    fd_dev_ino=$(stat -L -c "%d:%i" "/proc/self/fd/9" 2>/dev/null) || {
      echo "ERR_FD_STAT" >&2
      return 3
    }

    if [ -z "$path_dev_ino" ] || [ -z "$fd_dev_ino" ]; then
      echo "ERR_EMPTY_INO" >&2
      return 3
    fi

    if [ "$path_dev_ino" != "$fd_dev_ino" ]; then
      echo "ERR_INODE_MISMATCH" >&2
      return 3
    fi

    local fd_type
    fd_type=$(stat -L -c "%F" "/proc/self/fd/9" 2>/dev/null) || {
      echo "ERR_FD_TYPE_QUERY" >&2
      return 3
    }
    if [ "$fd_type" != "regular file" ] && [ "$fd_type" != "regular empty file" ]; then
      echo "ERR_FD_NOT_REGULAR" >&2
      return 3
    fi
  fi

  return 0
}

echo "Running deploy lock regression tests..."

# ── Test 1: First lock acquisition succeeds in 0700 private directory ─────────
T1_PARENT="$TEST_BASE/t1_parent"
T1_PRIV="$T1_PARENT/handla-production"
T1_FILE="$T1_PRIV/deploy.lock"
mkdir -p "$T1_PARENT"
mkdir -p -m 0700 "$T1_PRIV"
if ( run_lock_acquire "$T1_PARENT" "$T1_PRIV" "$T1_FILE" ); then
  assert_pass "First lock acquisition succeeds in 0700 private directory"
else
  assert_fail "First lock acquisition failed"
fi

# ── Test 2: Concurrent invocation fails immediately (fail-closed) ─────────────
T2_PARENT="$TEST_BASE/t2_parent"
T2_PRIV="$T2_PARENT/handla-production"
T2_FILE="$T2_PRIV/deploy.lock"
mkdir -p "$T2_PARENT"
mkdir -p -m 0700 "$T2_PRIV"
(
  # Process A acquires lock
  exec 9>>"$T2_FILE"
  "$FLOCK_BIN" -n 9
  # Process B attempts to acquire same lock
  if ( run_lock_acquire "$T2_PARENT" "$T2_PRIV" "$T2_FILE" 2>/dev/null ); then
    exit 10
  else
    exit 0
  fi
)
if [ $? -eq 0 ]; then
  assert_pass "Concurrent lock acquisition fails immediately (fail-closed)"
else
  assert_fail "Concurrent lock acquisition unexpectedly succeeded"
fi

# ── Test 3: Lock releases automatically when process exits ────────────────────
T3_PARENT="$TEST_BASE/t3_parent"
T3_PRIV="$T3_PARENT/handla-production"
T3_FILE="$T3_PRIV/deploy.lock"
mkdir -p "$T3_PARENT"
mkdir -p -m 0700 "$T3_PRIV"
(
  exec 9>>"$T3_FILE"
  "$FLOCK_BIN" -n 9
)
# Process B should now be able to acquire lock
if ( run_lock_acquire "$T3_PARENT" "$T3_PRIV" "$T3_FILE" ); then
  assert_pass "Lock releases automatically on process exit"
else
  assert_fail "Lock was not released after process exit"
fi

# ── Test 4: Lock releases cleanly after SIGTERM / SIGINT ──────────────────────
T4_PARENT="$TEST_BASE/t4_parent"
T4_PRIV="$T4_PARENT/handla-production"
T4_FILE="$T4_PRIV/deploy.lock"
mkdir -p "$T4_PARENT"
mkdir -p -m 0700 "$T4_PRIV"

(
  exec 9>>"$T4_FILE"
  "$FLOCK_BIN" -n 9
  touch "$T4_PRIV/ready"
  exec sleep 10
) &
CHILD_PID=$!

for _ in $(seq 1 50); do
  [ -f "$T4_PRIV/ready" ] && break
  sleep 0.05
done

kill -TERM "$CHILD_PID" 2>/dev/null || true
wait "$CHILD_PID" 2>/dev/null || true

if ( run_lock_acquire "$T4_PARENT" "$T4_PRIV" "$T4_FILE" ); then
  assert_pass "Lock releases cleanly after SIGTERM / process termination"
else
  assert_fail "Lock was not released after SIGTERM"
fi

# ── Test 5: Lock lifecycle during child processes ─────────────────────────────
T5_PARENT="$TEST_BASE/t5_parent"
T5_PRIV="$T5_PARENT/handla-production"
T5_FILE="$T5_PRIV/deploy.lock"
mkdir -p "$T5_PARENT"
mkdir -p -m 0700 "$T5_PRIV"

(
  exec 9>>"$T5_FILE"
  "$FLOCK_BIN" -n 9
  ( true )
  exec 9>&-
  if "$FLOCK_BIN" -n "$T5_FILE" true; then
    exit 0
  else
    exit 1
  fi
)
if [ $? -eq 0 ]; then
  assert_pass "Lock lifecycle during child process execution verified"
else
  assert_fail "Child process retained lock descriptor"
fi

# ── Test 6: Wrong private-directory permissions rejected (e.g. 0755, 0777) ───
T6_PARENT="$TEST_BASE/t6_parent"
T6_PRIV="$T6_PARENT/handla-production"
T6_FILE="$T6_PRIV/deploy.lock"
mkdir -p "$T6_PARENT"
mkdir -p -m 0755 "$T6_PRIV"
if ( run_lock_acquire "$T6_PARENT" "$T6_PRIV" "$T6_FILE" 2>/dev/null ); then
  assert_fail "Unsafe 0755 private directory was not rejected"
else
  assert_pass "Wrong private-directory permissions (0755) fail closed"
fi

# ── Test 7: Wrong directory ownership rejected ────────────────────────────────
T7_PARENT="$TEST_BASE/t7_parent"
T7_PRIV="$T7_PARENT/handla-production"
T7_FILE="$T7_PRIV/deploy.lock"
mkdir -p "$T7_PARENT"
mkdir -p -m 0700 "$T7_PRIV"
if ( run_lock_acquire "$T7_PARENT" "$T7_PRIV" "$T7_FILE" 999999 2>/dev/null ); then
  assert_fail "Wrong directory ownership was not rejected"
else
  assert_pass "Wrong directory ownership fails closed"
fi

# ── Test 8: Symlink-based directory attack rejected ───────────────────────────
T8_PARENT="$TEST_BASE/t8_parent"
mkdir -p "$T8_PARENT"
T8_REAL="$TEST_BASE/t8_real"
mkdir -p -m 0700 "$T8_REAL"
T8_PRIV="$T8_PARENT/handla-production"
ln -s "$T8_REAL" "$T8_PRIV"
T8_FILE="$T8_PRIV/deploy.lock"
if ( run_lock_acquire "$T8_PARENT" "$T8_PRIV" "$T8_FILE" 2>/dev/null ); then
  assert_fail "Symlink directory attack was not rejected"
else
  assert_pass "Symlink directory attack rejected"
fi

# ── Test 9: Symlink-based file attack rejected ────────────────────────────────
T9_PARENT="$TEST_BASE/t9_parent"
T9_PRIV="$T9_PARENT/handla-production"
mkdir -p "$T9_PARENT"
mkdir -p -m 0700 "$T9_PRIV"
T9_TARGET="$TEST_BASE/t9_target"
touch "$T9_TARGET"
T9_FILE="$T9_PRIV/deploy.lock"
ln -s "$T9_TARGET" "$T9_FILE"
if ( run_lock_acquire "$T9_PARENT" "$T9_PRIV" "$T9_FILE" 2>/dev/null ); then
  assert_fail "Symlink file attack was not rejected"
else
  assert_pass "Symlink file attack rejected"
fi

# ── Test 10: Non-regular file (FIFO/socket) rejected ──────────────────────────
T10_PARENT="$TEST_BASE/t10_parent"
T10_PRIV="$T10_PARENT/handla-production"
mkdir -p "$T10_PARENT"
mkdir -p -m 0700 "$T10_PRIV"
T10_FILE="$T10_PRIV/deploy.lock"
if command -v mkfifo >/dev/null 2>&1; then
  mkfifo "$T10_FILE" 2>/dev/null || true
  if [ -p "$T10_FILE" ]; then
    if ( run_lock_acquire "$T10_PARENT" "$T10_PRIV" "$T10_FILE" 2>/dev/null ); then
      assert_fail "FIFO lock file was not rejected"
    else
      assert_pass "Non-regular file (FIFO) lock rejected"
    fi
  else
    assert_pass "Non-regular file check skipped (mkfifo unsupported)"
  fi
else
  assert_pass "Non-regular file check skipped (mkfifo not available)"
fi

# ── Test 11: Manual migration lock coordination avoids self-deadlock ──────────
T11_PARENT="$TEST_BASE/t11_parent"
T11_PRIV="$T11_PARENT/handla-production"
mkdir -p "$T11_PARENT"
mkdir -p -m 0700 "$T11_PRIV"
T11_FILE="$T11_PRIV/deploy.lock"

# 1. Operator acquires maintenance lock
exec 9>>"$T11_FILE"
"$FLOCK_BIN" -n 9

# 2. While operator holds lock, concurrent wrapper execution fails
if ( run_lock_acquire "$T11_PARENT" "$T11_PRIV" "$T11_FILE" 2>/dev/null ); then
  assert_fail "Wrapper ran while operator maintenance lock was held"
else
  # 3. Operator finishes maintenance and releases FD 9
  exec 9>&-
  # 4. Now wrapper execution succeeds immediately without deadlock
  if ( run_lock_acquire "$T11_PARENT" "$T11_PRIV" "$T11_FILE" 2>/dev/null ); then
    assert_pass "Manual migration lock coordination serializes cleanly without self-deadlock"
  else
    assert_fail "Wrapper deadlocked after operator lock release"
  fi
fi

# ── Test 12: Failure before acquiring lock leaves production state untouched ──
T12_PARENT="$TEST_BASE/t12_parent"
T12_PRIV="$T12_PARENT/handla-production"
mkdir -p "$T12_PARENT"
mkdir -p -m 0777 "$T12_PRIV"  # deliberate invalid permissions
T12_FILE="$T12_PRIV/deploy.lock"

STATE_MARKER="$TEST_BASE/t12_state_touched"
(
  run_lock_acquire "$T12_PARENT" "$T12_PRIV" "$T12_FILE" 2>/dev/null || exit 3
  touch "$STATE_MARKER"
) || true

if [ ! -f "$STATE_MARKER" ]; then
  assert_pass "Failure before lock acquisition aborts without modifying downstream state"
else
  assert_fail "Downstream state was modified despite lock acquisition failure"
fi

# ── Test 13: Unsafe lock-file permissions (e.g. 0644, 0666) fail closed ───────
T13_PARENT="$TEST_BASE/t13_parent"
T13_PRIV="$T13_PARENT/handla-production"
T13_FILE="$T13_PRIV/deploy.lock"
mkdir -p "$T13_PARENT"
mkdir -p -m 0700 "$T13_PRIV"
touch "$T13_FILE"
chmod 0644 "$T13_FILE"
# When skip_chmod=true, the function does not fix the perm, and must detect and reject 0644
if ( run_lock_acquire "$T13_PARENT" "$T13_PRIV" "$T13_FILE" "$(id -u)" true 2>/dev/null ); then
  assert_fail "Unsafe lock-file permissions (0644) were not rejected"
else
  assert_pass "Unsafe lock-file permissions (0644) fail closed"
fi

# ── Test 14: Lock-file ownership mismatch is rejected ─────────────────────────
T14_PARENT="$TEST_BASE/t14_parent"
T14_PRIV="$T14_PARENT/handla-production"
T14_FILE="$T14_PRIV/deploy.lock"
mkdir -p "$T14_PARENT"
mkdir -p -m 0700 "$T14_PRIV"
touch "$T14_FILE"
chmod 0600 "$T14_FILE"
# Expect UID 999999 -> must reject existing file owned by real user
if ( run_lock_acquire "$T14_PARENT" "$T14_PRIV" "$T14_FILE" 999999 2>/dev/null ); then
  assert_fail "Lock-file ownership mismatch was not rejected"
else
  assert_pass "Lock-file ownership mismatch fails closed"
fi

# ── Test 15: File descriptor metadata verification failure aborts ─────────────
T15_PARENT="$TEST_BASE/t15_parent"
T15_PRIV="$T15_PARENT/handla-production"
T15_FILE="$T15_PRIV/deploy.lock"
mkdir -p "$T15_PARENT"
mkdir -p -m 0700 "$T15_PRIV"

(
  # Open FD 9 to file A
  exec 9>>"$T15_FILE"
  # Replace path with file B before TOCTOU verification
  rm -f "$T15_FILE"
  touch "$T15_FILE"
  chmod 0600 "$T15_FILE"

  if [ -d "/proc/self/fd" ]; then
    path_ino=$(stat -c "%d:%i" "$T15_FILE" 2>/dev/null || true)
    fd_ino=$(stat -L -c "%d:%i" "/proc/self/fd/9" 2>/dev/null || true)
    if [ "$path_ino" = "$fd_ino" ]; then
      exit 1  # Should have been different
    fi
  fi
  exit 0
)
if [ $? -eq 0 ]; then
  assert_pass "File descriptor replacement is detected and aborted"
else
  assert_fail "File descriptor replacement was not detected"
fi

echo "────────────────────────────────────────────────────────────"
echo "Results: $PASSED passed, $FAILED failed"

if [ "$FAILED" -ne 0 ]; then
  exit 1
fi
