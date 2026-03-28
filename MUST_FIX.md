Functional Testing agent selesai — menemukan 5 CRITICAL, 9 HIGH issues. Menunggu 6 agent lainnya...

● Agent "UI testing - frontend review" completed

● UI Testing agent selesai — 10 HIGH issues. Menunggu 5 agent lainnya...

● Agent "Smoke testing - build & startup" completed

● Smoke Testing agent selesai — 2 CRITICAL, 4 HIGH issues. Menunggu 4 agent lainnya...

● Agent "Architecture review for VPS deploy" completed

● Architecture Review agent selesai — 6 MUST FIX, 8 SHOULD FIX. Menunggu 3 agent lainnya (Security, Integration,
  Load/Stress)...

● Agent "Load/stress testing analysis" completed

● Load/Stress Testing agent selesai — estimated max 3-5 concurrent users safely, failures at 10-15. Menunggu 2 agent
  terakhir (Security, Integration)...

● Agent "Integration testing - frontend-backend" completed

● Integration Testing agent selesai — 2 CRITICAL, 6 HIGH. Menunggu agent terakhir (Security)...

● Background command "Find all references to SHOPEE_PARTNER_KEY" completed (exit code 0)

● Masih menunggu Security Reviewer agent — yang terakhir. Begitu selesai saya compile full report.

● Agent "Security testing - auth & injection" completed

