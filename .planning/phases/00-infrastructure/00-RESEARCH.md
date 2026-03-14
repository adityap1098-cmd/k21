# Phase 0: Infrastructure - Research

**Researched:** 2026-03-14
**Domain:** Docker Compose, Nginx/SSL, PgBouncer, Redis/BullMQ, CI/CD, Backblaze B2 backup, Netdata monitoring, pnpm workspaces
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Monorepo with pnpm workspaces** — single repo, no Turborepo
- Layout: `apps/api/` (Express.js TypeScript), `apps/web/` (Next.js), `packages/shared/` (@k21/shared)
- `packages/shared` contains API response types, request schemas, domain types used by both apps
- Express API: domain-driven folders — `src/modules/inventory/`, `src/modules/pos/`, `src/modules/finance/`, etc.
- `.env.example` committed; `.env` is gitignored
- **Docker Compose split:** `docker-compose.yml` (base) + `docker-compose.prod.yml` (prod overrides) + `docker-compose.dev.yml` (dev overrides)
- Nginx + Let's Encrypt only in production. Local dev hits api at `:3001` and web at `:3000` directly
- **Single internal Docker bridge network (`k21-net`)** — only Nginx (80/443) exposed externally; PgBouncer and Redis NOT exposed to host
- Services: nginx, api, web, postgres, pgbouncer, redis, netdata, backup
- **GitHub Actions secrets → SSH at deploy time** — CI/CD writes `.env` on VPS; secrets never committed
- GPG key stored as base64-encoded GitHub Actions secret AND offline backup
- **Deploy:** GitHub Actions → SSH → `git pull` → `docker compose build + up -d` (no container registry)
- 10-30 seconds downtime acceptable
- **Rollback:** manual SSH + `git reset --hard <sha>` + `docker compose up -d`
- **CI/CD gates:** lint → type-check → test → deploy (all must pass)
- **Stack locked:** Node.js + Express.js + TypeScript, Next.js, PostgreSQL, Redis, BullMQ, Drizzle ORM, Docker Compose
- **PgBouncer TRANSACTION mode** — requires `postgres.js` driver with `{ prepare: false }`. Drizzle ORM must be configured with `postgres.js`.
- Budget: ≤ Rp500.000/month; target Hetzner CX32 ≈ Rp292.000/month
- API versioning from Phase 0: Express router structure must support `/api/v1/` prefix (routes registered but no endpoints yet)

### Claude's Discretion
- Health check configuration per service (intervals, retries, start_period)
- Docker log rotation values (max-size: 10m, max-file: 5 — specified in requirements)
- Netdata configuration details (bind to localhost:19999)
- Backup script implementation details (shell script in a dedicated backup container with cron)
- PgBouncer pool_size and connection limits tuning
- Exact GitHub Actions runner configuration (ubuntu-latest)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Docker Compose on VPS with Nginx, SSL Let's Encrypt, auto-renew | Certbot sidecar container with renewal loop; nginx + certbot shared volume pattern |
| INFRA-02 | PostgreSQL with PgBouncer connection pooling (TRANSACTION mode, `postgres.js`) | `postgres.js` with `{ prepare: false }`; PgBouncer `pool_mode = transaction`; pgbouncer.ini + userlist.txt config files |
| INFRA-03 | Redis as cache layer and BullMQ job queue storage | Redis with `maxmemory-policy noeviction`; BullMQ connection via ioredis options |
| INFRA-04 | CI/CD via GitHub Actions — auto-deploy to VPS on push to main | SSH key in Actions secrets; `appleboy/ssh-action`; write .env then docker compose up |
| INFRA-05 | Docker log rotation on all services (max-size: 10m, max-file: 5) | Logging driver config in each service definition |
| INFRA-06 | Nightly backup: pg_dump + gzip + GPG encryption + Backblaze B2 upload | Shell script in backup container; `rclone` for B2 upload; GPG symmetric or asymmetric encryption |
| INFRA-07 | Backup retention: keep 7 days, auto-delete older | `rclone delete --min-age 7d` or B2 lifecycle rules |
| INFRA-08 | Monitoring: UptimeRobot (external ping) + Netdata (localhost only, CPU/RAM/Disk) | Netdata Docker with `ports: ["127.0.0.1:19999:19999"]`; UptimeRobot free tier HTTP monitor |
</phase_requirements>

---

## Summary

