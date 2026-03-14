---
phase: 00-infrastructure
plan: "05"
subsystem: infra
tags: [nginx, ssl, letsencrypt, certbot, https, docker]

# Dependency graph
requires:
  - phase: 00-03
    provides: docker-compose.prod.yml with nginx and certbot service definitions and volume mounts
provides:
  - nginx/nginx.conf with HTTP→HTTPS redirect, SSL termination, API proxy, and frontend proxy
  - nginx/nginx-bootstrap.conf for HTTP-only ACME challenge serving during first cert issuance
  - scripts/ssl-bootstrap.sh two-phase bootstrap solving the chicken-and-egg SSL problem
  - nginx/certbot/www and nginx/certbot/conf volume mount directories
affects:
  - 00-06
  - deploy
  - any phase that adds new routes (update nginx proxy rules)

# Tech tracking
tech-stack:
  added: [nginx, certbot/let's encrypt, openssl TLSv1.2/1.3]
  patterns:
    - Two-phase SSL bootstrap — HTTP-only bootstrap config first, then HTTPS config after cert issued
    - ACME challenge path served on port 80 even in production HTTPS config for renewals
    - ${DOMAIN} placeholder substituted by bootstrap script via sed at deploy time

key-files:
  created:
    - nginx/nginx.conf
    - nginx/nginx-bootstrap.conf
    - nginx/certbot/www/.gitkeep
    - nginx/certbot/conf/.gitkeep
    - scripts/ssl-bootstrap.sh
  modified:
    - .gitignore

key-decisions:
  - "nginx.conf uses literal ${DOMAIN} placeholder — bootstrap script substitutes real domain via sed before deploying"
  - "HTTP server block kept in production nginx.conf for ACME renewal challenges — only non-challenge traffic redirects to HTTPS"
  - "Post-renewal Nginx reload is NOT automatic — documented as a cron job requirement since certbot container cannot signal nginx"

patterns-established:
  - "Bootstrap pattern: swap config file temporarily (copy bootstrap over main, run certbot, restore main)"
  - "Volume placeholder: .gitkeep files allow empty directories to be tracked in git"

requirements-completed: [INFRA-01]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 0 Plan 05: SSL Bootstrap Summary

**Nginx HTTPS reverse proxy with Let's Encrypt TLS and a two-phase bootstrap script solving the chicken-and-egg certificate issuance problem**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T01:18:11Z
- **Completed:** 2026-03-15T01:20:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Full production Nginx config with HTTP→HTTPS redirect (301), TLS 1.2/1.3, HSTS, security headers, API proxy, and Next.js frontend proxy with WebSocket upgrade support
- HTTP-only bootstrap config that safely serves ACME challenge on port 80 before certificates exist
- Two-phase bootstrap script that sequences HTTP-only start → certbot issuance → HTTPS restart with built-in verification at each step

## Task Commits

Each task was committed atomically:

1. **Task 1: Nginx HTTPS config and HTTP-only bootstrap config** - `eed8c29` (feat)
2. **Task 2: SSL bootstrap script (two-phase certificate issuance)** - `689b384` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `nginx/nginx.conf` - Production Nginx config: HTTP→HTTPS redirect, SSL cert paths, API and frontend proxies, security headers
- `nginx/nginx-bootstrap.conf` - Bootstrap-only HTTP config: serves ACME challenge, returns 200 for all requests (no redirect, no SSL)
- `nginx/certbot/www/.gitkeep` - Placeholder for certbot webroot volume mount (nginx/certbot/www)
- `nginx/certbot/conf/.gitkeep` - Placeholder for letsencrypt conf volume mount (nginx/certbot/conf)
- `scripts/ssl-bootstrap.sh` - One-time bootstrap: domain substitution, swap config, start HTTP nginx, run certbot, restore HTTPS config, start full stack
- `.gitignore` - Updated to allow .gitkeep files through certbot directory exclusions (changed from `dir/` to `dir/*` + `!dir/.gitkeep`)

## Decisions Made

- `${DOMAIN}` is a literal placeholder in nginx.conf. The bootstrap script substitutes the real domain via `sed -i` at first-deploy time. This avoids needing environment variable expansion inside Nginx (which does not natively support env vars in config).
- The production HTTP server block retains the ACME challenge location rather than redirecting all of port 80. This enables certbot auto-renewal after initial bootstrap without re-running the bootstrap script.
- Post-renewal Nginx reload is documented as a manual cron job requirement. The certbot container cannot send signals across container boundaries to nginx. The note points operators to the JonasAlfredsson/docker-nginx-certbot image as an alternative that handles this automatically.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**First-time VPS deployment requires manual execution of the bootstrap script.**

```sh
# Run once on VPS after initial git clone:
DOMAIN=yourdomain.com EMAIL=admin@yourdomain.com sh scripts/ssl-bootstrap.sh
```

Post-bootstrap, add a cron job for Nginx reload after cert renewal:
```
0 3 * * * docker compose -f /opt/k21/docker-compose.yml -f /opt/k21/docker-compose.prod.yml exec nginx nginx -s reload
```

## Next Phase Readiness

- SSL/TLS layer complete — all HTTPS traffic termination and routing configured
- Nginx will proxy `/api/` to `api:3001` and all other requests to `web:3000`
- Health check endpoint `/health` proxied without `/api/` prefix for Docker healthcheck compatibility
- Ready for application services (API and web) to be built in subsequent phases

---
*Phase: 00-infrastructure*
*Completed: 2026-03-15*
