---
phase: 00-infrastructure
verified: 2026-03-17T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated); live VPS behaviors require human confirmation
re_verification: false
human_verification:
  - test: "HTTPS reachable at domain with valid Let's Encrypt certificate"
    expected: "curl -s -o /dev/null -w '%{http_code}' https://<domain>/health returns 200; HTTP redirects 301 to HTTPS; certificate issuer is Let's Encrypt"
    why_human: "Requires live VPS and domain DNS — cannot verify TLS cert validity or HTTP→HTTPS redirect from local codebase inspection"
  - test: "Push to main triggers automated deploy that reaches VPS without manual steps"
    expected: "GitHub Actions runs lint → typecheck → test → deploy in sequence; deploy SSH step completes successfully; /health returns 200 after deploy"
    why_human: "Requires a live GitHub Actions run against real VPS — wiring is verified in code but end-to-end execution requires network and secrets"
  - test: "PgBouncer proxies all DB connections in transaction mode; Redis answers PING"
    expected: "psql through pgbouncer:5432 returns rows; SHOW pool_mode returns transaction; redis-cli -a $REDIS_PASSWORD PING returns PONG"
    why_human: "Requires live containers — pool_mode=transaction is confirmed in pgbouncer.ini but actual connection routing requires running stack"
  - test: "Nightly backup produces encrypted .sql.gz.gpg in B2; files older than 7 days are gone"
    expected: "rclone ls b2:k21-backups/backups/ lists at least one file with today's or yesterday's date; no files older than 7 days present; file decrypts with GPG_PASSPHRASE"
    why_human: "Requires live B2 bucket access and a completed cron run — backup.sh script logic is verified but actual upload/retention requires runtime"
  - test: "Netdata dashboard shows CPU/RAM/Disk metrics at localhost:19999 via SSH tunnel; not accessible from public internet"
    expected: "curl http://127.0.0.1:19999/api/v1/info returns 200 from VPS; curl http://<public-ip>:19999 times out or refuses"
    why_human: "Requires live VPS — netdata.conf bind=127.0.0.1 and network_mode:host are verified in code, but actual access restriction requires runtime check"
---

# Phase 0: Infrastructure Verification Report

**Phase Goal:** A production-grade Docker Compose stack is running on VPS — the foundation every other phase builds on
**Verified:** 2026-03-17
**Status:** human_needed — all automated checks passed; 5 live-VPS behaviors require human confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | HTTPS site is reachable at the domain with a valid Let's Encrypt certificate that auto-renews | ? HUMAN | nginx.conf TLS config verified; certbot loop verified; nginx reload cron verified in install-vps-crons.sh; live cert reachability requires VPS |
| 2 | Pushing to main branch triggers automated deploy that reaches VPS without manual intervention | ? HUMAN | ci-cd.yml fully wired: lint→typecheck→test→deploy on `push` to main; deploy step calls `docker compose up -d` then `install-vps-crons.sh`; live run requires GitHub Actions + VPS |
| 3 | PostgreSQL accessible only through PgBouncer in transaction mode; Redis and BullMQ queues operational | ? HUMAN | pgbouncer.ini `pool_mode = transaction` confirmed; Redis service with password-auth and healthcheck defined; BullMQ Queue objects instantiated against Redis; live connectivity requires running stack |
| 4 | Encrypted backup uploaded to Backblaze B2 each night; backups older than 7 days auto-deleted | ? HUMAN | backup.sh: pg_dump\|gzip\|gpg AES256 → rclone B2 upload → `rclone delete --min-age 7d`; entrypoint.sh installs cron at 02:00 UTC; live B2 state requires VPS access |
| 5 | Netdata dashboard (localhost only) shows CPU/RAM/Disk; Docker log rotation active on every service | ? HUMAN | netdata.conf `bind to = 127.0.0.1` + `network_mode: host` confirmed; all compose services have `json-file max-size: 10m max-file: 5`; live dashboard requires SSH tunnel to VPS |

