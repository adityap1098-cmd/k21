---
phase: 01
slug: auth-rbac
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^1.6.0 |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @k21/api test` |
| **Full suite command** | `pnpm --filter @k21/api test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @k21/api test`
- **After every plan wave:** Run `pnpm --filter @k21/api test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | AUTH-01,02,03 | unit | `pnpm --filter @k21/api test -- src/modules/auth/auth.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | AUTH-05 | unit | `pnpm --filter @k21/api test -- src/middleware/authenticate.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | AUTH-05 | unit | `pnpm --filter @k21/api test -- src/middleware/require-role.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 0 | AUTH-06,08 | unit | `pnpm --filter @k21/api test -- src/modules/users/users.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 0 | AUTH-04 | unit | `pnpm --filter @k21/api test -- src/db/schema/users.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | AUTH-04 | unit | `pnpm --filter @k21/api test -- src/db/schema` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | AUTH-01,02,03 | unit | `pnpm --filter @k21/api test -- src/modules/auth/auth.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 1 | AUTH-05 | unit | `pnpm --filter @k21/api test -- src/middleware/authenticate.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 1 | AUTH-05 | unit | `pnpm --filter @k21/api test -- src/middleware/require-role.test.ts` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 2 | AUTH-06,08 | unit | `pnpm --filter @k21/api test -- src/modules/users/users.test.ts` | ❌ W0 | ⬜ pending |
| 01-06-01 | 06 | 2 | AUTH-07 | integration | `pnpm --filter @k21/api test -- src/index.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/auth/auth.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-03
- [ ] `apps/api/src/modules/users/users.test.ts` — stubs for AUTH-06, AUTH-08
- [ ] `apps/api/src/middleware/authenticate.test.ts` — stub for AUTH-05 (401 path)
- [ ] `apps/api/src/middleware/require-role.test.ts` — stub for AUTH-05 (403 path)
- [ ] `apps/api/src/db/schema/users.test.ts` — stub for AUTH-04 (enum values)
- [ ] Install: `pnpm --filter @k21/api add jose argon2 cookie-parser && pnpm --filter @k21/api add -D @types/cookie-parser`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| httpOnly cookie set in browser | AUTH-02 | Requires browser DevTools inspection | Login via browser, check Application → Cookies for `refresh_token` with HttpOnly flag |
| Deactivated user loses access mid-session | AUTH-06 | Requires two simultaneous sessions | Log in as user, deactivate via admin, verify next API call returns 401 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
