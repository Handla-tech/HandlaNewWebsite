# Handla — Disaster Recovery Runbook

> Rebuild Handla production from an off-host, encrypted backup after total VPS
> loss/compromise. **No secret values appear in this document.**
>
> **Off-host target status:** LIVE on **AWS S3** — bucket
> `handla-production-backups` (region `eu-north-1`), rclone remote
> `handla-backups-aws`, versioning + Object Lock (Governance, 30d), Block Public
> Access. Dedicated IAM user `handla-backup` (PUT/GET/LIST, no DELETE). Cutover
> verified end-to-end (backup → real-AWS restore). See `REAL-PROVIDER-CUTOVER.md`.
> Restore steps below are provider-agnostic; the active remote is
> `handla-backups-aws:handla-production-backups`.

## 0. Recovery inputs you must have OFF the VPS
- **age private identity** (`handla-backup-identity.key`) — decrypts every backup.
  Stored in the team password manager / offline vault, **never only on the VPS**.
- **AWS backup credentials** for the `handla-backup` IAM user / rclone remote
  `handla-backups-aws` (PUT/GET/LIST on `handla-production-backups`). For a
  restore you additionally need GET on the bucket (the backup key already has it).
- GitHub access to `Handla-tech/HandlaNewWebsite` (source of truth for code/infra).
- Provider consoles: AWS (S3 `handla-uploads` + `handla-production-backups`), DNS, SMTP/OAuth.

## 1. RPO / RTO
- **RPO:** 24h (daily 02:30 UTC DB + config backup). Loss window ≤ last successful run.
- **RTO:** 2–4h for a documented single-VPS rebuild.

## 2. Clean rebuild — new VPS
1. Provision Ubuntu 24.04 VPS. Install Docker + Compose plugin.
2. `git clone` the repo; check out the production SHA.
3. Install the trusted deployment wrapper (as per repo deploy docs).
4. **Restore secrets/config** (section 3).
5. **Restore the database** (section 4).
6. Configure S3 (`handla-uploads` creds), Redis, Traefik socket-proxy from repo compose.
7. Deploy the stack; wait for all containers `healthy`.
8. Verify: API health endpoint, DB row counts, login/OAuth, S3 object fetch.

## 3. Restore production config/secrets
```
# bring the age identity to a secure workstation (NOT the new VPS long-term)
rclone copyto handla-backups-aws:handla-production-backups/daily/<TS>/handla-config-prod_<TS>.tar.gz.age ./cfg.age
sha256sum -c handla-config-prod_<TS>.tar.gz.age.sha256
age -d -i handla-backup-identity.key ./cfg.age | tar -tzvf -     # inspect members
age -d -i handla-backup-identity.key ./cfg.age | tar -xzf - -C /restore
# place /opt/handla-production-secrets/backend.env with root:root 0600
```

## 4. Restore the database
```
rclone copyto handla-backups-aws:handla-production-backups/daily/<TS>/handla-db-prod_<TS>.sql.gz.age ./db.age
sha256sum -c handla-db-prod_<TS>.sql.gz.age.sha256
age -d -i handla-backup-identity.key ./db.age | gunzip -c > dump.sql   # 0600, temp
# import into the NEW production MySQL (only during rebuild, never over live data):
docker exec -i -e MYSQL_PWD=<root> handla_mysql mysql -uroot < dump.sql
shred -u dump.sql
```
Validate: `handla_db` exists, 36 tables, `migrations` present (23 rows baseline),
indexes/FKs present. See `handla-restore-drill.sh` for the exact checks.

## 5. Rollback / disable
- Disable automation: `systemctl disable --now handla-backup.timer`.
- The backup process is **non-destructive** to production; disabling only stops
  new backups. Existing off-host objects and local copies are untouched.

## 6. Residual risk
See `README.md` §Compromise resilience. Backups made with credentials held on a
compromised VPS are only as safe as the provider's immutability model — enable
**Object Lock / versioning** on the real backup bucket.