Phase 0 is a pure infrastructure phase — no application features, no business logic. The goal is to produce a running, monitored, backed-up Docker Compose stack that all subsequent phases build on top of. The technical domain spans six distinct areas: monorepo scaffolding, Docker Compose multi-environment orchestration, SSL termination with auto-renewal, database connection pooling, CI/CD automation, encrypted off-site backup, and internal monitoring.

All major decisions are locked (stack, network topology, secrets strategy, deploy approach), which makes this primarily an integration and configuration engineering problem rather than a design problem. The most common failure mode in this type of phase is subtle misconfiguration — PgBouncer transaction mode incompatibility with prepared statements, certificate bootstrapping ordering problems, and backup scripts that appear to work but fail silently on restore.

The single biggest technical risk is the Certbot bootstrap problem: on first deploy, Nginx cannot start without certificates, but Certbot cannot obtain certificates without a running HTTP server. This chicken-and-egg problem requires a two-stage bootstrapping approach and must be explicitly sequenced in the plan.

**Primary recommendation:** Build and validate each layer independently (pnpm workspace scaffold → Docker Compose networking → SSL bootstrap → database + PgBouncer → backup → monitoring → CI/CD), then write an integration smoke test that verifies the full stack end-to-end before declaring Phase 0 complete.

---

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| pnpm | 9.x | Package manager + workspace orchestration | Native workspace support; fastest installs; `pnpm deploy` for Docker isolation |
| Docker Compose | v2 (plugin) | Service orchestration | Lock-in free, single-VPS native; no Kubernetes overhead |
| Nginx | 1.25+ (stable) | Reverse proxy + SSL termination | Industry standard; battle-tested; Let's Encrypt Certbot integration |
| Certbot (certbot/certbot) | latest | Let's Encrypt certificate issuance + renewal | Official ACME client; widely documented Docker patterns |
| PostgreSQL | 16 | Primary database | Current stable LTS; strong JSONB support for future audit payloads |
| PgBouncer | 1.23+ | Connection pooler in TRANSACTION mode | Required for ERP connection volumes; 1.21+ has optional prepared statement support |
| Redis | 7.x | Cache + BullMQ backing store | Stable; supports `noeviction` policy needed by BullMQ |
| BullMQ | 5.x | Job queue backed by Redis | Successor to Bull; TypeScript-first; used by marketplace/analytics jobs |
| postgres.js | 3.x | PostgreSQL driver | Only Node driver that works cleanly with PgBouncer transaction mode via `{ prepare: false }` |
| Drizzle ORM | 0.30+ | Type-safe query builder | Configured with `postgres.js`; does not auto-emit prepared statements |
| Netdata | latest stable | Host + container monitoring | Zero-config Docker metrics; lightweight; localhost-only bind |
| rclone | latest | B2 backup upload | Native Backblaze B2 support; supports retention deletion |
| GitHub Actions | - | CI/CD automation | Native to GitHub; free for public; secrets integration |

### Supporting
| Library / Tool | Purpose | When to Use |
|----------------|---------|-------------|
| `appleboy/ssh-action` | SSH command execution from Actions | Deploy step — SSH into VPS, write .env, run docker compose |
| `appleboy/scp-action` | File copy over SCP from Actions | Alternative if .env needs to be written separately |
| GPG (gnupg2) | Symmetric or asymmetric backup encryption | Backup container; key stored as base64 Actions secret |
| `pg_isready` | PostgreSQL healthcheck | Built into postgres image; use in Compose healthcheck |
| `redis-cli ping` | Redis healthcheck | Built into redis image; use in Compose healthcheck |
| TypeScript | 5.x | Static typing across monorepo | Root-level devDependency; consistent across apps |
| ESLint | 9.x | Linting gate in CI | Part of lint → type-check → test CI sequence |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Certbot sidecar | Caddy (auto HTTPS) | Caddy is simpler but user explicitly chose Nginx |
| rclone + B2 | AWS S3 + aws cli | B2 chosen for cost; rclone abstracts the API |
| `appleboy/ssh-action` | Raw `ssh` in bash step | Action handles key setup; less boilerplate |
| `postgres.js { prepare: false }` | `pg` (node-postgres) | `pg` does not support PgBouncer transaction mode cleanly; decision locked |