**Score:** 5/5 truths structurally verified; all 5 require live-VPS confirmation

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `docker-compose.yml` | Base stack: postgres, pgbouncer, redis, api, web, backup — all with log rotation | VERIFIED | 146 lines; all services defined with json-file logging max-size=10m max-file=5; healthchecks on postgres, pgbouncer, redis, api |
| `docker-compose.prod.yml` | Production overrides: nginx, certbot, netdata, restart policies, explanatory comment above certbot | VERIFIED | nginx ports 80/443; certbot 12h renewal loop; netdata network_mode:host; comment above certbot documents host-cron reload architecture |
| `nginx/nginx.conf` | HTTPS server with TLS 1.2/1.3, HTTP→HTTPS redirect, ACME challenge path for certbot renewal | VERIFIED | 87 lines; both HTTP (80) and HTTPS (443) servers; ACME challenge at `/.well-known/acme-challenge/`; HSTS header present |
| `pgbouncer/pgbouncer.ini` | PgBouncer config with pool_mode = transaction | VERIFIED | `pool_mode = transaction` confirmed line 9; max_client_conn=100, default_pool_size=20 |
| `backup/backup.sh` | pg_dump → gzip → GPG AES256 → rclone B2 upload → 7-day cleanup | VERIFIED | 44 lines; pipeline: `pg_dump \| gzip \| gpg --cipher-algo AES256`; `rclone copy` to B2; `rclone delete --min-age 7d` |
| `backup/entrypoint.sh` | Writes rclone config from env vars; installs 02:00 UTC cron; starts crond | VERIFIED | 54 lines; env var validation; rclone.conf written at runtime (no credentials in image); cron at `0 2 * * *` |
| `backup/restore.sh` | Interactive restore: B2 download → gpg decrypt → gunzip → psql | VERIFIED | 93 lines; full pipeline with confirmation prompt; cleanup of temp files |
| `backup/Dockerfile` | Backup image: alpine + postgresql-client + gnupg + rclone + dcron | VERIFIED | Installs all required tools; ENTRYPOINT = entrypoint.sh |
| `netdata/netdata.conf` | Netdata bound to 127.0.0.1:19999; cgroups/proc/diskspace plugins enabled | VERIFIED | `bind to = 127.0.0.1` line 22; `allow dashboard from = localhost`; cgroups, proc, diskspace all `yes` |
| `scripts/install-vps-crons.sh` | Idempotent script: writes /etc/cron.d/k21-nginx-reload with 03:00 and 15:00 entries | VERIFIED | 25 lines; K21_DIR env var; two cron entries with `exec -T` flag; chmod 644; idempotent overwrite |
| `.github/workflows/ci-cd.yml` | CI/CD: lint→typecheck→test→deploy; deploy calls install-vps-crons.sh on every push | VERIFIED | 138 lines; jobs: lint, typecheck (needs lint), test (needs typecheck), deploy (needs test, push-to-main only); Step 3.5 calls `bash /opt/k21/scripts/install-vps-crons.sh` |
| `docs/backup-restore-runbook.md` | Disaster recovery runbook with completed Phase 0 drill record | VERIFIED | 119 lines; all 7 checklist items `[x]`; Drill result: "All 6 restore steps completed successfully"; Drill date: 2026-03-15; Performed by: Aditya |
| `apps/api/src/index.ts` | Express API with /health endpoint returning `{status, timestamp}` | VERIFIED | 23 lines; GET /health returns `res.json({ status: 'ok', timestamp: new Date().toISOString() })` |
| `apps/api/src/queue/queues.ts` | BullMQ Queue objects for marketplace and reports queues | VERIFIED | Queue('marketplace') and Queue('reports') both instantiated with redisConnection |
| `scripts/verify-log-rotation.sh` | Ops script to verify json-file log rotation on all running k21 containers | VERIFIED | 57 lines; checks LOG_DRIVER=json-file, max-size=10m, max-file=5 for each container |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/install-vps-crons.sh` | `/etc/cron.d/k21-nginx-reload` | `cat > /etc/cron.d/k21-nginx-reload` with two `nginx -s reload` entries | WIRED | Lines 17-22: writes cron file with 03:00 and 15:00 entries using `exec -T nginx nginx -s reload` |
| `.github/workflows/ci-cd.yml` | `scripts/install-vps-crons.sh` | Step 3.5: `bash /opt/k21/scripts/install-vps-crons.sh` | WIRED | Line 132: `bash /opt/k21/scripts/install-vps-crons.sh` in SSH deploy script after `docker compose up -d` |
| `certbot` container | `nginx` reload | Host cron via install-vps-crons.sh (container has no docker CLI) | WIRED | Architecture is sound: certbot renews cert to shared volume; host cron reloads nginx after renewal window; comment in docker-compose.prod.yml lines 28-31 documents this |
| `backup/entrypoint.sh` | `backup/backup.sh` | Cron entry `0 2 * * * root /backup/backup.sh` | WIRED | Line 39: cron job written with explicit env vars passed to crond context |
| `backup/backup.sh` | Backblaze B2 | `rclone copy "$BACKUP_FILE" "b2:${B2_BUCKET}/backups/"` | WIRED | Line 33: upload after GPG encrypt; line 38: `rclone delete --min-age 7d` for retention |
| `apps/api/src/queue/queues.ts` | Redis | `new Queue(..., { connection: redisConnection })` | WIRED | redisConnection imported from connection.ts; connection.ts reads REDIS_HOST/PORT/PASSWORD from env |
| `docker-compose.yml` pgbouncer | postgres | `depends_on: postgres (healthy)` | WIRED | pgbouncer waits for postgres healthcheck; DATABASE_URL routes through pgbouncer |
| `apps/api` | pgbouncer | `depends_on: pgbouncer (healthy)` in docker-compose.yml | WIRED | API container waits for pgbouncer healthcheck before starting |

---

### Requirements Coverage

| Requirement | Description | Plans | Status | Evidence |
|-------------|-------------|-------|--------|----------|
| INFRA-01 | Docker Compose VPS deploy with Nginx, SSL Let's Encrypt, auto-renew | 00-02, 00-03, 00-05, 00-10, 00-11 | SATISFIED | nginx.conf TLS; certbot loop; install-vps-crons.sh nginx reload post-renewal; CI/CD deploys cron on every push |
| INFRA-02 | PostgreSQL with PgBouncer connection pooling (TRANSACTION mode, postgres.js) | 00-01, 00-02, 00-03, 00-04 | SATISFIED | pgbouncer.ini `pool_mode = transaction`; pgbouncer service in compose with depends_on postgres |
| INFRA-03 | Redis as cache layer and BullMQ job queue storage | 00-01, 00-02, 00-03, 00-04 | SATISFIED | Redis service with password-auth; BullMQ Queue objects instantiated in queue/queues.ts against Redis |
| INFRA-04 | CI/CD via GitHub Actions — auto-deploy on push to main | 00-02, 00-08, 00-10 | SATISFIED | ci-cd.yml: lint→typecheck→test→deploy; `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`; SSH deploy with docker compose up |
| INFRA-05 | Docker log rotation on all services (max-size: 10m, max-file: 5) | 00-02, 00-03, 00-07, 00-10 | SATISFIED | All services in docker-compose.yml and docker-compose.prod.yml have json-file max-size:10m max-file:5; verify-log-rotation.sh for ops validation |
| INFRA-06 | Nightly backup: pg_dump + gzip + GPG + Backblaze B2 | 00-02, 00-06, 00-09, 00-11 | SATISFIED | backup.sh: pg_dump\|gzip\|gpg AES256 → rclone B2 upload; entrypoint.sh: cron at 02:00 UTC |
| INFRA-07 | Backup retention: keep 7 days, auto-delete older | 00-02, 00-06, 00-09, 00-10, 00-11 | SATISFIED | backup.sh line 38: `rclone delete "b2:${B2_BUCKET}/backups/" --min-age 7d`; restore drill documented in runbook |
| INFRA-08 | Monitoring: UptimeRobot (external) + Netdata (internal, localhost only) | 00-01, 00-02, 00-04, 00-07, 00-10 | SATISFIED (partial — see note) | netdata.conf `bind to = 127.0.0.1`; /health endpoint returns `{status, timestamp}`; smoke-test.sh checks Netdata at 127.0.0.1:19999; UptimeRobot is external service — cannot verify from codebase |

**Note on INFRA-08 / UptimeRobot:** UptimeRobot is an external SaaS monitoring service. Its configuration exists outside the repository (account login, monitor URL, alert contacts). The codebase provides the `/health` endpoint that UptimeRobot polls, but the UptimeRobot monitor itself requires human verification.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/queue/queues.ts` | 4 | `// Phase 0: queue definitions only — no workers yet.` | Info | Intentional — workers added in Phase 6/7; queues exist so Redis connectivity can be tested in Phase 0 |
| `apps/api/src/index.ts` | 16 | `// Phase 0: no routes yet. v1Router catches /api/v1/* and returns 404 by default.` | Info | Intentional — route stubs added in Phase 1+; /health is the only Phase 0 endpoint required |

