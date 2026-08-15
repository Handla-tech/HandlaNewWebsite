# Handla — Production Deployment Runbook (Hostinger VPS)

This document is the single source of truth for deploying Handla to the
Hostinger VPS with automatic deploys from the `main` branch via GitHub Actions.

```
 dev (local work) ──PR──> main ──push──> GitHub Actions ──SSH──> VPS ──> LIVE
                                          (tests + build)      (pull+build+up)
```

- **Frontend:** `https://handla.tech`  (Next.js container, port 3000, behind nginx)
- **API:**      `https://api.handla.tech`  (NestJS container, port 3001, behind nginx)
- **Stack on the VPS:** `nginx · web · api · mysql · redis · certbot` (Docker Compose)

---

## 0. One-time: DNS

In your DNS provider for `handla.tech`, create **A records** pointing at the VPS IP:

| Type | Name  | Value (VPS IP) |
|------|-------|----------------|
| A    | `@`   | `YOUR_VPS_IP`  |
| A    | `www` | `YOUR_VPS_IP`  |
| A    | `api` | `YOUR_VPS_IP`  |

Wait for propagation (`dig +short api.handla.tech` should return the VPS IP).

---

## 1. One-time: Secure the VPS

SSH in as root, then:

```bash
# 1. Change the root password to something strong & unique
passwd

# 2. Create a deploy user (optional but recommended) OR keep root for now.
# 3. Set up SSH KEY auth for GitHub Actions (see §4) and disable password login
#    ONLY after you've confirmed key login works:
#    /etc/ssh/sshd_config -> PasswordAuthentication no ; systemctl restart ssh

# 4. Firewall: allow SSH + HTTP + HTTPS only
apt-get update && apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## 2. One-time: Install Docker + clone the repo

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version

# Clone the repo to /opt/handla
mkdir -p /opt/handla
git clone https://github.com/Handla-tech/HandlaNewWebsite.git /opt/handla
cd /opt/handla
git checkout main
```

---

## 3. One-time: Create the backend `.env` on the VPS

The `.env` holds secrets and is **never** in git. Create it from the template:

```bash
cd /opt/handla
cp handla-backend/.env.production.example handla-backend/.env
nano handla-backend/.env   # fill in every __PLACEHOLDER__
```

Generate strong secrets where the template says so:

```bash
openssl rand -hex 32   # for JWT_SECRET
openssl rand -hex 32   # for JWT_REFRESH_SECRET (must differ)
```

Fill in: DB passwords, AWS keys, OpenAI key, Hostinger mail password, Google
client id/secret, admin password. Leave `DATABASE_HOST`/`REDIS_HOST` unset
(compose injects `mysql`/`redis`).

---

## 4. One-time: SSH key for GitHub Actions

On your **local machine** (or the VPS), generate a dedicated deploy key:

```bash
ssh-keygen -t ed25519 -C "handla-github-actions" -f ~/.ssh/handla_deploy -N ""
```

- Add the **public** key to the VPS:
  ```bash
  ssh-copy-id -i ~/.ssh/handla_deploy.pub root@YOUR_VPS_IP
  # or append ~/.ssh/handla_deploy.pub to /root/.ssh/authorized_keys on the VPS
  ```
- Test it: `ssh -i ~/.ssh/handla_deploy root@YOUR_VPS_IP` should log in with no password.

Then add these **GitHub repository secrets**
(`Settings → Secrets and variables → Actions → New repository secret`):

| Secret name        | Value                                            |
|--------------------|--------------------------------------------------|
| `VPS_HOST`         | `YOUR_VPS_IP` (or `api.handla.tech`)             |
| `VPS_USER`         | `root` (or your deploy user)                     |
| `VPS_SSH_PORT`     | `22`                                             |
| `VPS_SSH_KEY`      | contents of the **private** key `~/.ssh/handla_deploy` |
| `VPS_HANDLA_DIR`   | `/opt/handla`                                    |

---