**Installation (monorepo root):**
```bash
# Root dependencies
pnpm add -Dw typescript eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# API app
pnpm add --filter @k21/api postgres drizzle-orm bullmq ioredis express
pnpm add -D --filter @k21/api drizzle-kit @types/express

# Web app (Next.js already brings its deps)
pnpm add --filter @k21/web next react react-dom
```

---

## Architecture Patterns

### Recommended Project Structure
```
k21/                              # repo root
├── pnpm-workspace.yaml           # workspace: [apps/*, packages/*]
├── package.json                  # root scripts (lint, typecheck, test)
├── tsconfig.base.json            # shared TS config extended by each app
├── .env.example                  # all required var names with placeholders
├── .github/
│   └── workflows/
│       └── ci-cd.yml             # lint → typecheck → test → deploy
├── docker-compose.yml            # base service definitions
├── docker-compose.prod.yml       # prod overrides (restart, resource limits, Nginx)
├── docker-compose.dev.yml        # dev overrides (hot-reload volumes, no Nginx)
├── nginx/
│   ├── nginx.conf                # server blocks, proxy_pass to api/web
│   └── certbot/
│       ├── conf/                 # Let's Encrypt certificates (volume)
│       └── www/                  # ACME webroot challenge (volume)
├── pgbouncer/
│   ├── pgbouncer.ini             # pool_mode=transaction, listen_port=5432
│   └── userlist.txt              # "appuser" "md5hash"
├── backup/
│   ├── Dockerfile                # alpine + pg_client + gnupg + rclone
│   ├── backup.sh                 # pg_dump | gzip | gpg | rclone copy
│   └── rclone.conf               # B2 remote config (injected at runtime)
├── apps/
│   ├── api/                      # Express.js TypeScript
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json         # extends ../../tsconfig.base.json
│   │   └── src/
│   │       ├── index.ts          # app entrypoint
│   │       ├── db/               # drizzle client + connection
│   │       ├── redis/            # redis client
│   │       ├── queue/            # BullMQ queue/worker setup
│   │       └── modules/          # domain modules (routes empty for Phase 0)
│   │           ├── inventory/
│   │           ├── pos/
│   │           └── finance/
│   └── web/                      # Next.js
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── app/              # Next.js App Router
└── packages/
    └── shared/                   # @k21/shared
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts          # re-exports DTOs, request schemas
```

### Pattern 1: Docker Compose Base + Override Split
**What:** Three Compose files merged at runtime — base defines all services, prod/dev override environment-specific values.
**When to use:** Always. Dev uses base + dev override; prod uses base + prod override explicitly.
**Key rule:** `docker-compose.override.yml` is auto-merged by Docker Compose when you run `docker compose up`. Name the dev override file `docker-compose.dev.yml` (not `override`) so it is NOT auto-applied — require explicit `-f` flag. This prevents accidental hot-reload mounts in prod.

```yaml
# docker-compose.yml (base — production default)
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    networks:
      - k21-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    depends_on:
      pgbouncer:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    networks:
      - k21-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

networks:
  k21-net:
    driver: bridge
```

```yaml
# docker-compose.prod.yml (prod override)
services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certbot/conf:/etc/letsencrypt:ro
      - ./nginx/certbot/www:/var/www/certbot:ro
    networks:
      - k21-net
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

  certbot:
    image: certbot/certbot
    volumes:
      - ./nginx/certbot/conf:/etc/letsencrypt
      - ./nginx/certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

  api:
    restart: unless-stopped
    environment:
      - NODE_ENV=production

  web:
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

```yaml
# docker-compose.dev.yml (dev override — explicit -f only)
services:
  api:
    volumes:
      - ./apps/api/src:/app/src   # hot reload mount
    environment:
      - NODE_ENV=development

  web:
    volumes:
      - ./apps/web/src:/app/src
    ports:
      - "3000:3000"               # direct access, no Nginx
    environment:
      - NODE_ENV=development