No blocker or warning anti-patterns found. Both info-level items are intentional and correctly documented as Phase 0 scope limitations.

---

### Human Verification Required

#### 1. HTTPS Certificate Reachability

**Test:** From any machine with curl, run:
```
curl -sv https://<domain>/health 2>&1 | grep -E "SSL|issuer|subject|HTTP"
curl -s -o /dev/null -w '%{http_code}' http://<domain>
```
**Expected:** HTTPS returns 200 with JSON `{"status":"ok","timestamp":"..."}`, certificate issuer is Let's Encrypt, HTTP returns 301 redirect to HTTPS.
**Why human:** Requires live VPS with DNS pointing to the server and certificates issued by Let's Encrypt. Cannot verify from repository.

#### 2. CI/CD Live Deploy

**Test:** Push a trivial commit (e.g., a comment change) to main branch and observe the GitHub Actions run.
**Expected:** Workflow runs all four jobs (lint, typecheck, test, deploy) in sequence; deploy job completes with "VPS crons installed." and "Health check passed."; no manual SSH intervention required.
**Why human:** Requires active GitHub Actions secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY, etc.) and a live VPS. Wiring is confirmed in ci-cd.yml but execution requires runtime.

#### 3. PgBouncer Transaction Mode and Redis PING

**Test:** SSH into VPS and run:
```
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec pgbouncer psql -h localhost -U appuser -c "SHOW pool_mode;"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" PING
```
**Expected:** pool_mode shows `transaction`; Redis replies `PONG`.
**Why human:** Requires live containers. pgbouncer.ini confirms pool_mode=transaction in config but actual connection routing requires running stack.

