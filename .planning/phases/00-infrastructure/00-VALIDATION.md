---
phase: 0
slug: infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (API) — installed in Wave 0 |
| **Config file** | `apps/api/vitest.config.ts` — Wave 0 gap |
| **Quick run command** | `pnpm --filter @k21/api test --run` |
| **Full suite command** | `pnpm -r test --run` |
| **Estimated runtime** | ~30 seconds (unit + integration) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @k21/api test --run`
- **After every plan wave:** Run `pnpm -r test --run`
- **Before `/gsd:verify-work`:** Full suite green + manual VPS smoke test checklist
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| monorepo scaffold | 01 | 0 | INFRA-01..08 | — | `pnpm -r build` | ❌ W0 | ⬜ pending |
| vitest config | 01 | 0 | INFRA-02,03,08 | unit | `pnpm --filter @k21/api test --run` | ❌ W0 | ⬜ pending |
| DB connection test | 01 | 1 | INFRA-02 | integration | `pnpm --filter @k21/api test --run` | ❌ W0 | ⬜ pending |
| Redis/BullMQ test | 01 | 1 | INFRA-03 | integration | `pnpm --filter @k21/api test --run` | ❌ W0 | ⬜ pending |
| Health endpoint test | 01 | 1 | INFRA-08 | unit | `pnpm --filter @k21/api test --run` | ❌ W0 | ⬜ pending |
| Docker Compose base | 02 | 1 | INFRA-01..05 | smoke | `docker compose config` | N/A — config-check | ⬜ pending |
| Log rotation config | 02 | 1 | INFRA-05 | config-check | `docker inspect <svc> --format '{{.HostConfig.LogConfig}}'` | ❌ W0 (script) | ⬜ pending |
| SSL bootstrap | 03 | 2 | INFRA-01 | manual (VPS) | `curl -I https://$DOMAIN` | N/A — manual | ⬜ pending |
| HTTP→HTTPS redirect | 03 | 2 | INFRA-01 | manual (VPS) | `curl -I http://$DOMAIN` | N/A — manual | ⬜ pending |
| Backup script | 04 | 2 | INFRA-06 | unit | `bash backup/test-backup.sh` | ❌ W0 | ⬜ pending |
| B2 upload + retention | 04 | 2 | INFRA-06,07 | manual | restore drill (manual) | N/A — manual | ⬜ pending |
| Netdata binding | 05 | 2 | INFRA-08 | manual (VPS) | `curl http://127.0.0.1:19999/api/v1/info` via SSH | N/A — manual | ⬜ pending |
| CI/CD deploy | 06 | 3 | INFRA-04 | manual | GitHub Actions logs | N/A — manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/package.json` — add `vitest @vitest/coverage-v8` devDependencies
- [ ] `apps/api/vitest.config.ts` — Vitest config for API unit tests
- [ ] `apps/api/src/db/index.test.ts` — DB connection stub through PgBouncer (INFRA-02)
- [ ] `apps/api/src/queue/connection.test.ts` — Redis/BullMQ connection stub (INFRA-03)
- [ ] `apps/api/src/index.test.ts` — GET /health → 200 (INFRA-08)
- [ ] `backup/test-backup.sh` — dry-run backup smoke test without B2 upload (INFRA-06)
- [ ] `scripts/smoke-test.sh` — VPS manual smoke test checklist (INFRA-01, INFRA-05, INFRA-07, INFRA-08)
- [ ] Root `package.json` — wire `test`, `lint`, `typecheck` scripts across workspace

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HTTPS reachable at domain with valid cert | INFRA-01 | Requires live VPS + DNS | SSH into VPS; run `curl -I https://$DOMAIN`; verify 200 + valid cert headers |
| HTTP redirects to HTTPS (301) | INFRA-01 | Requires live VPS | `curl -I http://$DOMAIN`; verify 301 + Location header |
| CI/CD deploy triggers on push to main | INFRA-04 | Requires GitHub Actions run | Push a commit; verify Actions workflow runs and VPS is updated |
| Backup uploaded to B2 nightly | INFRA-06 | Requires live B2 bucket | Wait for cron job or trigger manually; verify B2 bucket shows encrypted file |
| Restore drill succeeds | INFRA-06,07 | Requires decrypt + pg_restore | Download backup from B2, decrypt with GPG key, restore to test DB, verify data integrity |
| Files older than 7 days deleted from B2 | INFRA-07 | Requires 7+ days of uploads | Check B2 bucket after 7 days; or inject test files with old dates |
| Netdata accessible on localhost:19999 only | INFRA-08 | Requires VPS access | SSH tunnel: `ssh -L 19999:localhost:19999 user@vps`; verify dashboard loads; verify port NOT accessible from internet |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
