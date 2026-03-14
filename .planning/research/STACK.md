# Technology Stack

**Project:** K21 Retail ERP
**Researched:** 2026-03-14
**Research Mode:** Ecosystem / Validation
**Confidence Note:** Web search and WebFetch were unavailable during this research session. All version numbers are sourced from training data (knowledge cutoff August 2025). Versions MUST be verified against npm registry before pinning in package.json.

---

## Recommended Stack

### Core Runtime & Backend Framework

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Node.js | 22 LTS (Iron) | Runtime | LTS track, V8 improvements in native fetch, perf improvements over 20. Use 22.x not 20.x — BullMQ and Drizzle both work well on 22 LTS. |
| Express.js | ^4.19 | HTTP framework | Stack locked. v4 is stable, well-understood, massive middleware ecosystem. Express 5 (RC at cutoff) is not yet widely production-tested — stay on v4 unless PRD explicitly requires v5 middleware semantics. |
| TypeScript | ^5.4 | Type safety | Strict mode mandatory. Enables Drizzle's inferred schema types and catches domain model errors at compile time. |
| tsx / ts-node | tsx ^4.x | Dev execution | `tsx` is the preferred alternative to ts-node for Express — faster cold start, no config overhead. Use `tsx watch` in dev. |
| tsup | ^8.x | Build | Bundles TypeScript to CJS for production. Lightweight, zero-config for monolith. |

**Confidence: MEDIUM** — Express 4 / Node 22 / TS 5 are confirmed stable at training cutoff. Verify exact patch versions against npm before pinning.

---

### Frontend

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Next.js | ^14.2 or ^15.x | Admin dashboard + POS PWA | Stack locked. Next.js 15 (stable at cutoff) introduced React 19 support and improved App Router stability. For PWA support see note below. |
| React | ^18.3 / ^19.x | UI | Follows Next.js version. If on Next 14, pin React 18. If on Next 15, React 19 is supported. |
| next-pwa (Serwist) | ^9.x | PWA / Service Worker | CRITICAL: The original `next-pwa` package (`@ducanh2912/next-pwa`) has been succeeded by **Serwist** (`serwist`). Use `@serwist/next` — it is the maintained fork with active development in 2025. Do NOT use the unmaintained `next-pwa` from npm. |
| Dexie.js | ^4.x | IndexedDB abstraction | POS offline storage. Dexie provides a clean Promise-based API over IndexedDB, handles schema versioning, and works in Service Worker context. Much better DX than raw IndexedDB. |
| Zustand | ^4.x | Client state | Lightweight, no boilerplate. For POS cart state and offline queue management. Avoid Redux for a 10-person app. |
| React Query (TanStack Query) | ^5.x | Server state / sync | Handles stale-while-revalidate, background sync, optimistic updates. Critical for the offline-to-online sync story in POS. Pairs well with Zustand (client state) + React Query (server state). |
| shadcn/ui | N/A (copy-paste) | UI components | Built on Radix UI + Tailwind. Zero dependency weight, fully owned components. Ideal for ERP dashboard forms and tables. |
| Tailwind CSS | ^3.4 | Styling | Pairs with shadcn/ui. v4 alpha exists but not production-ready at cutoff — stay on v3. |

**Confidence: MEDIUM** — Serwist recommendation is HIGH confidence (confirmed maintained successor). Next.js 14 vs 15 choice needs verification of React 19 stability in production before committing.

**CRITICAL GAP — PWA on Next.js:** Next.js App Router does not have native Service Worker support as of training cutoff. You must use `@serwist/next` and configure the custom Service Worker manually. The POS offline flow depends entirely on this working correctly. Treat Phase 3 (POS) as a high-risk phase requiring a proof-of-concept spike before committing to the full implementation.

---

