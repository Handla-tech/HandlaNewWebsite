# Handla — Real Off-Host Provider Cutover (OPERATOR ACTION REQUIRED)

> **Status: BLOCKED — awaiting operator-supplied credentials for a real,
> independent object-storage provider.**
>
> The backup + restore pipeline is fully implemented and proven end-to-end
> against a loopback MinIO S3-compatible stand-in. It **cannot** be pointed at a
> real independent provider by the agent because **no such credentials exist on
> the VPS**, and the only cloud key present (the app's AWS IAM user) is
> deliberately least-privileged and **cannot create or manage a backup bucket**.
> Per policy, credentials were **not fabricated** and the app IAM policy was
> **not weakened**.

## Why the cutover is blocked (evidence)

Searched the VPS (root) — none of the following exist:
- `/root/.aws/credentials` / `/root/.aws/config` — **absent**
- `/root/.config/rclone/rclone.conf` — **absent** (only `/etc/handla-backup/rclone.conf`, still the MinIO stand-in)
- `/root/.b2_account_info`, `/root/.config/b2` — **absent**
- No `B2_*`, `R2_*`, `BACKBLAZE`, `CLOUDFLARE_R2`, Hostinger object-storage, or
  `BACKUP_*` provider env in shell profiles, `/etc/environment`, or `/opt`.

The only real cloud credential on the box is the **app** IAM user
`arn:aws:iam::914773267354:user/handla-backend`. AWS itself confirms it is
scoped and cannot manage a backup bucket:

```
s3:CreateBucket  handla-production-backups  -> 403 AccessDenied (no policy allows it)
s3:ListAllMyBuckets                         -> 403 AccessDenied
```

It is also forbidden to reuse `handla-uploads` (Phase 2) or to broaden the app
policy. Therefore a real independent provider must be provisioned out-of-band.

## EXACT information the operator must provide

Pick ONE independent provider (must be OUTSIDE this VPS's disk/failure domain).
Fill in and hand back these values (secret key via a secure channel, **never** in git):

| Field | Value needed |
|---|---|
| Provider | AWS S3 / Backblaze B2 / Cloudflare R2 / Hostinger Object Storage / other S3-compatible |
| Endpoint | e.g. `https://<accountid>.r2.cloudflarestorage.com` (R2), `https://s3.<region>.backblazeb2.com` (B2), native for AWS |
| Region | e.g. `eu-north-1`, `eu-central-003`, `auto` |
| Bucket name | `handla-production-backups` (or unique equivalent; NOT `handla-uploads`) |
| Access key ID | dedicated **backup** credential (see privilege model below) |
| Secret access key | (supply via secure channel — not committed, not logged) |
| Object Lock capable? | yes/no — **strongly prefer yes** |
| Versioning capable? | yes/no |

## Provider setup the operator must perform (matches Phases 2–4)

1. **Create a dedicated bucket** `handla-production-backups`:
   - Private; **block all public access**; no anonymous GET/LIST.
   - **Encryption at rest** enabled (SSE-S3/SSE-KMS or provider equivalent).
   - **Versioning enabled**.
   - **Object Lock enabled at creation** (AWS S3 requires enabling Object Lock
     when the bucket is created) — Compliance mode preferred; Governance mode
     acceptable if a separate admin can still perform emergency legal-hold ops.
     Set a retention period aligned with the retention baseline (below).
2. **Create a dedicated backup credential** (NOT the app key) scoped to that
   bucket only, with **least privilege**:
   - Allow: `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`
     (+ multipart: `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts` if needed).
   - **Deny / omit**: `s3:DeleteObject`, `s3:DeleteObjectVersion`,
     `s3:PutBucketPolicy`, `s3:PutObject*Acl`, `s3:DeleteBucket`, any IAM/admin.
   - Retention/expiry handled by **provider-side lifecycle policy**, NOT by the
     backup credential's DELETE rights.
3. **Retention baseline** (implement via lifecycle + Object Lock, adjust to
   provider): 7 daily / 4 weekly / 3 monthly. With Object Lock, objects cannot be
   deleted before their retention expires even by an admin (Compliance mode).

## Agent steps once credentials are provided (Phases 5–20, ready to run)

The pipeline is already coded for this; only the remote config changes.

1. Write `/etc/handla-backup/rclone.conf` (root:root 0600) using the provider
   block in `rclone.conf.example` (AWS/B2/R2 templates included). Remote name
   stays `handlabackup`. Remove the MinIO block from the production config.
2. Connectivity test with a disposable object: LIST, PUT, GET, checksum compare;
   confirm DELETE is denied (expected for the no-DELETE credential).
3. Unauthenticated access test → expect `403 AccessDenied`.
4. `handla-backup` (real provider) → record ts / DB size / config size / duration.
5. Verify remote object: exists, size, checksum, version ID, Object-Lock metadata.
6. `handla-restore-drill` sourcing **from the real provider** → 36 tables,
   migrations rows, indexes/FKs validated in a throwaway MySQL 8 container.
7. Config restore check (filenames only), then shred temp files.
8. Immutability test (delete denied) + versioning test (v1/v2 recover) on a
   disposable object.
9. Confirm systemd timer still points at the (now real) `handla-backup`.
10. Re-run the failure simulation; then update this doc + `DISASTER-RECOVERY.md`
    + `README.md` to name the real provider and its immutability posture.

## What is already proven (unchanged, do not redo)
Encrypted-before-upload (age, VPS holds public key only), SHA-256 integrity,
fail-closed pipeline, systemd daily timer, local + off-host retention logic,
restore drill (36 tables / 23 migrations / 153 indexes / 22 FKs), failure
simulation, permissions lockdown. See `README.md`.
