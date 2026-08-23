# Deploy User Hardening — GitHub Actions → `handla-deploy`

**Status:** Implemented on the VPS; CI cutover pending GitHub Secret update (see §5).
**Scope:** Replace root-based GitHub Actions deployment with a dedicated
least-privilege account **without** breaking CI/CD. No application code, database,
MySQL, Redis, Docker-socket, Traefik, or firewall changes were made.

---

## 1. Summary

| Item | Before | After |
|---|---|---|
| GitHub Actions SSH user | `root` | `handla-deploy` (UID 1001) |
| Authentication | SSH key (root `authorized_keys`) | dedicated SSH key (key-only) |
| Password login | disabled globally | disabled globally + account password locked |
| `/opt/handla` owner | `root:root` | `handla-deploy:handla-deploy` |
| Docker access | root | `docker` group membership (⚠ root-equivalent) |
| Sudo | n/a (was root) | **none** — no sudoers entry required |

The deployment path (`/opt/handla` → `./deploy/deploy.traefik.sh`) and topology
(Internet → Traefik → Next.js/NestJS; Docker: `handla_web`, `handla_api`,
`handla_mysql`, `handla_redis`) are unchanged.

## 2. The `handla-deploy` account

- Created with `useradd --create-home --shell /bin/bash`, password **locked**
  (`passwd -l`) → no usable password, key-only.
- Home `/home/handla-deploy`; `.ssh` mode `700`; `authorized_keys` mode `600`,
  owned by `handla-deploy`.
- Groups: primary `handla-deploy`; supplementary **`docker`** (required by the
  deploy script — see §4).
- No sudo rights (`sudo -l` → "not allowed").

## 3. Repository access model

`/opt/handla` (including `.git`) is owned by `handla-deploy:handla-deploy`, so the
deploy user can `git fetch` / `checkout main` / `reset --hard` and write the
Compose `./.env` **without root**. The two secret files
(`./.env`, `handla-backend/.env`) remain mode **600** (owner + root only — never
world/group readable; no `chmod 777` anywhere). `git config --global
safe.directory /opt/handla` is set for the deploy user.

## 4. Docker permission model — ⚠ root-equivalent

`deploy.traefik.sh` runs `docker compose build/up`, `docker rm`, `docker network
inspect`, `docker image prune`. This requires access to the Docker socket
(`/var/run/docker.sock`, `root:docker` 660), granted via **`docker` group
membership**.

> **RISK (documented, not hidden):** membership in the `docker` group is
> **effectively root on the host** — a group member can `docker run -v /:/host`
> and read/write any file as root. This is therefore **NOT strict privilege
> separation**; it is an accepted **transitional** model because the current
> deploy script fundamentally needs unrestricted Docker. Restricting this
> (rootless Docker or a socket-proxy with a minimal allowed API surface) is a
> **separate later phase** and out of scope here.

## 5. GitHub Actions change (`.github/workflows/deploy.yml`)

- `username: ${{ secrets.VPS_USER || 'handla-deploy' }}` — the non-root user is
  pinned in-code and visible in review; the secret may override but must never be
  `root`.
- Added a **preflight** that aborts the deploy if the remote session is `root`
  (`whoami`/`id -u`), preventing silent regression to root.
- `host`, `port`, `key`, `HANDLA_DIR`, `TRAEFIK_NETWORK`, branch behavior and the
  deploy script are all preserved. Secret **names** are unchanged.

### Manual secret update required (cannot be done from the repo)

On GitHub → repo **Settings → Secrets and variables → Actions**:

1. **`VPS_SSH_KEY`** → replace with the **private** key of the dedicated
   deploy key pair (generated on the VPS at `/root/handla-deploy-key/`, never
   committed or printed). Public key installed in
   `/home/handla-deploy/.ssh/authorized_keys`:
   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP1VQoCsCdvGm4nWO2guLOSdhyBSfy00obN9WvE35Gxe handla-deploy@github-actions
   ```
   Fingerprint: `SHA256:sWkN5oSb81bT7BPVhvVzyzhFIR6JDEb2Wr3/bhuDF2s`
2. **`VPS_USER`** → set to `handla-deploy` (or delete it to use the in-code
   default). Must **not** be `root`.
3. Leave `VPS_HOST`, `VPS_SSH_PORT`, `VPS_HANDLA_DIR`, `VPS_TRAEFIK_NETWORK`
   unchanged.

Until the secrets are updated, CI continues to connect as whatever `VPS_USER`
currently is; the preflight will **fail loudly** if that is root once this
workflow is merged, which is the intended safety behavior for the cutover.

## 6. SSH / root recovery policy

- Global SSH hardening unchanged: `PasswordAuthentication no`,
  `PermitRootLogin prohibit-password`, `PubkeyAuthentication yes`.
- `AllowUsers`/`AllowGroups` **deliberately not introduced** (root holds
  provider-managed and admin keys; an allowlist risks admin lockout).
- **Root key SSH remains available for administrative recovery.** Only the
  dedicated GitHub-Actions deploy key is to be removed from root's
  `authorized_keys` — and only **after** a successful CI deploy as
  `handla-deploy` (Phase 13). Personal/admin/provider keys are preserved.

## 7. Rollback

- Revert this workflow file (restore `username: ${{ secrets.VPS_USER }}`) and set
  `VPS_USER`/`VPS_SSH_KEY` back to the root deploy key → CI deploys as root again.
- Ownership rollback (if ever needed): `chown -R root:root /opt/handla`.
- Ownership baseline saved on the VPS at
  `/root/handla-deploy-key/ownership-baseline.txt`.

## 8. Residual risk & next phase

- **Docker-group = root-equivalent** (see §4) — the main residual privilege.
- Next recommended hardening phase: **Docker socket hardening** (rootless Docker
  or socket-proxy), then MySQL and Redis hardening — each as separate tasks.