### Database & ORM

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| PostgreSQL | 16.x | Primary data store | Stack locked. PG 16 adds logical replication improvements and performance gains for JSONB (audit_logs use JSONB). PG 17 exists but 16 has wider hosting support. |
| PgBouncer | 1.22.x | Connection pooling | Stack locked. Use TRANSACTION mode (as specified in PRD) — this is correct for a stateless Node.js API. WARNING: TRANSACTION mode incompatibility with prepared statements — ensure Drizzle is configured with `{ prepareQuery: false }` or use the `node-postgres` adapter without prepared statements. |
| Drizzle ORM | ^0.30 / ^0.31 | ORM + migrations | Stack locked. Drizzle has a 0.x semver but is production-stable. Provides type-safe query builder, schema-as-code, and `drizzle-kit` for migrations. Key advantage: SQL-like API avoids ActiveRecord magic, making double-entry accounting queries transparent. |
| drizzle-kit | ^0.20 / ^0.21 | Schema migrations | Companion CLI for Drizzle schema push and migration generation. Pin same minor as drizzle-orm. |

**Confidence: MEDIUM** — PgBouncer transaction mode + prepared statements incompatibility is a KNOWN critical pitfall. Verify the Drizzle adapter configuration for this before writing any DB code.

---

### Cache & Queue

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Redis | 7.2.x | Cache + BullMQ storage | Stack locked. Redis 7.2 is current stable. For a single-VPS deployment, Redis OSS (not Redis Stack, not Valkey) is sufficient. |
| ioredis | ^5.x | Redis client for Node.js | Preferred over the official `redis` npm package for BullMQ usage — BullMQ internally uses ioredis. Use one client, not two. |
| BullMQ | ^5.x | Background job queue | Stack locked. BullMQ 5.x (stable at cutoff) requires Redis 7+. Provides job retry, rate limiting, delayed jobs, and sandboxed processors. Use for: marketplace sync, low-stock alerts, report generation, offline POS sync processing. |

**Confidence: MEDIUM** — BullMQ 5.x / Redis 7.2 pairing is confirmed stable at training cutoff. Verify current BullMQ version before pinning.

**NOTE on Valkey:** Redis Ltd changed the Redis license to RSAL in 2024. Valkey (the Linux Foundation fork) is a drop-in replacement. For a greenfield project in 2025/2026, consider using the `valkey` Docker image instead of `redis`. BullMQ is compatible with Valkey. However, given the budget-constrained single-VPS setup, either works — the Redis OSS 7.x Docker image remains available and functional. Flag for project decision.

---

### Authentication & Authorization

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| jsonwebtoken | ^9.x | JWT signing/verification | Standard library for JWT. Use RS256 (asymmetric) or HS256 with a strong secret. |
| bcrypt | ^5.x | Password hashing | Stack locked (PRD specifies bcrypt cost factor >= 12). Use `bcrypt` not `bcryptjs` — native binding is faster for a server. |
| express-jwt | ^8.x | JWT middleware | Validates Authorization header, attaches `req.auth`. Alternative: write a thin custom middleware — at this scale either works. |
| express-rate-limit | ^7.x | Rate limiting | PRD mandates rate limiting on login and public endpoints. Lightweight, no Redis dependency for basic usage. For distributed rate limiting (future), add `rate-limit-redis`. |

**Confidence: MEDIUM** — These are stable, long-lived packages. Versions accurate as of training cutoff.

---

### Validation & Error Handling

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Zod | ^3.x | Schema validation | Best-in-class TypeScript-first validation. Use at all API boundaries (request body, marketplace webhook payloads, env vars). Generates TypeScript types from schemas — no duplicate type definitions. |
| http-errors | ^2.x | HTTP error factory | Creates structured Express errors with status codes. Pairs with a central error handler middleware. |

**Confidence: HIGH** — Zod v3 is the dominant validation library for TS ecosystems and is stable.

---

### Logging & Monitoring

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Winston | ^3.x | Structured application logging | Stack locked. Use with `winston-daily-rotate-file` transport. Configure JSON format for machine-parseable logs. |
| winston-daily-rotate-file | ^5.x | Log file rotation | Companion to Winston. Prevents disk exhaustion on single VPS. |
| morgan | ^1.x | HTTP request logging | Express middleware for request/response logging. Feed its output into Winston stream. |

