---
plan: "00-08"
phase: "00-infrastructure"
status: complete
completed: 2026-03-15
commits:
  - hash: "84c084a"
    message: "feat(00-08): add GitHub Actions CI/CD pipeline with lint, typecheck, test, and deploy jobs"
---

# Plan 00-08: GitHub Actions CI/CD Pipeline

## What Was Built

Single workflow file `.github/workflows/ci-cd.yml` with four sequential jobs that automate deployment to the VPS on every push to `main`.

## Key Files Created

- `.github/workflows/ci-cd.yml` — Complete CI/CD pipeline

## Implementation Details

**Job sequence:** lint → typecheck → test → deploy (each `needs:` the previous)

**Quality gates:**
- `lint`: `pnpm run lint` across all workspaces
- `typecheck`: Builds `@k21/shared` first (required for type resolution), then `pnpm run typecheck`
- `test`: Builds `@k21/shared` first, then `pnpm run test`
- All jobs use `pnpm install --frozen-lockfile` to prevent CI lockfile mutation

**Deploy job:**
- Fires only on `push` to `main` (`if: github.ref == 'refs/heads/main' && github.event_name == 'push'`)
- Uses `appleboy/ssh-action@v1.0.3` to SSH into VPS
- Writes `.env` atomically (temp file + mv) as the **first step** before any docker commands
- Then: `git pull origin main`
- Then: `docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache`
- Then: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
- Health check: `curl -sf http://localhost:3001/health` with 10s warm-up delay

**Secrets (all via `${{ secrets.X }}`, none hardcoded):**
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `GPG_PASSPHRASE`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`, `DOMAIN`, `LETSENCRYPT_EMAIL`

## Verification

- ✓ All 11 structural checks pass (workflow name, 4 jobs, push gate, atomic .env, prod override, frozen lockfile, VPS_HOST secret)
- ✓ Deploy locked to `push` to `main` only (not PRs)
- ✓ `.env` written before `docker compose up`
- ✓ No hardcoded secrets

## Self-Check: PASSED