```

**Prod run:** `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
**Dev run:** `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

### Pattern 2: SSL Bootstrap (Certbot Chicken-and-Egg)
**What:** On first deploy, certificates don't exist, Nginx cannot start, Certbot cannot serve ACME challenge.
**Solution:** Two-stage bootstrap.

Stage 1 — issue certificate:
```bash
# Start nginx with http-only config (no ssl blocks yet)
# Then run certbot standalone or webroot:
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email
```

Stage 2 — enable HTTPS in nginx.conf and restart:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

The certbot service then runs its renewal loop every 12 hours. Nginx must be signaled to reload after renewal — add a reload command via cron or use the Nginx container's reload mechanism.

### Pattern 3: PgBouncer Configuration
**What:** PgBouncer sits between the api service and postgres. The api NEVER connects directly to postgres — always through pgbouncer on port 5432.

```ini
# pgbouncer/pgbouncer.ini
[databases]
k21 = host=postgres port=5432 dbname=k21

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 5432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
server_idle_timeout = 600
log_connections = 0
log_disconnections = 0
```

```
# pgbouncer/userlist.txt
"appuser" "md5<md5hash_of_password_plus_username>"
```

Generate MD5 hash: `echo -n "passwordusername" | md5sum` then prefix with `md5`.

### Pattern 4: Drizzle ORM + postgres.js with PgBouncer
**What:** `postgres.js` with `{ prepare: false }` disables prepared statements, making it compatible with PgBouncer transaction mode.

```typescript
// apps/api/src/db/index.ts
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const connectionString = process.env.DATABASE_URL!
// { prepare: false } is REQUIRED for PgBouncer transaction mode
const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client)
```

`DATABASE_URL` connects to PgBouncer, not Postgres directly:
```
DATABASE_URL=postgres://appuser:password@pgbouncer:5432/k21
```

### Pattern 5: BullMQ + Redis Setup
**What:** BullMQ uses ioredis under the hood. Redis must have `maxmemory-policy noeviction` to prevent job data loss.

```typescript
// apps/api/src/queue/connection.ts
import { ConnectionOptions } from 'bullmq'

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
}

// apps/api/src/queue/queues.ts
import { Queue } from 'bullmq'
import { redisConnection } from './connection'

export const marketplaceQueue = new Queue('marketplace', { connection: redisConnection })
export const reportQueue = new Queue('reports', { connection: redisConnection })
```

Redis service in Compose must add `command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory-policy noeviction`.

### Pattern 6: Backup Container (GPG + rclone + B2)
**What:** Alpine-based container with pg client, gnupg, rclone. Cron job runs at 2 AM nightly.

```bash
#!/bin/sh
# backup/backup.sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/k21_${TIMESTAMP}.sql.gz.gpg"

# 1. Dump + compress
pg_dump "$DATABASE_URL" | gzip | \
  gpg --batch --yes --passphrase "$GPG_PASSPHRASE" \
      --symmetric --cipher-algo AES256 \
      -o "$BACKUP_FILE"

# 2. Upload to B2
rclone copy "$BACKUP_FILE" b2:${B2_BUCKET}/backups/

# 3. Delete backups older than 7 days
rclone delete b2:${B2_BUCKET}/backups/ --min-age 7d

# 4. Cleanup local
rm -f "$BACKUP_FILE"
echo "Backup complete: ${TIMESTAMP}"
```

GPG key is base64-decoded from environment variable and imported at container startup (or use symmetric passphrase for simplicity — both approaches work; symmetric is simpler for single-VPS).

rclone.conf is written at container startup from environment variables:
```bash
# In container entrypoint
cat > /root/.config/rclone/rclone.conf << EOF
[b2]
type = b2
account = ${B2_KEY_ID}
key = ${B2_APPLICATION_KEY}
EOF
```

### Pattern 7: Netdata localhost-only
**What:** Netdata on `127.0.0.1:19999` only — accessible via SSH tunnel from developer machines; never exposed externally.

```yaml
# In docker-compose.prod.yml
netdata:
  image: netdata/netdata
  pid: host
  network_mode: host        # Required for full host metrics collection
  cap_add:
    - SYS_PTRACE
    - SYS_ADMIN
  security_opt:
    - apparmor:unconfined
  volumes:
    - netdataconfig:/etc/netdata
    - netdatalib:/var/lib/netdata
    - netdatacache:/var/cache/netdata
    - /etc/passwd:/host/etc/passwd:ro
    - /etc/group:/host/etc/group:ro
    - /proc:/host/proc:ro
    - /sys:/host/sys:ro
    - /etc/os-release:/host/etc/os-release:ro
    - /var/run/docker.sock:/var/run/docker.sock:ro
  environment:
    - NETDATA_CLAIM_TOKEN=       # leave empty for standalone
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"
```

**CRITICAL:** With `network_mode: host`, Netdata binds to the host's 127.0.0.1 by default on port 19999 when `bind socket to IP = 127.0.0.1` is set in `netdata.conf`. This means no port mapping is needed — but the `netdata.conf` inside the container's volume must set `[web] bind to = 127.0.0.1`.

Alternative if network_mode: host is undesirable: use `ports: ["127.0.0.1:19999:19999"]` with bridge networking, but this limits host-level metrics (CPU, disk) accuracy.

### Pattern 8: GitHub Actions CI/CD Pipeline
**What:** Sequential jobs with `needs:` dependency — deploy only fires if all quality gates pass on main branch.

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint

  typecheck:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck

  test:
    runs-on: ubuntu-latest
    needs: typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test

  deploy:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            # Write .env from secrets
            cat > /opt/k21/.env << 'ENVEOF'
            DATABASE_URL=${{ secrets.DATABASE_URL }}
            REDIS_PASSWORD=${{ secrets.REDIS_PASSWORD }}
            GPG_PASSPHRASE=${{ secrets.GPG_PASSPHRASE }}
            B2_KEY_ID=${{ secrets.B2_KEY_ID }}
            B2_APPLICATION_KEY=${{ secrets.B2_APPLICATION_KEY }}
            B2_BUCKET=${{ secrets.B2_BUCKET }}
            DOMAIN=${{ secrets.DOMAIN }}
            LETSENCRYPT_EMAIL=${{ secrets.LETSENCRYPT_EMAIL }}
            ENVEOF

            cd /opt/k21
            git pull origin main
            docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Required GitHub Actions secrets:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DATABASE_URL`, `REDIS_PASSWORD`, `GPG_PASSPHRASE`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`, `DOMAIN`, `LETSENCRYPT_EMAIL`.

### Pattern 9: pnpm Workspace Setup

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// packages/shared/package.json
{
  "name": "@k21/shared",
  "version": "0.0.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  }
}
```