## 4b. One-time: Install the GitHub Actions workflow

The deploy workflow lives at `deploy/github-actions-deploy.yml` in the repo, but
it must be placed at `.github/workflows/deploy.yml` to run. (Automated tooling
cannot create files under `.github/workflows/` without special permission, so
this is a one-time manual step.)

Easiest — via the GitHub web UI:
1. Go to the repo → **Add file → Create new file**
2. Name it exactly: `.github/workflows/deploy.yml`
3. Paste the contents of `deploy/github-actions-deploy.yml`
4. Commit to `main`.

Or from a machine with a normal git login:
```bash
mkdir -p .github/workflows
cp deploy/github-actions-deploy.yml .github/workflows/deploy.yml
git add .github/workflows/deploy.yml && git commit -m "ci: add deploy workflow" && git push
```

## 5. One-time: Issue TLS certificates (first boot)

Certs don't exist yet, so start nginx with the **bootstrap** (HTTP-only) config:

```bash
cd /opt/handla

# Use the HTTP-only config for issuance
mkdir -p deploy/nginx/conf.d.bak
mv deploy/nginx/conf.d/handla.conf deploy/nginx/conf.d.bak/
cp deploy/nginx/bootstrap/handla.bootstrap.conf deploy/nginx/conf.d/

# Bring up just what's needed to answer the ACME challenge
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d nginx

# Issue certs (staging first is optional; below is production issuance)
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d handla.tech -d www.handla.tech -d api.handla.tech \
  --email admin@handla.tech --agree-tos --no-eff-email

# certbot also needs the TLS options files nginx includes:
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml run --rm --entrypoint sh certbot -c '
  curl -s https://raw.githubusercontent.com/certbot/certbot/main/certbot-nginx/src/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > /etc/letsencrypt/options-ssl-nginx.conf;
  openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048'

# Swap the real TLS config back in
rm deploy/nginx/conf.d/handla.bootstrap.conf
mv deploy/nginx/conf.d.bak/handla.conf deploy/nginx/conf.d/
```

---

## 6. First full deploy (manual)

```bash
cd /opt/handla
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

This builds all images and starts the stack. The **api entrypoint runs TypeORM
migrations automatically** before the API starts. Verify:

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
curl -s https://api.handla.tech/api/health
# open https://handla.tech in a browser
```

---

## 7. Ongoing: automatic deploys

From now on, the flow is:

```bash
# locally
git checkout dev
# ...make changes, test locally...
git commit -am "feat: my change"
git push origin dev
# open a PR dev -> main, review, merge
```

Merging into `main` triggers `.github/workflows/deploy.yml`:
1. runs backend tests + frontend build
2. SSHes into the VPS
3. `git reset --hard origin/main` + rebuild + `docker compose up -d`
4. migrations run automatically

Watch progress in the repo's **Actions** tab.

---

## 8. Post-deploy checklist / Google console

- In **Google Cloud Console → Clients**, add the production redirect URI:
  `https://api.handla.tech/api/auth/google/callback`
  and JavaScript origins `https://handla.tech`, `https://api.handla.tech`.
- **Publish** the OAuth consent screen (so any Google user can sign in, not just
  test users).
- Add the S3 bucket CORS origin `https://handla.tech` (and `https://api.handla.tech`).

---

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| Actions deploy fails at SSH | `VPS_SSH_KEY` secret is the **private** key; key added to VPS `authorized_keys` |
| nginx won't start | certs missing → redo §5; or `docker logs handla_nginx` |
| API 502 | `docker logs handla_api` (usually a bad `.env` value or DB not ready) |
| No emails | `docker logs handla_api` for Bull errors; confirm Redis healthy; check MAIL_* |
| Migrations error | `docker logs handla_api` — the entrypoint prints the failing migration |
| Google login fails in prod | redirect URI mismatch; consent screen still in "testing" |

Useful commands:
```bash
cd /opt/handla
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs -f api
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml restart api
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
```