#### 4. Encrypted Backup in B2 and 7-Day Retention

**Test:** SSH into VPS and run:
```
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup /backup/backup.sh
rclone ls b2:k21-backups/backups/
```
Then verify: encrypted file with `.sql.gz.gpg` extension is listed; decrypt it with `gpg --batch --passphrase "$GPG_PASSPHRASE" --decrypt <file> | gunzip | head -5` to confirm valid SQL.
**Expected:** File appears in B2 bucket; decrypts successfully; `rclone delete --min-age 7d` has removed any files older than 7 days.
**Why human:** Requires live B2 credentials and a completed backup run.

#### 5. Netdata Dashboard Accessible Localhost-Only

**Test:** From VPS directly (not via tunnel): `curl -s http://127.0.0.1:19999/api/v1/info | jq .version`. Then from your local machine without SSH tunnel: `curl -m 5 http://<vps-public-ip>:19999` (should time out or refuse).
**Expected:** localhost access returns Netdata info JSON; public IP access fails (connection refused or timeout).
**Why human:** Requires live VPS. netdata.conf `bind to = 127.0.0.1` and `network_mode: host` confirm the design, but actual enforcement requires runtime verification.

#### 6. UptimeRobot External Monitoring

**Test:** Log into UptimeRobot dashboard and confirm a monitor exists for `https://<domain>/health` with status "Up" and alert contacts configured.
**Expected:** Monitor shows green/up status; alert notifications are configured for downtime.
**Why human:** UptimeRobot is an external SaaS service — there is no repository artifact for it. This is inherently a human/account verification step.

---

### Gaps Summary

No structural gaps found. All 8 INFRA requirements are satisfied at the code/config level:

- INFRA-01 (SSL + auto-renew): Fully closed by install-vps-crons.sh + CI/CD wiring in plan 00-11
- INFRA-02 (PgBouncer transaction mode): pgbouncer.ini confirmed, compose wiring confirmed
- INFRA-03 (Redis + BullMQ): Redis service defined, BullMQ queues instantiated
- INFRA-04 (CI/CD push-to-deploy): ci-cd.yml fully wired with all four jobs
- INFRA-05 (Log rotation): All compose services have json-file + size limits; verify script exists
- INFRA-06 (Encrypted B2 backup): backup.sh pipeline complete; entrypoint cron at 02:00 UTC
- INFRA-07 (7-day retention + drill): `rclone delete --min-age 7d` in backup.sh; restore drill documented in runbook with all 7 items checked
- INFRA-08 (Netdata localhost + UptimeRobot): netdata.conf bind=127.0.0.1; /health endpoint returns required JSON; UptimeRobot requires external account verification

The 6 human verification items above represent live-VPS behaviors that cannot be assessed from the repository. All automated evidence supports that the infrastructure is correctly configured and wired. Phase 0 is ready to be signed off upon human confirmation of the live stack.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