```json
// apps/api/package.json — referencing shared
{
  "name": "@k21/api",
  "dependencies": {
    "@k21/shared": "workspace:*"
  }
}
```

Root `package.json` scripts for CI:
```json
{
  "scripts": {
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck",
    "test": "pnpm -r run test",
    "build": "pnpm -r run build"
  }
}
```

### Pattern 10: Docker Healthchecks
```yaml
# In docker-compose.yml base
services:
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  pgbouncer:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h localhost -p 5432"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s

  api:
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

`api` must expose a `GET /health` route (returns 200 JSON) — Phase 0 deliverable.

### Anti-Patterns to Avoid
- **Exposing PgBouncer or Redis ports to host:** Set no `ports:` mapping for these services; they are internal-only on `k21-net`.
- **Using `docker-compose.override.yml` for dev:** Docker auto-merges `override.yml` which would break prod if someone runs `docker compose up` without `-f` flags. Name it explicitly `docker-compose.dev.yml`.
- **Connecting Drizzle directly to Postgres:** Always route through PgBouncer. Direct connections bypass pooling and can exhaust Postgres `max_connections`.
- **Using `pg` (node-postgres) instead of `postgres.js`:** `pg` uses prepared statements internally that conflict with PgBouncer transaction mode.
- **GPG key loss:** The GPG key is the only decryption path for all B2 backups. Losing it means all backups are unrestorable. Must verify offline backup BEFORE completing Phase 0.
- **Skipping backup restore test:** Backups that aren't verified are not backups. Phase 0 must include a restore drill as a success criterion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Certificate issuance + renewal | Custom ACME client | `certbot/certbot` Docker image | ACME protocol edge cases, DNS challenges, rate limits |
| Connection pooling | Manual connection pool in Node | PgBouncer | Prepared statement lifecycle, idle timeout, server-side connection limits |
| B2 upload + multi-part | `fetch()` to B2 API | `rclone` | Retry logic, multi-part for large dumps, rate limiting, lifecycle operations |
| Job queue | `setTimeout` + Redis SET | BullMQ | Retry, backoff, stalled job detection, concurrency, priority queues |
| Backup encryption | XOR or Base64 "encryption" | GPG AES256 | Proper authenticated encryption; GPG is the standard for offline backup encryption |
| Docker service startup ordering | `sleep 10` hacks | Compose `depends_on` with `condition: service_healthy` | Race conditions are non-deterministic; healthchecks are authoritative |

**Key insight:** Every "simple" version of these problems (hand-rolled connection pool, custom ACME, custom B2 uploader) has hidden edge cases that only appear in production — certificate expiry races, connection leaks under load, partial multi-part uploads. Use the dedicated tools.

---

## Common Pitfalls

### Pitfall 1: Certbot Bootstrap Ordering
**What goes wrong:** `nginx` service fails to start on first deploy because SSL certificate files don't exist yet. Or, `certbot` cannot complete ACME HTTP challenge because Nginx isn't serving on port 80.
**Why it happens:** Circular dependency — Nginx needs certs to start, Certbot needs HTTP server to get certs.
**How to avoid:** Two-phase bootstrap. Phase 1: deploy Nginx with HTTP-only config (no SSL directives), then run Certbot to obtain the cert. Phase 2: update Nginx config to enable HTTPS, reload Nginx. The renewal loop (certbot in entrypoint loop) handles all subsequent renewals.
**Warning signs:** `nginx: [emerg] cannot load certificate` in Nginx logs on first deploy.

### Pitfall 2: PgBouncer Prepared Statement Errors
**What goes wrong:** API throws `ERROR: prepared statement "s1" already exists` or `prepared statement does not exist` at runtime.
**Why it happens:** `postgres.js` defaults to using prepared statements. PgBouncer transaction mode does not persist session state between transactions, so prepared statements registered in one transaction are invisible to the next.
**How to avoid:** Always pass `{ prepare: false }` to `postgres()`. Verified fix per official Drizzle docs and postgres.js docs.
**Warning signs:** Errors appear intermittently (only under concurrent load), making them hard to diagnose if not caught in Phase 0.

### Pitfall 3: Redis Memory Eviction Destroying BullMQ Jobs
**What goes wrong:** BullMQ jobs silently disappear. Workers pick up no jobs. Queue depth is always 0.
**Why it happens:** If Redis has a memory limit and the eviction policy is not `noeviction`, Redis evicts job data under memory pressure. BullMQ is not designed to tolerate data loss.
**How to avoid:** Redis must start with `--maxmemory-policy noeviction`. Set this in the Compose command or redis.conf. Monitor Redis memory with Netdata.
**Warning signs:** Jobs enqueued but never processed; Redis `INFO memory` shows `maxmemory_policy: allkeys-lru`.

### Pitfall 4: .env Not Written Before docker compose up
**What goes wrong:** Services start with empty environment variables. Database connections fail. API throws `Cannot connect to database`.
**Why it happens:** The deploy script writes `.env` after `git pull` but `docker compose up` runs before the write completes, or the .env write step is missing.
**How to avoid:** In the CI/CD SSH script, explicitly write `.env` as the FIRST step before any Docker command. Use a heredoc that is atomic (writes to a temp file and moves).
**Warning signs:** Container exits with code 1 immediately; logs show undefined environment variables.

### Pitfall 5: pnpm Workspace Docker Build Context
**What goes wrong:** Docker build fails with `COPY apps/api/package.json` — file not found, because the build context is set to `apps/api/` instead of the monorepo root.
**Why it happens:** Each app's Dockerfile needs access to `pnpm-workspace.yaml`, root `package.json`, and `packages/shared/` for the build to resolve workspace dependencies.
**How to avoid:** Set `build.context: .` (monorepo root) in all service build configs. Use `dockerfile: apps/api/Dockerfile` to point to the correct Dockerfile. The Dockerfile then copies from the full context.
**Warning signs:** `COPY failed: file not found in build context` during `docker compose build`.

### Pitfall 6: Backup Succeeds But Restore Fails
**What goes wrong:** Backups are created and uploaded to B2 nightly. When disaster strikes, restoring the backup fails (wrong GPG key, corrupted gzip, wrong pg_dump format flags).
**Why it happens:** Backup scripts are written and forgotten. No one tests the restore path.
**How to avoid:** As part of Phase 0 completion criteria, perform a full restore drill: download latest B2 backup, decrypt with GPG, gunzip, `pg_restore` or `psql` into a test database, verify row count. Document the restore procedure.
**Warning signs:** This pitfall has no early warning signs — it only manifests during disaster recovery.

### Pitfall 7: Netdata with network_mode: host and Docker metrics
**What goes wrong:** Netdata in bridge network mode cannot collect accurate host-level CPU/RAM/Disk metrics (it sees container-scoped cgroups instead of host stats).
**Why it happens:** Docker bridge networking namespaces the container's view of `/proc` and `/sys`. Host metrics require host network mode or very specific bind mounts.
**How to avoid:** Use `network_mode: host` for Netdata and restrict access at the application level via `netdata.conf` (`bind to = 127.0.0.1`), not at the Docker network level. This gives full host metrics while keeping the port inaccessible externally.

---

## Code Examples

### Express.js Health Endpoint (Phase 0 Deliverable)
```typescript
// apps/api/src/index.ts
// Source: Express.js docs + Phase 0 requirements
import express from 'express'

