# Handla Off-Host Encrypted Backup

Automated, client-side-encrypted, off-host backup of the Handla production MySQL
database and production-only config/secrets, with a **proven restore drill**.

## Components (installed on the VPS, root-owned)
| Path | Purpose |
|---|---|
| `/usr/local/sbin/handla-backup` | Backup: mysqldump→gzip→age→sha256→off-host upload→verify (fail-closed, `flock`). |
| `/usr/local/sbin/handla-restore-drill` | Restore proof into a throwaway MySQL 8 container (never production). |
| `/etc/handla-backup/backup.conf` | Runtime config (0600). No DB/cloud secret except the rclone remote. |
| `/etc/handla-backup/rclone.conf` | Off-host remote creds (0600). |
| `/etc/handla-backup/age-recipient.pub` | **Public** age recipient (encrypt only). |
| `/etc/systemd/system/handla-backup.{service,timer}` | Daily 02:30 UTC, `RandomizedDelaySec=300`, `Persistent=true`. |
| `/opt/handla-backup/local` | Last `KEEP_LOCAL=3` encrypted copies. |
| `/var/lib/handla-backup/last-success[.meta]` | Monitoring hook (latest success marker). |

Templates (no secrets) live here: `backup.conf.example`, `rclone.conf.example`,
`systemd/`. Fill real values on the VPS only.

## Flow
`mysqldump` (streamed, plaintext never hits disk) → `gzip -9` → `age -r <pubkey>`
→ `sha256sum` → `rclone copy` to `handlabackup:handla-production-backups/daily/<TS>/`
→ remote size verify → local + off-host retention → success marker.

Artifacts: `handla-db-prod_YYYYMMDD-HHMMSS.sql.gz.age`,
`handla-config-prod_YYYYMMDD-HHMMSS.tar.gz.age` (+ `.sha256` sidecars).

## Encryption / key model
- **age** asymmetric. The VPS holds only the **public** recipient, so a compromised
  VPS still cannot decrypt backups.
- The **private identity is stored OFF the VPS** (team vault) and is required only
  for restore / restore-drill (`AGE_IDENTITY=...`).

## Retention
Local: `KEEP_LOCAL=3` encrypted copies on the VPS. **Off-host expiry is
provider-side** (AWS S3 Lifecycle + Object Lock); the VPS performs **no**
off-host deletion (`OFFHOST_PRUNE=false`). Two enabled AWS lifecycle rules on
`handla-production-backups`:
- `handla-backup-retention` — expire current versions after **30 days**;
  permanently delete noncurrent versions **1 day** after they become noncurrent
  (subject to the 30-day Object Lock retention); keep **0** newer noncurrent
  versions.
- `handla-delete-marker-cleanup` — delete expired object delete markers.

The legacy `RETAIN_DAILY/WEEKLY/MONTHLY` vars are inert on the immutable AWS
remote and apply only to the optional non-immutable (MinIO test) path.
See `REAL-PROVIDER-CUTOVER.md` for the full retention/lifecycle model.

## S3 user-file recovery (`handla-uploads`)
S3 is the durable copy for user uploads. The app IAM user is least-privileged and
**cannot** read bucket versioning (`GetBucketVersioning` denied), so versioning
state is undetermined via the app credential. **Recommendation:** enable
**versioning + lifecycle** on `handla-uploads` from the AWS console (low-risk,
protects against accidental/malicious object deletion). Do not make the bucket public.

## Compromise / ransomware resilience (implemented + verified)
- Backups are encrypted before leaving the VPS; the bucket is private (unauth = 403).
- The backup credential on the VPS is scoped to `PUT/GET/LIST` only and **cannot**
  `DeleteObject`, `DeleteObjectVersion`, or `BypassGovernanceRetention` — so a
  root-level VPS compromise **cannot** delete, overwrite-destroy, or shorten the
  off-host backups. Versioning + Object Lock (Governance, 30d) enforce this on the
  provider side.
- **Accepted residual risk:** a trusted AWS *administrative* principal (account
  root / admin, not on the VPS) could bypass Governance retention. This is the
  deliberate cost of keeping an emergency admin recovery path; Compliance mode
  (which removes even admin recovery) was considered and intentionally not
  enabled. Protect the AWS account root/admin accordingly (MFA, minimal admins).

## Off-host provider — LIVE on AWS S3 (verified)
Production backups upload to a **real, independent AWS S3 bucket**:

- Provider **AWS S3**, region **eu-north-1**, bucket **`handla-production-backups`**
  (separate from the app bucket `handla-uploads`).
- rclone remote **`handla-backups-aws`**; destination
  `handla-backups-aws:handla-production-backups`.
- Dedicated IAM user **`handla-backup`**, scoped **PUT/GET/LIST only** — no
  DELETE, no DeleteObjectVersion, no CreateBucket, no bucket admin, and **no
  Object Lock / Governance bypass** (all verified 403, non-destructively).
- **Versioning enabled**, **Object Lock** (Governance, 30 days — deliberately
  chosen; Compliance considered but intentionally not enabled), **Block Public
  Access** enabled.
- **Provider-side lifecycle** (`handla-backup-retention` +
  `handla-delete-marker-cleanup`) handles expiry; the VPS performs **no**
  off-host deletion (`OFFHOST_PRUNE=false`).
- Admin Governance bypass by a trusted AWS admin principal is an **accepted
  residual risk** (preserves an emergency recovery path); no VPS-resident
  credential can perform it.
- All uploads use `--s3-no-check-bucket` (the credential cannot CreateBucket).

Cutover verified end-to-end: real AWS backup → real-AWS restore drill
(36 tables / 23 migrations / 153 indexes / 22 FKs) → delete-denial + public-access
+ cross-bucket-isolation tests. See `REAL-PROVIDER-CUTOVER.md` for the full model.

The loopback **MinIO** remote (`handlabackup`) is retained only as a marked
**TEST / STAND-IN ONLY** entry in `rclone.conf` and is **not** the production
target. There is no silent fallback: if the AWS upload fails the backup job fails
and the last-success marker is not updated.

## Operate
```
# manual backup
/usr/local/sbin/handla-backup
# restore drill (needs OFF-host private key)
AGE_IDENTITY=/path/to/handla-backup-identity.key \
RCLONE_REMOTE=handlabackup:handla-production-backups \
  /usr/local/sbin/handla-restore-drill
# schedule
systemctl enable --now handla-backup.timer
systemctl list-timers handla-backup.timer
# disable
systemctl disable --now handla-backup.timer
```

See `DISASTER-RECOVERY.md` for the full new-VPS rebuild runbook and RPO/RTO.