**Confidence: HIGH** — Winston 3.x is stable and the PRD specifies it explicitly.

---

### Infrastructure & DevOps

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Docker | 26.x+ | Containerization | Stack locked. Use official images. |
| Docker Compose | v2.x (compose plugin) | Orchestration | Stack locked. Use `docker compose` (v2 plugin syntax), NOT `docker-compose` (v1 standalone — deprecated). |
| Nginx | 1.26.x (stable) | Reverse proxy + SSL termination | Stack locked. Use `nginx:alpine` image. |
| Certbot | Latest | Let's Encrypt SSL | Stack locked. Use `certbot:latest` with Nginx plugin, or the `nginx-certbot` combined image for simpler setup. |
| edoburu/pgbouncer | Latest | PgBouncer in Docker | PRD specifies this image explicitly. It is a well-maintained community image. |
| netdata/netdata | Latest | System monitoring | Stack locked. Bind to localhost only (127.0.0.1:19999). |

**Confidence: HIGH** — Infrastructure choices are standard and well-validated.

---

### CI/CD

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | N/A | CI/CD pipeline | Stack locked. Use `ubuntu-latest` runners. SSH deploy to VPS via `appleboy/ssh-action`. |
| appleboy/ssh-action | ^1.x | SSH deployment | Standard action for remote SSH commands from GitHub Actions. Store VPS SSH key in GitHub Secrets. |

**Confidence: HIGH** — GitHub Actions + SSH deploy is the standard pattern for single-VPS deployments.

---

### Testing

| Technology | Version (verify) | Purpose | Why |
|------------|-----------------|---------|-----|
| Vitest | ^1.x / ^2.x | Unit + integration tests | Preferred over Jest for TypeScript + ESM projects. Faster, native TS support, compatible with the Node.js environment. Use for unit tests and API integration tests. |
| Supertest | ^7.x | HTTP integration testing | Test Express routes without starting a real server. Pairs with Vitest. |
| Playwright | ^1.x | E2E tests | For critical POS flows (including offline simulation). Playwright can intercept network requests to simulate offline mode. |

**Confidence: MEDIUM** — Vitest 2.x is current at training cutoff. Verify before pinning.

---

### Supporting Libraries — Domain-Specific

| Library | Version (verify) | Purpose | When to Use |
|---------|-----------------|---------|-------------|
| decimal.js | ^10.x | Precise decimal arithmetic | CRITICAL for all financial calculations (accounting, payroll, tax). Never use JavaScript native `number` for money. Use `decimal.js` or `big.js`. Floating-point errors in double-entry accounting are unacceptable. |
| date-fns | ^3.x | Date manipulation | Timezone-aware date handling for reports, payroll periods, shift management. Prefer over `moment.js` (deprecated). |
| nanoid | ^5.x | ID generation | Fast, URL-safe unique IDs. Use for transaction IDs, receipt numbers. Complements PostgreSQL UUIDs for short human-readable codes. |
| exceljs | ^4.x | Excel report export | For payroll slip export and financial reports in .xlsx format. Lighter than puppeteer for spreadsheet output. |
| puppeteer / playwright | ^22.x | PDF generation | For receipt PDFs and formal financial reports. Consider `@playwright/test` which is already in the test stack — reuse the same dep. Alternatively, use `html-pdf-node` for simpler cases. |
| Shopee Partner API SDK | N/A | Shopee integration | No official Node.js SDK exists at training cutoff. Must implement HTTP client directly against Shopee Open Platform API v2. Use `axios` or native `fetch` with HMAC-SHA256 request signing. |
| TikTok Shop API | N/A | TikTok Shop integration | Same situation — no official Node.js SDK. Implement against TikTok Shop Open API directly. Request signing required (similar pattern to Shopee). |
| axios | ^1.x | HTTP client | For marketplace API calls in BullMQ workers. Include retry logic with `axios-retry`. |
| zod-env | / @t3-oss/env-nextjs | ^0.10.x | Environment variable validation | Validates `.env` at startup — fails fast if required vars are missing. Critical for a system with DB credentials, JWT secrets, marketplace API keys. |

