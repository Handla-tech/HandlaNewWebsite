# Handla — Real Off-Host Provider Cutover (VERIFIED — AWS S3)

> **Status: DONE & FINALIZED — production backups go to a real, independent AWS
> S3 bucket with versioning, Object Lock (Governance 30d, intentional), and
> provider-side lifecycle rules. Cutover verified end-to-end (encrypted AWS
> backup → real-AWS restore drill) and re-verified with no regression.** No
> secret values appear in this document.

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
| Object Lock | Enabled — **Governance** mode, 30-day default retention (deliberately selected — see "Object Lock mode decision" below) |
| Block Public Access | Enabled (verified: `PutBucketAcl public-read` denied by BPA) |
| Lifecycle | Enabled — provider-side (two operator-configured rules — see "Retention / lifecycle model" below) |

## Credential privilege model (least privilege)

The `handla-backup` IAM user is scoped to `PUT / GET / LIST` on the backup bucket
only. Verified by direct AWS calls returning `403 AccessDenied`:

- `s3:DeleteObject` → **denied** (delete of a test object refused; object survived)
- `s3:CreateBucket` → **denied**
- `s3:PutBucketPolicy`, `s3:PutBucketAcl` → **denied** (ACL also blocked by BPA)
- `s3:GetBucketVersioning`, `s3:ListBucketVersions`, `s3:GetObjectRetention`,
  `s3:GetObjectLockConfiguration` → **denied** (intentionally; not needed for backup)
- `s3:BypassGovernanceRetention` → **not granted** (verified non-destructively:
  `delete-object --bypass-governance-retention` with the VPS credential returns
  `AccessDenied`; the probe object survives)
- Cross-bucket: `handla-backup` cannot access `handla-uploads`; the app user
  `handla-backend` cannot access `handla-production-backups` (both 403).

Do **not** add any of the denied permissions. Bucket-lock/versioning inspection
is done with an operator/admin credential, not the VPS backup key.

> **Consequence:** because the VPS credential can neither delete objects, delete
> versions, nor bypass Governance retention, a full compromise of the VPS or the
> backup credential **cannot** erase or shorten the off-host backups. Retention
> is enforced by AWS, not by the VPS.

## Object Lock mode decision — Governance is intentional (accepted residual risk)

Object Lock is configured in **Governance** mode with a **30-day** default
retention. This was **deliberately selected**, not left as a default or an
unfinished step:

- **Compliance mode was considered but intentionally NOT enabled.** Compliance
  mode would make objects un-deletable even by the AWS account root/administrator
  for the full retention window. We chose Governance to preserve an **emergency
  administrative recovery path** for the AWS account owner (e.g. to correct a
  misconfiguration, remove genuinely erroneous data, or respond to a legal hold
  change) while still providing strong ransomware / credential-compromise
  resistance.
- **The production VPS backup credential cannot bypass Governance retention.**
  Governance-mode deletion requires the `s3:BypassGovernanceRetention`
  permission, which the `handla-backup` IAM user does **not** hold. Verified
  non-destructively: a `delete-object --bypass-governance-retention` call with
  the VPS credential returns `AccessDenied`. The VPS credential also cannot
  `DeleteObject`, `DeleteObjectVersion`, modify the bucket policy, modify the
  bucket ACL, or change Object Lock settings. Therefore **compromise of the VPS
  or of the backup credential cannot bypass backup retention** — the exact
  ransomware/insider threat this control exists to stop.
- **Administrative bypass is an ACCEPTED residual risk.** Because the mode is
  Governance, a *trusted AWS administrative principal* holding
  `s3:BypassGovernanceRetention` (account root or a privileged admin, none of
  which live on the VPS) could delete a locked object before its retention
  expires. This bypass is restricted to trusted administrative identities, is
  explicitly accepted as the cost of retaining an emergency recovery path, and
  is **not** an unfinished security control. It is listed as a residual risk in
  the security assessment.

> Do **not** change Object Lock to Compliance mode, and do **not** grant the
> backup credential (or any VPS-resident credential) `BypassGovernanceRetention`,
> `DeleteObject`, or `DeleteObjectVersion`. Doing either would break the accepted
> risk model above.

## Retention / lifecycle model (provider-side; VPS performs no off-host deletion)

The VPS credential has **no delete rights**, objects are immutable for the
30-day Object Lock window, and the backup script performs **no off-host
deletion**: client-side deletion-based retention is **disabled**
(`OFFHOST_PRUNE=false` in `backup.conf`). The backup log records on every run:
`off-host retention: client-side prune DISABLED (immutable remote); expiry
handled by AWS lifecycle + Object Lock`. All off-host expiry is therefore
delegated to **provider-side AWS S3 Lifecycle rules**.

**Local staging (on the VPS):** `KEEP_LOCAL=3` encrypted copies (local files are
not under Object Lock and are safely pruned locally). The `RETAIN_DAILY/WEEKLY/
MONTHLY` variables remain in the template only for the optional non-immutable
(MinIO test) path; they are inert while `OFFHOST_PRUNE=false`.

**Off-host expiry — two operator-configured, verified AWS S3 Lifecycle rules
(both Enabled, scope = entire bucket):**

1. **`handla-backup-retention`** — *Enabled*, entire bucket:
   - **Expire current versions after 30 days.** A backup object's current
     version is expired 30 days after creation (this creates a delete marker;
     the object becomes a noncurrent version).
   - **Permanently delete noncurrent versions 1 day after they become
     noncurrent**, **subject to Object Lock retention** — a noncurrent version
     that is still within its 30-day Governance retention will not actually be
     removed until the lock permits it. In steady state this means an object is
     retained for its 30-day lock, then cleaned up by lifecycle shortly after.
   - **Newer noncurrent versions to retain: none** (0) — no extra generations
     are kept beyond the rule above.

2. **`handla-delete-marker-cleanup`** — *Enabled*, entire bucket:
   - **Delete expired object delete markers** — automatically removes the
     dangling delete markers left behind once all noncurrent versions under a
     key have been permanently deleted, keeping the bucket listing clean.

Lifecycle expiry always defers to Object Lock: nothing is physically deleted
before the 30-day Governance retention allows it (immutability wins). This is by
design and is why a shorter client-side 7/4/3 daily/weekly/monthly *deletion*
schedule is **not** attempted from the VPS — it would both fail (no permission)
and conflict with the lock.

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

## Residual risks (accepted / operator-owned)

- **Administrative Governance bypass (ACCEPTED).** Object Lock is Governance
  mode, so a *trusted AWS administrative principal* holding
  `s3:BypassGovernanceRetention` (account root / privileged admin — none present
  on the VPS or in the backup credential) could delete a locked backup before
  its retention expires. Deliberately accepted to preserve an emergency
  administrative recovery path; **not** an unfinished control. Mitigate with
  strong protection of the AWS account root/admin (hardware MFA, minimal admin
  principals, CloudTrail on the bucket).
- **DR decryption host trust.** Restore requires the off-VPS age private
  identity; it must only ever be brought onto a separate trusted machine, never
  the production VPS (which holds the public recipient only).
- **AWS account / provider dependency.** Off-host durability now depends on the
  AWS account remaining in good standing (billing, no accidental account-level
  lifecycle/lock changes). Owner-side account hygiene is required.

These are the only residual items; all VPS-reachable attack paths
(delete / version-delete / Governance-bypass / bucket-admin / cross-bucket /
public-access) are closed and were re-verified with no regression.