const app = express()
const PORT = process.env.PORT ?? 3001

// API versioning prefix — all future routes under this router
const v1Router = express.Router()
app.use('/api/v1', v1Router)

// Health endpoint for Docker healthcheck
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`)
})
```

### Nginx Configuration (HTTPS with Let's Encrypt)
```nginx
# nginx/nginx.conf
# Source: standard nginx + certbot pattern

# HTTP — redirect to HTTPS + serve ACME challenge
server {
    listen 80;
    server_name yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # API
    location /api/ {
        proxy_pass http://api:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (Next.js)
    location / {
        proxy_pass http://web:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

### pnpm-workspace.yaml
```yaml
# Source: pnpm.io/workspaces
packages:
  - 'apps/*'
  - 'packages/*'
```

### Shared tsconfig.base.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `sleep 30` for service startup ordering | `depends_on: condition: service_healthy` | Docker Compose v2 | Reliable; eliminates race conditions |
| `pg` (node-postgres) with PgBouncer | `postgres.js { prepare: false }` | 2022+ | Eliminates prepared statement conflicts in transaction mode |
| `next-pwa` for PWA | `@serwist/next` | 2024 | `next-pwa` unmaintained for App Router; relevant for Phase 3 Dockerfiles |
| Manual certificate renewal via cron on host | Certbot container with renewal loop | 2020+ | Fully containerized; no host cron dependency |
| `Bull` job queue | `BullMQ` | 2021 | TypeScript-first; Bull is now deprecated in favor of BullMQ |
| `rclone` with crypt remote (built-in encryption) | `rclone` + GPG (separate) | - | GPG provides portable encryption with offline key management; rclone-crypt ties decryption to rclone config |

**Deprecated/outdated:**
- `docker-compose` (v1 Python binary): use `docker compose` (v2 plugin). The compose plugin is now built into Docker Desktop and Docker Engine.
- `Bull`: replaced by `BullMQ`. Do not install `bull`, install `bullmq`.
- `next-pwa`: do not use for App Router. Use `@serwist/next` (Phase 3 concern, but Dockerfile must not accidentally install next-pwa).

---

## Open Questions

1. **PgBouncer `max_prepared_statements` setting**
   - What we know: PgBouncer 1.21+ can track prepared statements in transaction mode when `max_prepared_statements > 0`. This would allow using `postgres.js` without `{ prepare: false }`.
   - What's unclear: Whether this feature is stable enough to rely on, and whether Drizzle ORM generates prepared statements that would benefit.
   - Recommendation: Use `{ prepare: false }` for Phase 0 (safe, documented, explicit). Revisit for performance tuning in a later phase if needed.

2. **Nginx reload after certificate renewal**
   - What we know: The certbot container renews certificates but Nginx must be reloaded (`nginx -s reload`) to pick up new cert files.
   - What's unclear: The cleanest way to trigger Nginx reload from the certbot container without Docker-in-Docker or custom images.
   - Recommendation: Add a separate cron container or Docker socket-based mechanism to signal Nginx reload after certbot renewal. Alternatively, use `docker-nginx-certbot` (JonasAlfredsson) which handles this internally.

3. **VPS SSH key provisioning**
   - What we know: GitHub Actions requires an SSH private key in secrets. The corresponding public key must be in `~/.ssh/authorized_keys` on the VPS.
   - What's unclear: Whether initial VPS provisioning (adding authorized_keys) is in-scope for Phase 0 plan tasks or treated as pre-requisite manual step.
   - Recommendation: Document VPS pre-provisioning as a manual prerequisite task in the plan with exact commands. Do not automate VPS provisioning in Phase 0.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (for API) — to be installed in Wave 0 |
| Config file | `apps/api/vitest.config.ts` — Wave 0 gap |
| Quick run command | `pnpm --filter @k21/api test --run` |
| Full suite command | `pnpm -r test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Nginx returns 200 on HTTPS + valid cert | smoke (manual on VPS) | `curl -I https://$DOMAIN` | ❌ Wave 0 (shell script) |
| INFRA-01 | HTTP → HTTPS redirect returns 301 | smoke (manual on VPS) | `curl -I http://$DOMAIN` | ❌ Wave 0 (shell script) |
| INFRA-02 | API connects to DB through PgBouncer | integration | `pnpm --filter @k21/api test --run` | ❌ Wave 0 |
| INFRA-02 | No prepared statement errors under concurrent load | integration | `pnpm --filter @k21/api test --run` | ❌ Wave 0 |
| INFRA-03 | Redis accepts connections; BullMQ queue enqueue/dequeue | integration | `pnpm --filter @k21/api test --run` | ❌ Wave 0 |
| INFRA-04 | Push to main triggers deploy (verify on Actions UI) | manual | GitHub Actions logs | N/A — manual |
| INFRA-05 | Log rotation configured on all services | config-check | `docker inspect <container> --format '{{.HostConfig.LogConfig}}'` | ❌ Wave 0 (shell script) |
| INFRA-06 | Backup script produces encrypted file | unit (backup.sh) | `bash backup/backup.sh --dry-run` | ❌ Wave 0 |
| INFRA-07 | Files older than 7 days are deleted from B2 | integration (requires B2) | manual restore drill | N/A — manual |
| INFRA-08 | Netdata accessible on 127.0.0.1:19999 only | smoke (manual on VPS) | `curl http://127.0.0.1:19999/api/v1/info` via SSH tunnel | N/A — manual |
| INFRA-08 | API health endpoint returns 200 | unit | `pnpm --filter @k21/api test --run` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @k21/api test --run` (fast unit tests, < 30s)
- **Per wave merge:** `pnpm -r test --run` (all workspace tests)
- **Phase gate:** Full suite green + manual VPS smoke test checklist before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/vitest.config.ts` — Vitest config for API; install `vitest @vitest/coverage-v8`
- [ ] `apps/api/src/db/index.test.ts` — covers INFRA-02 (DB connection through PgBouncer in test mode)
- [ ] `apps/api/src/queue/connection.test.ts` — covers INFRA-03 (Redis/BullMQ connection)
- [ ] `apps/api/src/index.test.ts` — covers INFRA-08 health endpoint (GET /health → 200)
- [ ] `backup/test-backup.sh` — dry-run backup smoke test (covers INFRA-06 script logic without B2 upload)
- [ ] `scripts/smoke-test.sh` — VPS smoke test checklist (INFRA-01, INFRA-05, INFRA-07, INFRA-08)
- [ ] Root `package.json` test/lint/typecheck scripts wired up across workspace

