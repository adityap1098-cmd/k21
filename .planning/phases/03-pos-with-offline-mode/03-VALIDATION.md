---
phase: 3
slug: pos-with-offline-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^1.6 (apps/api — existing) |
| **Config file** | `apps/api/vitest.config.ts` (existing) |
| **Quick run command** | `pnpm --filter @k21/api test -- pos.test.ts shifts.test.ts` |
| **Full suite command** | `pnpm --filter @k21/api test:coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @k21/api test -- pos.test.ts shifts.test.ts`
- **After every plan wave:** Run `pnpm --filter @k21/api test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green + manual PWA offline scenario verified
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | POS-01..11 | unit stubs | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | POS-05 | unit stubs | `pnpm --filter @k21/api test -- shifts.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | POS-11 | integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | POS-11 | integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | POS-01,02,03 | unit+integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | POS-05 | unit+integration | `pnpm --filter @k21/api test -- shifts.test.ts` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 2 | POS-06 | integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ W0 | ⬜ pending |
| 3-04-02 | 04 | 2 | POS-04 | unit (pure fn) | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ W0 | ⬜ pending |
| 3-05-01 | 05 | 3 | POS-07 | manual | Chrome DevTools | ❌ Manual only | ⬜ pending |
| 3-05-02 | 05 | 3 | POS-08 | manual | Browser IndexedDB | ❌ Manual only | ⬜ pending |
| 3-06-01 | 06 | 4 | POS-09,10 | integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/pos/pos.test.ts` — stubs for POS-01 through POS-11 API behavior
- [ ] `apps/api/src/modules/shifts/shifts.test.ts` — stubs for POS-05 shift open/close
- [ ] `apps/api/src/db/schema/pos.ts` — transactions, transaction_items, transaction_payments, shifts tables
- [ ] `apps/api/src/db/schema/accounting.ts` — journal_entries stub table
- [ ] Migration SQL for Phase 3 schema + `client_uuid` UNIQUE constraint on transactions

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PWA registers Service Worker, manifest valid, installable | POS-07 | Requires browser runtime + Chrome DevTools | DevTools → Application → Service Workers → verify registered; Manifest → verify valid; check "Add to Home Screen" prompt |
| Offline transaction written to IndexedDB with status 'pending' | POS-08 | Requires browser IndexedDB environment | DevTools → Network → set Offline → complete a sale → Application → IndexedDB → offlineQueue → verify 1 pending record with correct client_uuid |
| Product catalog precached in IndexedDB, POS usable with no network | POS-07,08 | Requires browser + network simulation | Open POS → DevTools Offline → search products, complete transaction → verify no errors |
| Thermal printer receipt prints correctly (58mm and 80mm) | POS-04 | Requires physical thermal printer hardware | Connect printer via USB → tap Print → verify line items, totals, and change due print correctly at both paper widths |
| WhatsApp share link opens with all receipt fields | POS-04 | Requires WhatsApp installed on device | Tap "Share Receipt" after payment → WhatsApp opens with pre-filled text → verify store name, items, total, date all present |
| Offline→online sync round-trip: 2 transactions sync, no duplicates | POS-09 | Requires real browser offline/online toggle | Go offline → complete 2 transactions → go online → verify SyncStatusBar shows "Syncing 2" → verify both appear in server transaction list → repeat sync → verify count stays at 2 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
