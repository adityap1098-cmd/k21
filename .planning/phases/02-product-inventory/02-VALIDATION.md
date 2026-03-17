---
phase: 2
slug: product-inventory
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^1.6.0 |
| **Config file** | `apps/api/vitest.config.ts` (exists) |
| **Quick run command** | `pnpm --filter @k21/api test` |
| **Full suite command** | `pnpm --filter @k21/api test:coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @k21/api test`
- **After every plan wave:** Run `pnpm --filter @k21/api test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | PROD-01, PROD-02, PROD-03 | unit | `pnpm --filter @k21/api test -- src/modules/products/products.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | INV-01..INV-08 | unit | `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | PROD-01 | unit | `pnpm --filter @k21/api test -- src/modules/products/products.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | PROD-02 | unit | `pnpm --filter @k21/api test -- src/modules/products/products.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | PROD-03 | unit | `pnpm --filter @k21/api test -- src/modules/products/products.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 1 | INV-01 | unit | `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 1 | INV-02, INV-03, INV-04 | unit | `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 1 | INV-05 | unit | `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-04 | 03 | 1 | INV-06 | unit | `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | INV-07 | unit | `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 2 | INV-08 | unit | `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/products/products.test.ts` — stubs for PROD-01, PROD-02, PROD-03
- [ ] `apps/api/src/modules/categories/categories.test.ts` — covers category CRUD and access control
- [ ] `apps/api/src/modules/inventory/inventory.test.ts` — stubs for INV-01 through INV-08
- [ ] `apps/api/src/queues/redis.ts` — shared Redis instance (new file, not test)
- [ ] `apps/api/src/queues/lowstock.queue.ts` — BullMQ queue + worker (new file, not test)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PgBouncer + FOR UPDATE isolation | INV-05 | Requires real concurrent connections; mocked transaction tests confirm API shape but not PgBouncer mode | Run two parallel curl calls with qty=1 when stock=1; confirm exactly one 409 response |
| BullMQ low-stock notification delivery | INV-07 | Requires live Redis + worker process | Decrement stock below threshold; check notifications table and Redis job queue |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