---

## Sources

### Primary (HIGH confidence)
- pnpm.io/workspaces — workspace protocol, pnpm-workspace.yaml format
- pnpm.io/docker — pnpm deploy pattern for Dockerfile isolation
- orm.drizzle.team/docs/get-started/postgresql-new — Drizzle + postgres.js setup
- docs.bullmq.io/guide/connections — BullMQ Redis connection options
- pgbouncer.org/config.html — PgBouncer pgbouncer.ini full configuration reference
- learn.netdata.cloud/docs/netdata-agent/configuration/securing-agents — Netdata localhost bind

### Secondary (MEDIUM confidence)
- github.com/JonasAlfredsson/docker-nginx-certbot — Nginx reload on cert renewal pattern
- github.com/brpaz/b2-pg-backup — Docker + pg_dump + B2 backup reference implementation
- appleboy/ssh-action GitHub Marketplace — SSH deploy action
- rclone.org/b2/ — rclone Backblaze B2 configuration reference

### Tertiary (LOW confidence — needs validation on target VPS)
- Netdata `NETDATA_ARGS=-i 127.0.0.1` environment variable — mentioned in community sources; verify against Netdata version on VPS
- PgBouncer `max_prepared_statements` feature stability — pganalyze.com blog post; verify against PgBouncer version available in Docker Hub image

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are well-established with official docs
- Architecture: HIGH — patterns are verified against official documentation and widely deployed
- Pitfalls: HIGH — PgBouncer/prepared statement issue is a known documented incompatibility; SSL bootstrap is a widely-documented problem
- Backup/GPG: MEDIUM — shell script patterns are standard but specific B2 retention commands need verification against rclone version
- Netdata localhost bind: MEDIUM — environment variable approach confirmed by community sources; verify on actual Netdata container version

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days — stable tooling)
