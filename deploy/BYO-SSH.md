# Deploying with Genspark's "Bring Your Own SSH Server" tool

This maps exactly to the tabs you see in the deploy panel (File Explorer ·
GitHub · Scripts · Skills · Tutorial · SSH · AI).

Your SSH host is already configured:

| Field   | Value                |
|---------|----------------------|
| Host    | `187.127.228.48`     |
| Port    | `22`                 |
| User    | `root`               |
| Auth    | Password             |
| Working directory | `/home/root` |

> Status shows **"Unknown"** — click **Test** (or **Test All**) on the SSH tab
> first to confirm the connection works before deploying.

---

## The command the tool should run (Scripts tab)

Everything is built so a **single command** brings up the whole site
(`mysql · redis · api · web · nginx · certbot`). Point the tool's deploy script
at the repo and run:

```bash
cd "$HOME/HandlaNewWebsite" && PULL=0 ./deploy.sh
```

- `deploy.sh` auto-detects the repo location (it does **not** assume
  `/opt/handla`), generates the root `./.env` Compose needs, then runs
  `docker compose up -d --build`. The `docker-compose.override.yml` overlay is
  auto-loaded, so the full production stack comes up.
- `PULL=0` tells it to deploy the working tree the tool checked out (via the
  **GitHub** tab) instead of doing its own `git reset`. If instead you rely on
  the repo being a git clone that should pull `main` itself, drop `PULL=0`:
  ```bash
  cd "$HOME/HandlaNewWebsite" && ./deploy.sh
  ```

Adjust the path (`$HOME/HandlaNewWebsite`) to wherever the tool actually places
the repo on the server — with working directory `/home/root`, that is typically
`/home/root/HandlaNewWebsite`. Run `pwd` / `ls` from the tool's terminal once to
confirm the exact folder name, then use that path.

---

## One-time prerequisites on the VPS (before the first deploy)

The deploy command above assumes these already exist on the server. Do them
once (they persist across deploys):

1. **Docker + Compose v2** — you said Docker is already installed. Verify:
   ```bash
   docker --version && docker compose version
   ```

2. **The repo is on the server.** Use the tool's **GitHub** tab to connect the
   repo, or clone it manually:
   ```bash
   cd /home/root
   git clone https://github.com/Handla-tech/HandlaNewWebsite.git
   cd HandlaNewWebsite && git checkout main
   ```

3. **`handla-backend/.env` with the real secrets** (never in git):
   ```bash
   cd /home/root/HandlaNewWebsite
   cp handla-backend/.env.production.example handla-backend/.env
   nano handla-backend/.env      # fill every __PLACEHOLDER__
   ```
   Generate JWT secrets with `openssl rand -hex 32` (two different ones).

4. **TLS certificates (once).** nginx will not start without them. Follow
   `DEPLOYMENT.md` §5 (bootstrap HTTP config → certbot → swap real config).
   You only do this the first time; certbot auto-renews after that.

5. **DNS A records** for `handla.tech`, `www`, and `api` → `187.127.228.48`.

After those, every deploy is just the one command in the Scripts tab.

---

## What each of your other tabs is for

- **GitHub** — connect/checkout the repo onto the server. Point it at
  `Handla-tech/HandlaNewWebsite`, branch `main`.
- **Scripts** — where you paste the deploy command above.
- **SSH** — the host you already added; use **Test** to verify connectivity.
- **File Explorer** — browse `/home/root` to confirm the repo path and to
  create/edit `handla-backend/.env` if you prefer a GUI over `nano`.

---

## ⚠️ If the VPS already runs Traefik (shared box)

This VPS also serves another site (`tameerhome.tech`) behind a **Traefik**
reverse proxy that already owns ports 80/443. Handla's own nginx+certbot cannot
coexist with it. Use the **Traefik overlay** instead — Traefik terminates TLS and
routes by hostname; Handla runs no nginx/certbot:

```bash
cd /opt/handla
# proxy = Traefik's external docker network; letsencrypt = its ACME certresolver
TRAEFIK_NETWORK=proxy TRAEFIK_CERTRESOLVER=letsencrypt ./deploy/deploy.traefik.sh
```

This:
- attaches `handla_web` (port 3000) and `handla_api` (port 3001) to Traefik's
  `proxy` network with labels routing `handla.tech`/`www` → web and
  `api.handla.tech` → api, TLS via Traefik's existing `letsencrypt` resolver;
- removes any conflicting `handla_nginx` / `handla_certbot` containers;
- **touches nothing** in the other project — Traefik and tameerhome stay up.

Skip DEPLOYMENT.md §5 (certbot bootstrap) entirely on a Traefik box — Traefik
issues the certs. If Traefik's network/resolver/entrypoint are named
differently, override `TRAEFIK_NETWORK`, `TRAEFIK_CERTRESOLVER`, and
`TRAEFIK_ENTRYPOINT` (default `websecure`).

---

## Verify after deploy

```bash
cd /opt/handla        # (or /home/root/HandlaNewWebsite)
docker compose ps
curl -s https://api.handla.tech/api/health
# then open https://handla.tech in a browser
```
