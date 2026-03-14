# Phase 0: Infrastructure - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the Docker Compose stack with SSL, databases, monitoring, CI/CD, and encrypted backups. This is the foundation every other phase builds on — no application features are in scope.

</domain>

<decisions>
## Implementation Decisions

### Repository & Project Structure
- **Monorepo with pnpm workspaces** — single repo, no Turborepo for now
- Layout:
  ```
  apps/api/     — Express.js TypeScript backend
  apps/web/     — Next.js frontend
  packages/shared/  — shared DTOs and types (@k21/shared)
  ```
- `packages/shared` contains API response types, request schemas, and domain types used by both apps. Both apps import from `@k21/shared`.
- **Express API internal structure: domain-driven folders** — `src/modules/inventory/`, `src/modules/pos/`, `src/modules/finance/`, etc. Each module owns its routes, services, and repository. Aligns with the monolith-with-boundaries goal.
- `.env.example` committed to repo with all required variable names and placeholder values. `.env` is gitignored.

### Docker Compose Layout
- **Base + override split:**
  - `docker-compose.yml` — base service definitions (shared config)
  - `docker-compose.prod.yml` — prod overrides (restart policies, resource limits)
  - `docker-compose.dev.yml` — dev overrides (volume mounts for hot-reload, no Nginx)
- **Nginx + Let's Encrypt only in production.** Local dev hits api at `:3001` and web at `:3000` directly — no Nginx or SSL locally.
- **Single internal Docker bridge network (`k21-net`)** — all services communicate by service name. PgBouncer and Redis are NOT exposed to the host. Only Nginx (80/443) is exposed externally.
- Services: nginx, api, web, postgres, pgbouncer, redis, netdata, backup (cron-based)

### Secrets Management
- **GitHub Actions secrets → SSH at deploy time.** CI/CD pipeline SSHs into VPS and writes `.env` file with injected secrets. Secrets never committed to repo.
- **GPG key:** stored as a base64-encoded GitHub Actions secret AND exported offline (encrypted USB / password manager). This key is required to restore backups — losing it = losing restorability of all B2 backups.
- Secrets required (documented in `.env.example`): DB credentials, Redis password, GPG key (base64), Backblaze B2 key ID + application key + bucket, UptimeRobot config, domain name, Let's Encrypt email.

### Deploy Strategy
- **GitHub Actions → SSH → git pull → docker compose build + up -d** on push to main.
  - No container registry (GHCR) — images built directly on VPS.
  - 10–30 seconds downtime during container restart is acceptable for an internal ERP.
- **Rollback:** manual SSH + `git reset --hard <sha>` + `docker compose up -d`. Simple and explicit.
- **CI/CD pipeline gates:** lint → type-check → test → deploy. All three gates must pass before deploy runs. Sets the correct habit from Phase 0 onward.

### Claude's Discretion
- Health check configuration per service (intervals, retries, start_period)
- Docker log rotation values (max-size: 10m, max-file: 5 — specified in requirements)
- Netdata configuration details (bind to localhost:19999)
- Backup script implementation details (shell script in a dedicated backup container with cron)
- PgBouncer pool_size and connection limits tuning
- Exact GitHub Actions runner configuration (ubuntu-latest)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing code.

### Established Patterns
- **Stack is locked:** Node.js + Express.js + TypeScript, Next.js, PostgreSQL, Redis, BullMQ, Drizzle ORM, Docker Compose
- **PgBouncer TRANSACTION mode** — requires `postgres.js` driver (not `pg`). Drizzle ORM must be configured with `postgres.js`. Prepared statements must be disabled or not used in transaction mode.
- **`@serwist/next`** for PWA (not `next-pwa`) — only maintained PWA path for Next.js App Router (relevant for Phase 3, noted here for Dockerfile awareness)

### Integration Points
- Phase 0 output is consumed by every subsequent phase — database, Redis, and the monorepo structure are the foundation
- CI/CD pipeline established here runs for all future phases

</code_context>

<specifics>
## Specific Ideas

- No specific visual references (this is infrastructure, not UI)
- Budget constraint: ≤ Rp500.000/month; target Hetzner CX32 ≈ Rp292.000/month
- Monolith architecture — one codebase, one VPS, domain boundaries kept clean for future extraction
- API versioning must be in place from Phase 0: all endpoints under `/api/v1/` (not implemented in this phase, but the Express router structure must support it from day one)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 00-infrastructure*
*Context gathered: 2026-03-14*
