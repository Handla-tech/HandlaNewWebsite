# Traefik Docker Socket Proxy Hardening

Isolate the shared production Traefik from the raw Docker daemon socket by
inserting a restricted, audited HAProxy-based allow-list proxy. Traefik keeps
full Docker **provider discovery** while losing the ability to POST to the
daemon (create privileged containers, exec, mount `/`, prune, read secrets…).

Host: `srv1642049` (Hostinger VPS, Ubuntu 24.04). Standalone Docker (Swarm
inactive). Shared Traefik is owned by the `tameerhome` compose project and
routes handla, homy and tameerhome domains.

---

## Architecture

### BEFORE

```
Traefik  ──(bind mount /var/run/docker.sock:ro)──►  Docker daemon (full API)
```

A `:ro` bind mount only makes the **socket file** read-only. The Docker **API
remains fully writable**, so a Traefik compromise = full host compromise.

### AFTER

```
Traefik ──tcp──► docker-socket-proxy ──(unix socket)──► Docker daemon
        (socketproxy_net, internal:true)   (allow-list: read-only endpoints)
```

* Traefik has **no** `docker.sock` mount. Its only mount is `/certs`.
* Traefik reaches the daemon **only** through `tcp://docker-socket-proxy:2375`.
* `docker-socket-proxy` is the **sole** container mounting `docker.sock`.
* `socketproxy_net` is an `internal: true` bridge — no gateway/NAT, unreachable
  off-host; only `traefik` + `docker-socket-proxy` are attached.
* The proxy publishes **no** host port.

---

## Allowed vs denied Docker API surface

Proxy image: `tecnativa/docker-socket-proxy:0.3.0`
(`sha256:9e4b9e7517a6b660f2cc903a19b257b1852d5b3344794e3ea334ff00ae677ac2`)

| Allowed (read) | Endpoint |
|---|---|
| `CONTAINERS=1` | `GET /containers/json`, `/containers/{id}/json` |
| `NETWORKS=1`   | `GET /networks`, `/networks/{id}` |
| `EVENTS=1`     | `GET /events` (live provider updates) |
| `INFO=1`       | `GET /info` |
| `VERSION=1`    | `GET /version` (API negotiation) |
| `PING=1`       | `GET /_ping` (health) |

Everything else is `0`, notably the `POST` master switch (blocks **all**
mutations) plus `AUTH BUILD COMMIT CONFIGS DISTRIBUTION EXEC IMAGES NODES
PLUGINS SECRETS SERVICES SESSION SWARM SYSTEM TASKS VOLUMES`.

Verified denied (HTTP 403): container create/start/exec/delete, image
create/list, volume create/list, build, system prune, secrets, nodes,
services, tasks, swarm.

Swarm/admin groups (`SERVICES/TASKS/NODES/SWARM`) are denied because this host
runs **standalone** Docker — Traefik does not need them.

---

## Files / config changed

| File | Change |
|---|---|
| `/opt/socket-proxy/docker-compose.yml` (VPS, project `socketproxy`) | **new** — proxy + `socketproxy_net` (this repo's `docker-compose.socket-proxy.yml`) |
| `/opt/tameerhome/docker-compose.yml` (VPS, shared Traefik) | traefik service: **removed** `/var/run/docker.sock` mount; **added** `--providers.docker.endpoint=tcp://docker-socket-proxy:2375`; **added** `socketproxy_net` (external) to networks |

No application code, MySQL, Redis, UFW, Docker daemon, or ACME storage was
modified. `acme.json` untouched (`root:root 600`, certs preserved).

---

## Deploy (already done in production)

```bash
# 1. proxy, as its own project (independent of app stacks)
cd /opt/socket-proxy
docker compose -p socketproxy up -d

# 2. edit /opt/tameerhome/docker-compose.yml (see table above), then:
cd /opt/tameerhome
docker compose up -d traefik        # recreate ONLY traefik
```

---

## Rollback plan

Backups (VPS `/root/handla-traefik-hardening/`):
`tameerhome-compose.yml.precutover.<ts>`, `traefik-inspect.bak.<ts>.json`,
`live-baseline-BEFORE.20260823.txt`, `routers-baseline.txt`,
`domains-baseline.txt`, `acme-metadata.<ts>.txt`.

To revert to the direct socket mount (does **not** touch app/db containers):

```bash
cp /root/handla-traefik-hardening/tameerhome-compose.yml.precutover.<ts> \
   /opt/tameerhome/docker-compose.yml
cd /opt/tameerhome
docker compose up -d traefik        # recreate ONLY traefik
# optional: docker compose -p socketproxy down   # remove proxy afterwards
```

The restored compose re-adds `/var/run/docker.sock:/var/run/docker.sock:ro`
and removes the proxy endpoint arg + `socketproxy_net`.

---

## Residual risk

* The proxy container still needs FS-level read/write on the unix socket (it
  forwards bytes); the security boundary is the HTTP allow-list, not the `:ro`
  mount. A bug in tecnativa's allow-list would be the remaining attack surface —
  mitigated by pinning a specific digest, `cap_drop: ALL`, `no-new-privileges`,
  and the internal-only network.
* `EVENTS`/`INFO` still expose container/network metadata (names, labels, IPs)
  to a compromised Traefik — this is read-only and required for discovery.
* Proxy rootfs is not read-only (tecnativa regenerates its HAProxy config at
  boot); compensated by dropped caps + no-new-privileges.

## Next recommended security item

Add `security_opt: no-new-privileges:true` + minimal `cap_drop` to the Traefik
container itself (separately approved change), and consider pinning Traefik to
an immutable digest.