● Semua 7 agent selesai. Saya compile report komprehensif sekarang.

  ---
  K21 POS SYSTEM — COMPREHENSIVE TESTING REPORT

  Date: 2026-03-28 | Branch: master | Target: VPS Production Deployment

  ---
  EXECUTIVE SUMMARY

  ┌─────────────────────┬──────────┬──────┬────────┬─────┐
  │    Testing Area     │ CRITICAL │ HIGH │ MEDIUM │ LOW │
  ├─────────────────────┼──────────┼──────┼────────┼─────┤
  │ Security Testing    │ 5        │ 8    │ 6      │ 5   │
  ├─────────────────────┼──────────┼──────┼────────┼─────┤
  │ Functional Testing  │ 5        │ 9    │ 8      │ 6   │
  ├─────────────────────┼──────────┼──────┼────────┼─────┤
  │ Integration Testing │ 2        │ 6    │ 7      │ 4   │
  ├─────────────────────┼──────────┼──────┼────────┼─────┤
  │ UI Testing          │ 0        │ 10   │ 11     │ 4   │
  ├─────────────────────┼──────────┼──────┼────────┼─────┤
  │ Smoke Testing       │ 2        │ 4    │ 4      │ 5   │
  ├─────────────────────┼──────────┼──────┼────────┼─────┤
  │ Load/Stress Testing │ 3        │ 5    │ 3      │ 3   │
  ├─────────────────────┼──────────┼──────┼────────┼─────┤
  │ Architecture Review │ 6        │ 8    │ 4      │ 4   │
  └─────────────────────┴──────────┴──────┴────────┴─────┘

  After deduplication across all agents: ~15 unique CRITICAL, ~25 unique HIGH findings.

  Verdict: BLOCK DEPLOY — System is not safe for production in current state.

  Estimated safe capacity: 3-5 concurrent users before performance degrades, hard failures at 10-15.

  ---
  PART 1: CRITICAL ISSUES (Must Fix Before Deploy)

  These are deployment blockers — the system will either break, be exploitable, or lose data.

  ---
  C-01. CORS Allows All Origins (SECURITY + FUNCTIONAL)

  File: apps/api/src/index.ts:61

  callback(null, true) // Allow all for now — tighten after domain setup

  Any website on the internet can make authenticated requests to your API with the user's cookies. Combined with
  credentials: true, an attacker's site can silently steal data, void transactions, or create fake sales.

  Fix: Replace fallthrough with deny:
  callback(new Error('Origin not allowed by CORS'))

  ---
  C-02. No Rate Limiting — Brute Force Wide Open (SECURITY)

  File: apps/api/src/modules/auth/auth.router.ts

  Zero rate limiting on /auth/login, /auth/refresh, /auth/change-password. Unlimited password guessing attacks possible.

  Fix: Install express-rate-limit, apply on auth endpoints (5-10 req/min per IP).

  ---
  C-03. Client-Submitted Price & Payment Trusted (FUNCTIONAL)

  File: apps/api/src/modules/pos/pos.service.ts

  The server never verifies that:
  - unitPrice matches the actual product variant price in DB
  - sum(payments) >= total

  A cashier can submit unitPrice: 1 for an item worth Rp 100,000, or pay Rp 1 for a Rp 1,000,000 transaction. Both are
  recorded as COMPLETED.

  Fix:
  1. In completeSale, fetch canonical price from product_variants and validate
  2. Assert payments.reduce((s,p) => s + p.amount, 0) >= total

  ---
  C-04. forceComplete Bypasses All Stock Checks — Cashier Can Access (SECURITY + FUNCTIONAL)

  File: apps/api/src/modules/pos/pos.router.ts:83-117

  Any Cashier can send { forceComplete: true } to /transactions/sync and skip ALL stock validation, driving inventory
  negative.

  Fix: Restrict to requireRole('Owner', 'Admin') only.

  ---
  C-05. JWT Fallback Secret in Production Code (FUNCTIONAL)

  Files: apps/api/src/middleware/authenticate.ts:4-6, apps/api/src/modules/auth/auth.service.ts:8-10

  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'

  Both files independently define JWT_SECRET with the same guessable fallback. If JWT_SECRET env var is missing on any
  non-production environment (staging, preview), tokens are signed with a known string — attacker can forge any JWT.

  Fix: Remove ?? 'dev-secret-change-in-production' from both files. Throw on startup if missing.

  ---
  C-06. Access Token in localStorage — XSS Exfiltration (SECURITY)

  File: apps/web/src/lib/api.ts:14

  8-hour JWT stored in localStorage, accessible to any XSS vector. Combined with no CSP (HIGH-05), this is high risk.

  Fix: Remove all localStorage reads/writes. Keep token in memory only. Use /auth/refresh on page load to rehydrate.

  ---
  C-07. SHOPEE_PARTNER_KEY Empty = Webhook Signature Bypass (SECURITY + SMOKE)

  File: apps/api/src/modules/marketplace/webhook.router.ts:129

  Fallback to '' means HMAC('', body) is computable by anyone. Attacker can forge webhook events to decrement stock,
  cancel orders, create journal entries.

  Fix: Throw if key is missing. Add to deploy .env and startup validation.

  ---
  C-08. PgBouncer userlist.txt Has Placeholder Hash (SMOKE + ARCH)

  File: pgbouncer/userlist.txt:5

  "appuser" "md5CHANGEME" — literal placeholder. PgBouncer will reject ALL database connections in production.

  Fix: Generate correct MD5 hash before deploy: echo -n "${PASSWORD}appuser" | md5sum

  ---
  C-09. JWT_SECRET + SHOPEE_PARTNER_KEY Missing from CI/CD Deploy (ARCH)

  File: .github/workflows/ci-cd.yml:103-118

  The .env heredoc written during deploy omits JWT_SECRET and SHOPEE_PARTNER_KEY. API will crash-loop (JWT) and
  marketplace will silently fail (Shopee).

  Fix: Add both to the heredoc and GitHub Actions secrets.

  ---
  C-10. Web Container Missing API_URL (ARCH)

  File: apps/web/next.config.mjs:18

  API_URL not passed as build arg or env var — all server-side API calls hit localhost:3004 which doesn't exist in the
  container. All SSR and Excel export will fail.

  Fix: Pass API_URL=http://api:3001 as Docker build arg and runtime env.

  ---
  C-11. No Database Migration Step in Deploy Pipeline (SMOKE + ARCH)

  File: .github/workflows/ci-cd.yml

  Deploy only runs docker compose up -d — never applies migrations. Schema changes = runtime SQL errors. 17 of 19
  migrations aren't even in the Drizzle journal.

  Fix: Add migration runner step before up -d.

  ---
  C-12. Missing Database Indexes — 18+ Critical Indexes Absent (LOAD/STRESS)

  Key missing indexes that cause full table scans:

  ┌──────────────────────┬──────────────────────────────────────────┬──────────────────────────────────────┐
  │        Table         │              Missing Index               │                Impact                │
  ├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤
  │ transactions         │ shift_id, status, created_at, cashier_id │ Every POS list, dashboard, analytics │
  ├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤
  │ transaction_payments │ transaction_id                           │ Shift reconciliation                 │
  ├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤
  │ shifts               │ cashier_id + status                      │ Open shift check (every POS action)  │
  ├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤
  │ notifications        │ user_id + read_at                        │ Polled every 30s per user            │
  ├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤
  │ product_variants     │ product_id                               │ Every product detail view            │
  ├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤
  │ journal_entries      │ created_at, source_type                  │ All accounting reports               │
  ├──────────────────────┼──────────────────────────────────────────┼──────────────────────────────────────┤
  │ audit_logs           │ created_at, user_id                      │ Audit log browsing                   │
  └──────────────────────┴──────────────────────────────────────────┴──────────────────────────────────────┘

  ---
  C-13. listProducts Loads ALL Products + Variants Into Memory (FUNCTIONAL + LOAD)

  File: apps/api/src/modules/products/products.service.ts:114-158

  const allProducts = await db.select().from(products)  // NO WHERE, NO LIMIT
  const allVariants = await db.select().from(productVariants)  // NO WHERE, NO LIMIT

  Filters applied in-memory after full table load. Will OOM with large catalogs.

  Fix: Push WHERE and LIMIT/OFFSET into SQL.

  ---
  C-14. POST /auth/logout Never Called from Frontend (INTEGRATION)

  File: apps/web/src/lib/auth.ts:42-51

  Frontend logout() only clears local state — never calls the backend endpoint to invalidate the refresh cookie. Cookie
  remains valid for its full TTL. User thinks they're logged out but their session is still active.

  Fix: Call POST /api/v1/auth/logout before clearing local state.

  ---
  C-15. POST /payroll/employees Route Doesn't Exist (INTEGRATION)

  File: apps/web/src/app/payroll/page.tsx:60

  Frontend "Tambah Karyawan" calls POST /api/v1/payroll/employees — endpoint doesn't exist. Always 404s.

  Fix: Either add the endpoint or remove the broken button.

  ---
  PART 2: HIGH ISSUES (Should Fix Before Deploy)

  Security HIGH

  ┌──────┬──────────────────────────────────────────────────────────────────────┬───────────────────────┐
  │  #   │                                Issue                                 │         File          │
  ├──────┼──────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ H-01 │ JWT algorithm not pinned in verification (algorithm confusion risk)  │ authenticate.ts:16    │
  ├──────┼──────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ H-02 │ No refresh token rotation — stolen token valid for 30 days           │ auth.service.ts:70    │
  ├──────┼──────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ H-03 │ Next.js 14.x has known DoS CVE (RSC deserialization)                 │ apps/web/package.json │
  ├──────┼──────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ H-04 │ path-to-regexp ReDoS in Express transitive dep                       │ apps/api              │
  ├──────┼──────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ H-05 │ CSP disabled on API AND not configured on Next.js — zero CSP         │ index.ts:46           │
  ├──────┼──────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ H-06 │ Products/inventory GET has no role restriction — cost prices exposed │ products.router.ts:46 │
  ├──────┼──────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ H-07 │ IP address spoofable via raw X-Forwarded-For in audit logs           │ products.router.ts:70 │
  ├──────┼──────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ H-08 │ Webhook payload stored to DB before HMAC verification                │ webhook.router.ts:112 │
  └──────┴──────────────────────────────────────────────────────────────────────┴───────────────────────┘

  Functional HIGH

  ┌──────┬───────────────────────────────────────────────────────────────────────────┬───────────────────────────────┐
  │  #   │                                   Issue                                   │             File              │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ H-09 │ closeShift — UPDATE + INSERT not wrapped in transaction (data loss on     │ shifts.service.ts:57          │
  │      │ crash)                                                                    │                               │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ H-10 │ processOrderShipped — fulfillReservation + decrementStock not atomic      │ marketplace.service.ts:371    │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ H-11 │ deleteServiceOrder — can delete COMPLETED orders, leaving unbalanced      │ service-orders.service.ts:308 │
  │      │ journals                                                                  │                               │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ H-12 │ updateTransactionNote — can modify VOIDED transactions                    │ pos.service.ts:499            │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ H-13 │ N+1 queries: getReceivables (2N queries), getDailyCashReport (4N queries) │ Multiple files                │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ H-14 │ Warehouse getWarehouseStock — empty WHERE clause returns all variants     │ warehouse.service.ts:75       │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼───────────────────────────────┤
  │ H-15 │ Cashier can view ANY shift's reconciliation (no ownership check)          │ shifts.router.ts:205          │
  └──────┴───────────────────────────────────────────────────────────────────────────┴───────────────────────────────┘

  Integration HIGH

  ┌──────┬───────────────────────────────────────────────────────────────────────────┬──────────────────────┐
  │  #   │                                   Issue                                   │         File         │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼──────────────────────┤
  │ H-16 │ Warehouse page: stock detail + transfer features broken (UI dead buttons) │ warehouse/page.tsx   │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼──────────────────────┤
  │ H-17 │ Category PATCH/DELETE, variant POST/PATCH have no frontend UI             │ Products module      │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼──────────────────────┤
  │ H-18 │ Marketplace order detail endpoint unreachable from UI                     │ marketplace/page.tsx │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼──────────────────────┤
  │ H-19 │ Mechanics management — no frontend page (CRUD only via API)               │ No /mechanics page   │
  ├──────┼───────────────────────────────────────────────────────────────────────────┼──────────────────────┤
  │ H-20 │ authFetch missing PASSWORD_CHANGE_REQUIRED handling (unlike api())        │ auth-fetch.ts        │
  └──────┴───────────────────────────────────────────────────────────────────────────┴──────────────────────┘

  UI HIGH

  ┌──────┬────────────────────────────────────────────────────────────────────────────┬─────────────────────────────┐
  │  #   │                                   Issue                                    │            File             │
  ├──────┼────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ H-21 │ No React Error Boundaries — any render error = blank white screen          │ Entire app                  │
  ├──────┼────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ H-22 │ PaymentModal/ShiftDrawer/ReturnModal: no role="dialog", no focus trap, no  │ POS components              │
  │      │ ARIA                                                                       │                             │
  ├──────┼────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ H-23 │ Zustand stores not persisted — cart lost on refresh, no warning            │ cart.store.ts,              │
  │      │                                                                            │ shift.store.ts              │
  ├──────┼────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ H-24 │ Logout doesn't clear Zustand stores — cross-user state leakage on shared   │ auth.ts                     │
  │      │ devices                                                                    │                             │
  ├──────┼────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ H-25 │ POS layout w-1/2 + grid-cols-4 — unusable on tablet                        │ pos/page.tsx                │
  ├──────┼────────────────────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ H-26 │ Warehouse Staff sees blank dashboard page                                  │ dashboard/page.tsx          │
  └──────┴────────────────────────────────────────────────────────────────────────────┴─────────────────────────────┘

  Infrastructure HIGH

  ┌──────┬──────────────────────────────────────────────────────────────────┬───────────────────────────────────────┐
  │  #   │                              Issue                               │                 File                  │
  ├──────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ H-27 │ Redis has no --maxmemory cap — will OOM the VPS                  │ docker-compose.yml                    │
  ├──────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ H-28 │ BullMQ queues have no job retention — Redis grows forever        │ lowstock.queue.ts                     │
  ├──────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ H-29 │ Dual Redis config (REDIS_URL vs REDIS_HOST) — will fail in       │ queues/redis.ts vs                    │
  │      │ Docker                                                           │ queue/connection.ts                   │
  ├──────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ H-30 │ No unhandledRejection/uncaughtException handlers                 │ index.ts                              │
  ├──────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ H-31 │ Health check doesn't verify DB/Redis connectivity                │ index.ts:72                           │
  ├──────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ H-32 │ Python3 missing from web container for Excel export              │ apps/web/Dockerfile                   │
  ├──────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ H-33 │ Shift open race condition — TOCTOU allows duplicate open shifts  │ shifts.service.ts:26                  │
  ├──────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────────┤
  │ H-34 │ POS deadlock risk — variant IDs not sorted before FOR UPDATE     │ pos.service.ts:70                     │
  └──────┴──────────────────────────────────────────────────────────────────┴───────────────────────────────────────┘

  ---
  PART 3: VPS CAPACITY ANALYSIS

  ┌───────────────┬──────────────────┬─────────────────────────────────┐
  │   Scenario    │ Concurrent Users │         Limiting Factor         │
  ├───────────────┼──────────────────┼─────────────────────────────────┤
  │ Comfortable   │ 3-5              │ PgBouncer pool (20 connections) │
  ├───────────────┼──────────────────┼─────────────────────────────────┤
  │ Degraded      │ 5-10             │ Missing indexes, slow queries   │
  ├───────────────┼──────────────────┼─────────────────────────────────┤
  │ Hard failures │ 10-15            │ Connection pool exhaustion      │
  ├───────────────┼──────────────────┼─────────────────────────────────┤
  │ System crash  │ 15-20            │ OOM on 2GB VPS                  │
  └───────────────┴──────────────────┴─────────────────────────────────┘

  7 Docker containers baseline: ~800MB-1.5GB RAM. On a 1GB VPS = guaranteed OOM. Minimum 2GB, recommended 4GB.

  ---
  PART 4: WHAT'S DONE RIGHT (Positive Findings)

  ┌──────────────────────────────────────────┬───────────────────────────────┐
  │                   Area                   │          Assessment           │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Argon2id password hashing                │ Correct                       │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Zod input validation on all endpoints    │ Consistent                    │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Drizzle ORM parameterized queries        │ No SQL injection found        │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Idempotency key on POS transactions      │ Correct (clientUuid)          │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ FOR UPDATE row-level locking on stock    │ Correct (needs sort fix)      │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Multi-stage Dockerfiles                  │ Minimal final images          │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ PgBouncer connection pooling             │ Well-configured               │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Encrypted B2 backups + restore script    │ Good                          │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ SSL/TLS with auto-renewal                │ Configured                    │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Helmet security headers                  │ Active                        │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Log rotation on all containers           │ Configured                    │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Graceful shutdown (SIGTERM/SIGINT)       │ Present                       │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Error message sanitization               │ resolveError() prevents leaks │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ Token invalidation on user deactivation  │ Correct                       │
  ├──────────────────────────────────────────┼───────────────────────────────┤
  │ HMAC timing-safe comparison for webhooks │ Correct                       │
  └──────────────────────────────────────────┴───────────────────────────────┘

  ---
  PART 5: PRIORITY FIX ORDER

  Sprint 1 — Security Hardening (Day 1-2)

  1. CORS: remove wildcard fallthrough (~15 min)
  2. Rate limiting: express-rate-limit on auth (~1 hr)
  3. JWT: remove fallback secret, pin algorithm (~30 min)
  4. forceComplete: restrict to Owner/Admin (~15 min)
  5. Access token: remove from localStorage (~1 hr)
  6. Logout: call backend endpoint (~30 min)
  7. SHOPEE_PARTNER_KEY: add startup guard (~15 min)
  8. Update next and express for CVE patches (~2 hr)

  Sprint 2 — Data Integrity (Day 2-3)

  9. Server-side price + payment validation (~2 hr)
  10. Wrap closeShift in db.transaction() (~30 min)
  11. Wrap processOrderShipped in db.transaction() (~30 min)
  12. Add 18+ missing database indexes (~1 hr)
  13. Fix listProducts to use SQL-level filtering (~2 hr)
  14. Fix shift open race condition (partial unique index) (~30 min)
  15. Sort variant IDs before FOR UPDATE (~15 min)

  Sprint 3 — Deploy Pipeline (Day 3-4)

  16. Fix CI/CD: add JWT_SECRET, SHOPEE_PARTNER_KEY to deploy .env (~15 min)
  17. Fix PgBouncer userlist.txt (~15 min)
  18. Add API_URL to web container build (~20 min)
  19. Add migration step to deploy pipeline (~1 hr)
  20. Fix Redis: add --maxmemory 256mb, consolidate config (~30 min)
  21. Add BullMQ job retention limits (~15 min)
  22. Add unhandledRejection handlers (~10 min)
  23. Deep health check (DB/Redis) (~15 min)

  Sprint 4 — UI & Integration (Day 4-5)

  24. Add React Error Boundaries on critical pages (~2 hr)
  25. Fix PaymentModal/ShiftDrawer ARIA + focus trap (~3 hr)
  26. Persist Zustand stores + clear on logout (~1 hr)
  27. Fix broken payroll endpoint / button (~30 min)
  28. Fix N+1 queries in getReceivables, getDailyCashReport (~2 hr)
  29. Add CSP headers (~1 hr)
  30. Replace console.log with structured logger (pino) (~3 hr)

  Total estimated effort: ~25-30 hours across 4-5 days.

  ---
  Mau saya langsung mulai fix dari Sprint 1 (security hardening)?