**Confidence: MEDIUM** — decimal.js recommendation is HIGH confidence (non-negotiable for financial systems). Shopee/TikTok SDK absence is HIGH confidence — both platforms require direct API implementation.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ORM | Drizzle ORM | Prisma | Prisma has a separate query engine binary (Rust), adding complexity and memory overhead on a constrained single VPS. Drizzle is zero-overhead, SQL-transparent — better for complex accounting queries. |
| ORM | Drizzle ORM | TypeORM | TypeORM has known stability issues with complex TypeScript types and decorator-based schema is verbose. Drizzle is the 2024-2025 community choice for TS/PostgreSQL. |
| Job Queue | BullMQ | pg-boss | pg-boss runs jobs on PostgreSQL, avoiding the Redis dependency. However, Redis is already present for caching, so BullMQ adds no new infrastructure. BullMQ has better DX and dashboards. |
| Job Queue | BullMQ | Temporal | Temporal is excellent for long-running workflows but requires a separate Temporal server — not viable on a single VPS budget. |
| Frontend State | Zustand + TanStack Query | Redux Toolkit | RTK is overengineered for a 10-user internal app. Zustand + TanStack Query split is the current community consensus for non-trivial apps. |
| PWA Library | @serwist/next | next-pwa (original) | The `next-pwa` package on npm is unmaintained (last release 2022). Serwist is the actively maintained fork with App Router support. |
| Frontend Framework | Next.js | Remix | Next.js has better PWA ecosystem support via Serwist. Remix is excellent but the offline POS requirement favors Next.js where Service Worker tooling is more mature. |
| Validation | Zod | Joi / Yup | Zod is TypeScript-first with inferred types — eliminates the need to write both a schema and a TypeScript interface. Joi and Yup require separate type declarations. |
| HTTP Client | axios | node-fetch / native fetch | axios has better interceptor support for HMAC signing and retry logic needed for marketplace API integration. Node.js 22 native fetch is viable but lacks interceptors. |
| Logging | Winston | Pino | Pino is faster and has a better async model. For this project, Winston is already specified in the PRD and its ecosystem (daily rotate) is sufficient. Switch to Pino only if log throughput becomes a bottleneck. |
| Password Hashing | bcrypt | Argon2 | Argon2 is technically superior but `bcrypt` is the specified choice in the PRD (bcrypt cost factor >= 12 is explicitly stated). bcrypt at cost 12 is adequate for a 10-user internal system. |

---

## Critical Gaps and Risks

### GAP 1: Shopee & TikTok Shop — No Official Node.js SDKs
**Risk Level: HIGH**
Neither Shopee Open Platform nor TikTok Shop Open API provide official Node.js SDKs. Both require:
- HMAC-SHA256 request signing on every API call
- Webhook signature verification on incoming events
- Token refresh flows (OAuth-style)

This means significant custom HTTP client code per marketplace. Plan for 2-3 weeks of integration work per marketplace. Isolate each marketplace behind an adapter interface so the internal domain code is decoupled from API quirks.

### GAP 2: PgBouncer Transaction Mode — Prepared Statement Incompatibility
**Risk Level: HIGH**
PgBouncer in TRANSACTION pool mode (as specified in PRD) does not support PostgreSQL prepared statements. Drizzle ORM's `node-postgres` driver (`pg`) uses prepared statements by default. This will cause silent failures or errors.

**Resolution:** When initializing Drizzle with `pg`, set:
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Do NOT use prepared statements with PgBouncer transaction mode
});

