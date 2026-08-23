# Handla — Real Off-Host Provider Cutover (VERIFIED — AWS S3)

> **Status: DONE — production backups now go to a real, independent AWS S3
> bucket with versioning + Object Lock. Cutover verified end-to-end
> (backup → real-AWS restore drill).** No secret values appear in this document.

## Verified configuration

| Field | Value |
|---|---|
| Provider | AWS S3 |
| Region | `eu-north-1` |
| Bucket | `handla-production-backups` (separate from the app bucket `handla-uploads`) |
| rclone remote | `handla-backups-aws` |
| Backup destination | `handla-backups-aws:handla-production-backups` |
| IAM user | `handla-backup` (dedicated; distinct from the app user `handla-backend`) |
| Credential location | `/etc/handla-backup/rclone.conf` on the VPS (root:root 0600) |
| Encryption | `age` client-side asymmetric, **before** upload |
| Private decryption key | **off-VPS only** (operator vault) — NOT on the production host |
| Versioning | Enabled (verified: objects return a non-null S3 `VersionId`) |
| Object Lock | Enabled — Governance mode, 30-day default retention (operator-configured at bucket creation) |
| Block Public Access | Enabled (verified: `PutBucketAcl public-read` denied by BPA) |

## Credential privilege model (least privilege)

The `handla-backup` IAM user is scoped to `PUT / GET / LIST` on the backup bucket
only. Verified by direct AWS calls returning `403 AccessDenied`:

- `s3:DeleteObject` → **denied** (delete of a test object refused; object survived)
- `s3:CreateBucket` → **denied**
- `s3:PutBucketPolicy`, `s3:PutBucketAcl` → **denied** (ACL also blocked by BPA)
- `s3:GetBucketVersioning`, `s3:ListBucketVersions`, `s3:GetObjectRetention`,
  `s3:GetObjectLockConfiguration` → **denied** (intentionally; not needed for backup)
- `s3:BypassGovernanceRetention` → **not granted**
- Cross-bucket: `handla-backup` cannot access `handla-uploads`; the app user
  `handla-backend` cannot access `handla-production-backups` (both 403).

Do **not** add any of the denied permissions. Bucket-lock/versioning inspection
is done with an operator/admin credential, not the VPS backup key.

## Retention model (reconciled with 30-day Object Lock)

The VPS credential has **no delete rights**, and objects are immutable for the
30-day Object Lock window. Client-side deletion-based retention is therefore
**disabled** (`OFFHOST_PRUNE=false` in `backup.conf`); the backup script logs
that expiry is delegated to AWS.

- **Local staging:** `KEEP_LOCAL=3` encrypted copies on the VPS (safe to delete
  locally; local files are not under Object Lock).
- **Off-host expiry:** an **AWS S3 Lifecycle policy** (operator-managed on the
  bucket) expires/transitions old versions **after** the 30-day Object Lock
  retention permits it. A 7-daily / 4-weekly / 3-monthly *deletion* schedule
  **cannot** be honored earlier than 30 days while objects are locked — this is
  by design (immutability wins). Recommended lifecycle: expire noncurrent and
  current backup object versions at an age ≥ 30 days that satisfies the desired
  daily/weekly/monthly footprint (e.g. expire daily objects at 35–40 days).
  Do **not** attempt client-side deletion to implement 7-day retention; it would
  fail (no permission) and is incompatible with the lock.

## Restore procedure (tested)

Restore decryption uses the **off-VPS** age private identity on a trusted machine
that is **not** the production host. The DR drill downloads the latest encrypted
DB artifact from AWS, verifies SHA-256, decrypts with the identity, verifies gzip,
and imports into a throwaway MySQL 8 container (never production). Verified
result on the real AWS artifact: 36 tables, 23 migrations, 153 indexes, 22 FKs.

```
AGE_IDENTITY=/secure/offhost/handla-backup-identity.key \
RCLONE_CONFIG=/etc/handla-backup/rclone.conf \
RCLONE_REMOTE=handla-backups-aws:handla-production-backups \
  /usr/local/sbin/handla-restore-drill
```

> Operational note: during this cutover exercise the only trusted environment
> available was the production host itself, so the drill decryption ran there and
> the private identity was **securely removed afterward** (`shred -u`). In a real
> DR event, perform decryption on a separate trusted machine per this runbook;
> never leave the private identity on the VPS.
