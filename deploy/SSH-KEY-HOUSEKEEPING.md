# SSH / authorized_keys housekeeping (Phase 7)

Read-only inventory + a single, provably-safe cleanup of the production host's
SSH access, plus verification that password login stays disabled and the
dedicated deploy account keeps only its intended fixed permission.

**Host:** `srv1642049` (production VPS, shared multi-tenant).
**Scope:** Handla-owned access only. Other tenants' keys, provider-managed keys,
and any key of uncertain ownership were **preserved untouched**.
**No private keys or key material are recorded here — fingerprints/comments only.**

---

## 1. sshd effective auth policy (verified with `sshd -T`)

| Setting | Effective value | Verdict |
|---|---|---|
| `PasswordAuthentication` | `no` | ✅ password login disabled |
| `KbdInteractiveAuthentication` | `no` | ✅ no keyboard-interactive fallback |
| `PermitEmptyPasswords` | `no` | ✅ |
| `PubkeyAuthentication` | `yes` | ✅ key-only |
| `PermitRootLogin` | `without-password` (key-only) | ✅ root is key-only |

Enforced by `/etc/ssh/sshd_config.d/01-handla-security.conf`
(`PermitRootLogin prohibit-password`, `PasswordAuthentication no`,
`PubkeyAuthentication yes`, `KbdInteractiveAuthentication no`), reinforced by
cloud-init drop-ins (`50-cloud-init.conf`, `60-cloudimg-settings.conf`, both
`PasswordAuthentication no`).

> Note: the stock `/etc/ssh/sshd_config` line `PermitRootLogin yes` (line 130)
> is **overridden** by the `sshd_config.d/*.conf` drop-in
> (`prohibit-password`), which is why the *effective* value is
> `without-password`. Tidying the stock line to match is an optional,
> operator-only cosmetic follow-up (recorded in OPERATOR-ACTIONS.md, item H)
> — it does not change current behaviour.

---

## 2. authorized_keys inventory (fingerprints + comments only)

### `/root/.ssh/authorized_keys` — BEFORE (5 lines, 4 unique)

| # | Fingerprint (SHA256) | Type | Comment | Ownership | Action |
|---|---|---|---|---|---|
| 1 | `SPXW…+xGo` | ED25519 | `handla-sandbox-deploy` | Handla | keep (1st copy) |
| 2 | `SPXW…+xGo` | ED25519 | `handla-sandbox-deploy` | Handla | **REMOVE — exact duplicate of #1** |
| 3 | `mMEk…tH1U` | ED25519 | `gh-actions-homy` | **homy tenant** | preserve (not Handla) |
| 4 | `iguu…Y3Vo` | RSA-4096 | `#hostinger-managed-key` | provider | preserve (infra) |
| 5 | `RNUX…rsVA` | ED25519 | `afaqinfotech` | uncertain | preserve (uncertain) |

### `/root/.ssh/authorized_keys` — AFTER (4 lines, 4 unique)

Lines #1 and #2 were **byte-identical**. The cleanup removed exactly one
redundant copy. Verified: the set of **4 unique fingerprints is identical
before and after** → zero access change, fully reversible.

Remaining keys: `handla-sandbox-deploy`, `gh-actions-homy`,
`#hostinger-managed-key`, `afaqinfotech`.

### `/home/handla-deploy/.ssh/authorized_keys`

| Fingerprint | Type | Comment | Verdict |
|---|---|---|---|
| `sWkN…F2s` | ED25519 | `handla-deploy@github-actions` | ✅ single intended deploy key |

### `/home/ubuntu/.ssh/authorized_keys`

Empty (comments only) — no active keys.

---

## 3. Deploy account (`handla-deploy`) least-privilege — verified

- **Groups:** `handla-deploy` only. **Not** in `sudo`, `docker`, `adm`, or any
  admin group.
- **sudoers** (`/etc/sudoers.d/handla-deploy`):
  ```
  Defaults:handla-deploy !setenv, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  handla-deploy ALL=(root) NOPASSWD: /usr/local/sbin/handla-production-deploy
  ```
  → exactly **one** fixed, root-owned wrapper; no shell, no wildcard, `!setenv`,
  locked `secure_path`.
- **Wrapper behaviour (verified live):** `handla-production-deploy` takes **no
  arguments** and always deploys `origin/main` from a trusted checkout — no
  argument/command-injection surface.

---

## 4. Change applied to production (live-safe)

1. Timestamped backup: `/root/.ssh/authorized_keys.bak.phase7-<TS>` (mode 600).
2. Atomic dedupe (`awk '!seen[$0]++'`, order preserved), mode 600, `root:root`.
3. `sshd -t` → config valid. **No sshd restart** needed (authorized_keys is read
   per-connection).
4. Post-change verification: root SSH ✅, `handla-deploy` SSH + sudo wrapper ✅.

**Rollback:** `cp /root/.ssh/authorized_keys.bak.phase7-<TS> /root/.ssh/authorized_keys`.

---

## 5. What was intentionally NOT changed

- `gh-actions-homy` — belongs to the **homy** tenant (not Handla).
- `#hostinger-managed-key` — provider/infrastructure managed.
- `afaqinfotech` — ownership uncertain; also the currently-active admin key.
- `handla-deploy@github-actions` — the intended deploy key.
- No sshd restart, no config rewrite, no other tenant touched.