export const db = drizzle(pool);
```
Alternatively, use the `postgres.js` driver (`drizzle-orm/postgres-js`) which avoids this issue more cleanly. The `postgres` (postgres.js) package is lighter than `pg` and handles PgBouncer better. Consider switching from `pg` to `postgres` as the Drizzle driver.

### GAP 3: Next.js PWA — Service Worker Setup Complexity
**Risk Level: MEDIUM**
PWA with offline support via `@serwist/next` requires non-trivial configuration:
- Custom Service Worker file
- Cache strategy definition (cache-first for product catalog, network-first for transactions)
- IndexedDB sync queue logic must be custom-built (Serwist does not provide this)

The offline-to-online sync for POS transactions is the most complex part of this stack. It requires a conflict resolution strategy for transactions created offline. Plan a dedicated spike (Phase 3) before full implementation.

### GAP 4: Double-Entry Accounting — No Dedicated Library
**Risk Level: LOW-MEDIUM**
No mature Node.js double-entry accounting library exists that is actively maintained. The accounting engine must be built from scratch:
- Chart of accounts definition
- Journal entry validation (debits === credits)
- Period closing logic
- Report generation (P&L, Balance Sheet, Cash Flow)

Use `decimal.js` for all arithmetic. Never use JavaScript `number`. This is custom domain logic — budget 3-4 weeks for the accounting module in Phase 7.

### GAP 5: PPh 21 Tax Calculation
**Risk Level: MEDIUM**
Indonesia PPh 21 payroll tax rules change annually. No reliable open-source library exists for this. The payroll module (Phase 8) requires implementing the PTKP/PTKP tables and progressive tax brackets from DJP regulations. Factor in annual maintenance cost when PPh 21 rules update.

### GAP 6: Redis License Change (Valkey consideration)
**Risk Level: LOW**
Redis changed to RSAL (Server Side Public License variant) in 2024. For a self-hosted, non-SaaS deployment this does not affect usage rights. However, if there is any concern, swap the `redis:7-alpine` Docker image for `valkey/valkey:7-alpine`. BullMQ is compatible with Valkey. Decision can be deferred.

---

## Installation Reference

```bash
# Backend core
npm install express typescript tsx tsup
npm install drizzle-orm pg
npm install drizzle-kit --save-dev
npm install bullmq ioredis
npm install jsonwebtoken bcrypt express-rate-limit
npm install zod winston winston-daily-rotate-file morgan
npm install decimal.js date-fns nanoid axios axios-retry
npm install @t3-oss/env-nextjs  # or equivalent env validator
npm install exceljs

# Backend dev dependencies
npm install -D @types/express @types/node @types/pg @types/jsonwebtoken @types/bcrypt @types/morgan
npm install -D vitest supertest @types/supertest
npm install -D typescript @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint

# Frontend (in /apps/web or Next.js project root)
npm install next react react-dom
npm install @serwist/next serwist
npm install dexie zustand @tanstack/react-query
npm install tailwindcss @tailwindcss/forms postcss autoprefixer
# shadcn/ui: installed via CLI, not npm directly
npx shadcn@latest init

# E2E testing
npm install -D @playwright/test
```

---

## Version Verification Checklist

All versions below are from training data (knowledge cutoff August 2025). MUST verify before pinning:

| Package | Verify Command | Critical? |
|---------|---------------|-----------|
| drizzle-orm | `npm view drizzle-orm version` | YES — active development |
| drizzle-kit | `npm view drizzle-kit version` | YES — must match drizzle-orm |
| bullmq | `npm view bullmq version` | YES — active development |
| next | `npm view next version` | YES — check App Router stability |
| @serwist/next | `npm view @serwist/next version` | YES — actively maintained |
| typescript | `npm view typescript version` | MEDIUM |
| vitest | `npm view vitest version` | MEDIUM |

---

## Sources

- Training data (knowledge cutoff August 2025) — LOW to MEDIUM confidence on exact versions
- Project context: `H:/AI/k21/.planning/PROJECT.md` and `H:/AI/k21/K21_PRD.md`
- Drizzle ORM documentation (known: https://orm.drizzle.team) — verify current docs
- BullMQ documentation (known: https://docs.bullmq.io) — verify current docs
- Serwist documentation (known: https://serwist.pages.dev) — verify current docs
- PgBouncer transaction mode limitations: well-documented community knowledge, HIGH confidence
- Shopee Open Platform: https://open.shopee.com — no Node.js SDK confirmed at training cutoff
- TikTok Shop Open API: https://partner.tiktokshop.com — no Node.js SDK confirmed at training cutoff
