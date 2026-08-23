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
Local: 3 encrypted copies. Off-host: daily 7 / weekly 4 / monthly 3 (age-based
prune; tolerated/skipped if the remote is immutable).

## S3 user-file recovery (`handla-uploads`)
S3 is the durable copy for user uploads. The app IAM user is least-privileged and
**cannot** read bucket versioning (`GetBucketVersioning` denied), so versioning
state is undetermined via the app credential. **Recommendation:** enable
**versioning + lifecycle** on `handla-uploads` from the AWS console (low-risk,
protects against accidental/malicious object deletion). Do not make the bucket public.

## Compromise / ransomware resilience
- Backups are encrypted before leaving the VPS; the bucket is private (unauth = 403).
- **Residual risk:** the backup upload credential lives on the VPS. A root-level
  compromise could, if the remote allows `DeleteObject`, delete off-host backups.
  **Mitigation (operator action on the real provider):** use a dedicated backup
  credential scoped to `PUT/LIST/GET` only (no `DELETE`) and enable **Object Lock /
  immutable retention / versioning**. Templates already note this.

## Real-provider cutover (BLOCKED — currently a stand-in)
The pipeline is proven end-to-end against a **loopback-only MinIO S3-compatible
stand-in** (identical rclone S3 code path). Going live on a real independent
provider is **blocked pending operator-supplied credentials**: no dedicated
backup-provider credentials exist on the VPS, and the app's AWS IAM user is
least-privileged and cannot create/manage a backup bucket
(`s3:CreateBucket` / `s3:ListAllMyBuckets` → 403 AccessDenied). Credentials were
not fabricated and the app IAM policy was not changed.

**See `REAL-PROVIDER-CUTOVER.md`** for the exact provider/bucket/credential
requirements the operator must supply, and the ready-to-run agent steps once
they are provided.

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
