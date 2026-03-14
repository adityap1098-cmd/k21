# Domain Pitfalls

**Domain:** Retail ERP — POS, Inventory, Marketplace Integration, Double-Entry Accounting, Single-VPS Monolith
**Project:** K21 Retail ERP
**Researched:** 2026-03-14
**Confidence:** MEDIUM — based on domain expertise; external sources unavailable during this session. Flag for validation before Phase 3, 6, 7.

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental system unreliability.

---

### Pitfall C1: POS Offline Sync — Duplicate Transaction on Reconnect

**What goes wrong:**
The POS device goes offline, records a sale to IndexedDB, the user closes the browser tab or the service worker restarts, and then on reconnect the sync logic replays the same transaction twice — creating duplicate `inventory_movement` and `journal_entry` records and double-decrementing stock.

**Why it happens:**
The sync queue in IndexedDB is consumed optimistically: the item is removed from the queue only after the server responds 200. If the response is lost in transit (server processed it but the client never received the ACK), the client retries and the server has no deduplication guard.

**Consequences:**
- Stock count goes negative or is permanently wrong
- Accounting books have phantom revenue
- Audit trail shows two identical transactions with the same cashier/timestamp — very hard to reconcile

**Prevention:**
1. Generate a `client_uuid` (UUIDv4) for every offline transaction at creation time in IndexedDB. This becomes the idempotency key.
2. Server endpoint `POST /api/v1/pos/transactions` must be idempotent: `INSERT ... ON CONFLICT (client_uuid) DO NOTHING RETURNING id`. If conflict, return the existing record's ID with HTTP 200 — not 409.
3. Never remove from IndexedDB queue until server returns a success response that includes the server-side transaction ID. Store that server ID back in IndexedDB for display.
4. On the server, the idempotency key table should have a TTL index or cleanup job (keep 90 days).

**Detection (warning signs):**
- Two `inventory_movement` records with the same `reference_id` and timestamp within seconds
- Negative stock for an item that was never manually adjusted
- Journal entry line items doubled for a specific shift

**Phase:** Phase 3 (POS) — must be designed before any sync code is written, not retrofitted.

---

### Pitfall C2: POS Offline Sync — Stale Stock Snapshot Causes Oversell

**What goes wrong:**
The POS caches a product's current stock count in IndexedDB when it goes offline. The cashier sells 3 units of Product A while offline. Meanwhile, a marketplace order (Shopee) for 2 units of the same product is processed server-side. When the cashier reconnects and syncs, stock is decremented by 3 again — resulting in -2 stock (oversell).

**Why it happens:**
The offline POS has no knowledge of server-side stock changes that happened during disconnection. There is no conflict detection on the stock snapshot age.

**Consequences:**
- Oversell on marketplace and physical store for the same SKU
- Customer orders fulfilled when no physical stock exists
- Inventory discrepancy that is hard to trace to the offline period

**Prevention:**
1. During sync, the server must validate stock availability at the moment of applying each offline transaction, not at the moment the cashier recorded it.
2. Use a `stock_snapshot_at` timestamp in every offline transaction payload. Server logic: if `(now - stock_snapshot_at) > threshold` AND stock is insufficient, reject the sync with a specific error code so the cashier can decide to void or adjust.
3. The threshold should be configurable (default: 4 hours). If the POS has been offline longer than this, warn before accepting transactions.
4. Stock reservation (the `reserved_qty` column on inventory) must be decremented atomically during marketplace order events even when the POS is offline — the server is always authoritative.

**Detection (warning signs):**
- Stock goes negative after a sync event (not after a manual adjustment)
- Timestamps on `inventory_movement` records show gaps (offline period) followed by a batch of records all inserted at the same time (sync burst)

**Phase:** Phase 3 (POS) — stock validation logic in sync handler; Phase 6 (Marketplace) — reservation atomicity.

---

### Pitfall C3: Inventory Race Condition — Oversell Under Concurrent Load

**What goes wrong:**
Two concurrent requests (e.g., a POS transaction and a marketplace order) both read `current_stock = 1`, both pass the "stock > 0" check, and both decrement — resulting in `current_stock = -1` and two fulfilled orders for one physical unit.

**Why it happens:**
A naive implementation reads stock from Redis cache, checks in application code, then writes. Between read and write there is no lock. This is a classic TOCTOU (Time of Check to Time of Use) race condition.

**Consequences:**
- Oversell: physical goods shipped that don't exist
- Accounting records and inventory records are inconsistent (two sales, one unit)
- Impossible to detect without a physical stock count

**Prevention:**
1. **Primary guard — PostgreSQL advisory lock or `SELECT ... FOR UPDATE`:** All stock-decrement operations must use a database-level lock per product_variant_id:
   ```sql
   BEGIN;
   SELECT current_stock FROM inventory WHERE product_variant_id = $1 FOR UPDATE;
   -- check stock >= qty_requested
   UPDATE inventory SET current_stock = current_stock - $qty, ...;
   INSERT INTO inventory_movements ...;
   COMMIT;
   ```
2. **Secondary guard — Redis atomic decrement:** Use `WATCH` + `MULTI/EXEC` (optimistic lock) or a Lua script for the Redis cache update. Never do read-then-write as separate Redis commands.
3. **Reservation pattern:** For marketplace orders, use `reserved_qty` to hold stock immediately on `order.created` webhook receipt. Physical decrement happens only on `order.shipped`. This separates the "availability check" from the "actual fulfillment" window.
4. **PgBouncer pool mode must be `transaction`** (already in the PRD): `session` mode would hold connections across the `FOR UPDATE` lock, causing connection exhaustion.

**Detection (warning signs):**
- `current_stock` column goes below 0 (add a DB check constraint: `current_stock >= -999` with alerting at 0)
- Two `inventory_movement` records of type SALE reference the same product_variant_id within milliseconds

**Phase:** Phase 2 (Inventory) — the atomic decrement pattern must be established here; Phase 3 (POS) and Phase 6 (Marketplace) inherit this pattern.

---

### Pitfall C4: Marketplace Webhook — Non-Idempotent Handler Causes Duplicate Processing

**What goes wrong:**
Shopee or TikTok Shop deliver a webhook (e.g., `order.created`) and the handler processes it — creating inventory reservation, importing the order. The platform then retries the same webhook (standard behavior for both platforms: they retry on non-200 responses, and sometimes even on 200 if their delivery confirmation is delayed). The second delivery processes the same order again: double reservation, duplicate order record.

**Why it happens:**
Both Shopee Open API and TikTok Shop webhook systems use at-least-once delivery semantics. They do not guarantee exactly-once. Any handler that is not idempotent will double-process on retries.

**Consequences:**
- Duplicate orders in the system with the same marketplace order ID
- Stock reserved twice for one order
- Accounting: double journal entry (double revenue recognized)
- Customer sees correct order on marketplace but ERP shows two orders

**Prevention:**
1. **Webhook deduplication table:** Before processing any webhook, insert `(platform, event_type, event_id)` into a `webhook_events` table with a UNIQUE constraint. Use `INSERT ... ON CONFLICT DO NOTHING` and check the affected row count. If 0 rows inserted, the event was already processed — return 200 immediately without processing.
2. **Return HTTP 200 as fast as possible:** Shopee and TikTok both time out webhook deliveries (typically 5 seconds). Push the actual processing to a BullMQ job immediately after deduplication check. If the handler does heavy DB work synchronously, it will time out and trigger a retry.
3. **BullMQ job deduplication:** Use `jobId: ${platform}-${event_id}` in BullMQ job options. BullMQ will not enqueue a duplicate job ID if one already exists in the queue or is being processed.
4. **Verify webhook signatures:** Both platforms provide HMAC-based webhook signature verification. Reject any request that fails signature check before doing any deduplication logic.

**Detection (warning signs):**
- Duplicate order records with the same `marketplace_order_id` value
- Two `inventory_movement` records of type SALE with identical `reference_id` (the marketplace order ID)
- BullMQ `completed` jobs count far exceeds the actual order volume

**Phase:** Phase 6 (Marketplace) — must be designed before webhook handler implementation.

---

### Pitfall C5: Double-Entry Accounting — Unbalanced Journal Entry Goes Undetected

**What goes wrong:**
A POS transaction creates a journal entry automatically. Due to a code bug (wrong account ID mapping, off-by-one on amount rounding, or a partial failure mid-transaction), the journal entry is committed with debits != credits. The accounting equation is broken but nothing catches it immediately. The P&L and Balance Sheet silently diverge.

**Why it happens:**
Auto-journal generation is "fire and forget" — the transaction is committed, the journal entry is created in a separate step (or worse, a separate service call), and there is no synchronous validation that debits == credits before the transaction commits. Rounding of fractional currency (e.g., IDR tax calculations) can also cause off-by-one differences.

**Consequences:**
- Balance Sheet does not balance (Assets != Liabilities + Equity)
- P&L shows incorrect profit
- Errors compound over time — very expensive to audit and correct retroactively
- In the worst case, a financial report is presented to the owner showing wrong numbers, leading to bad business decisions

**Prevention:**
1. **Enforce the accounting equation at the DB level:** Add a database trigger or application-layer assertion that verifies `SUM(debit_amount) == SUM(credit_amount)` for every `journal_entry_id` before the transaction commits. Reject any journal entry that doesn't balance with a hard error.
2. **Create journal entries atomically with the source transaction:** Wrap the POS transaction record, inventory_movement, and journal_entry_items all in a single PostgreSQL transaction. If journal creation fails, the sale is rolled back — the cashier sees an error and retries. Never create partial records.
3. **Rounding rule:** Always round to 0 decimal places (IDR has no subdivision). Apply `Math.round()` consistently. Write a utility function `toIDR(amount: number): number` used everywhere — never inline rounding.
4. **Nightly reconciliation job:** BullMQ scheduled job that queries `SELECT journal_entry_id, SUM(CASE WHEN type='debit' THEN amount ELSE -amount END) as balance FROM journal_entry_items GROUP BY journal_entry_id HAVING balance != 0` and fires an alert to the owner. This catches any bugs that slipped through.
5. **Chart of Accounts validation:** Maintain a strict chart of accounts. Auto-journal templates (POS sale → Debit Cash, Credit Revenue) should reference account IDs from a validated lookup table, not hardcoded strings. Changing an account name must never silently break a journal template.

**Detection (warning signs):**
- Balance Sheet total assets != total liabilities + equity (visible on any Balance Sheet report)
- Nightly reconciliation job fires an alert
- A `journal_entry_items` row has `account_id` pointing to a NULL or deleted account

**Phase:** Phase 7 (Finance) — accounting equation assertion must be implemented from the first journal entry; Phase 3 (POS) generates the first journal entries so the pattern must exist before Phase 3 completes.

---

### Pitfall C6: Docker Disk Exhaustion on Single VPS

**What goes wrong:**
The 80GB SSD on the VPS fills up completely. PostgreSQL crashes (cannot write WAL segments). Docker daemon becomes unresponsive. The entire system goes down.

**Why it happens (multiple vectors):**
1. **Docker container logs:** Without log rotation, Docker's json-file log driver accumulates indefinitely. A busy application logging at DEBUG level can generate gigabytes per day.
2. **Docker image accumulation:** Every CI/CD deploy pulls a new image tag but does not prune old ones. After 30 deploys, 20+ old image layers consume 10-20GB.
3. **PostgreSQL WAL archiving:** If `wal_level = replica` is accidentally enabled without a WAL consumer (no replica exists), WAL files accumulate in `pg_wal/` until the volume is full.
4. **BullMQ Redis key accumulation:** Failed jobs in BullMQ are kept in the `bull:queue:failed` set. With no `removeOnFail` limit, Redis can grow significantly over months.
5. **Local file storage:** Receipt PDFs, export files, and report files stored locally with no cleanup policy.

**Consequences:**
- Total system outage: PostgreSQL, Redis, and Node.js all fail simultaneously
- Recovery requires manual intervention (SSH into VPS, delete files) while the business is down
- Potential data corruption if PostgreSQL was mid-write when disk filled

**Prevention:**
1. **Docker log rotation (already in PRD, MUST be enforced):** Apply to ALL services including Nginx, PgBouncer, Netdata — not just the Node.js app. `max-size: "10m", max-file: "5"` per service = max 50MB per service.
2. **Docker image pruning in CI/CD:** Add `docker image prune -f` to the deploy script after a successful deployment. Also schedule `docker system prune -f --volumes` monthly (carefully — not on volumes with persistent data).
3. **Netdata disk alert at 75% and 90%:** Configure Netdata to alert (email/Telegram) when disk usage exceeds 75%. At 90% the system is already in danger. Act at 75%.
4. **BullMQ job retention limits:**
   ```typescript
   defaultJobOptions: {
     removeOnComplete: { count: 1000 },
     removeOnFail: { count: 500 },
   }
   ```
5. **PostgreSQL WAL:** Explicitly set `wal_level = minimal` in postgresql.conf unless replication is needed. Check `pg_wal/` size during first week of operation.
6. **Local file cleanup:** Any generated report or export file should be written with a TTL. A BullMQ scheduled job deletes files older than 7 days from the `/exports` directory.
7. **Backup file retention:** The GPG backup script (already in PRD) must delete files older than 7 days — confirm `find /backups -mtime +7 -delete` runs successfully on first deployment.

**Detection (warning signs):**
- Netdata disk usage graph trending upward over weeks
- `docker system df` shows large `RECLAIMABLE` values
- Redis `INFO memory` shows `used_memory_human` growing steadily
- PostgreSQL logs show `no space left on device`

**Phase:** Phase 0 (Infrastructure) — log rotation and Netdata disk alerts must be configured before any other service runs.

---

## Moderate Pitfalls

Mistakes that cause operational pain, data quality issues, or significant debugging time.

---

### Pitfall M1: Marketplace API Token Expiry Causes Silent Sync Failure

**What goes wrong:**
Shopee and TikTok Shop both use OAuth access tokens with expiry (Shopee: ~4 hours for access token; TikTok Shop: access tokens expire and refresh tokens also expire if unused). When the access token expires and the refresh flow fails (refresh token also expired or revoked), BullMQ jobs silently fail. No orders are imported, no stock is synced, but the system shows no obvious error to the business owner.

**Why it happens:**
Token refresh is implemented as an afterthought. The BullMQ job handler catches the 401 error, logs it, and retries — but without triggering a re-authorization flow, every retry fails. The job goes to the `failed` queue after max retries, and nobody monitors the BullMQ dashboard.

**Prevention:**
1. **Token refresh middleware:** Wrap every marketplace API call in a function that catches 401, attempts token refresh using the stored refresh token, updates the token in the DB, and retries the original request once.
2. **Refresh token expiry monitoring:** Store `refresh_token_expires_at` in the database. A BullMQ scheduled job runs daily: if `refresh_token_expires_at < now + 7 days`, send an alert to the owner to re-authorize via the settings UI.
3. **BullMQ failure alert:** Configure the `failed` event listener on every queue to send a notification when a job fails after all retries. Do not rely on passive dashboard monitoring.
4. **Dead letter tracking:** Jobs that permanently fail go to a `dead_letter_log` table with error message and stack trace — visible in the admin UI so the owner can see "Shopee sync failed 3 times today."

**Phase:** Phase 6 (Marketplace).

---

### Pitfall M2: Marketplace Inventory Sync Lag Causes Oversell on Platform

**What goes wrong:**
A POS sale reduces stock from 2 to 1. The inventory sync to Shopee is queued as a BullMQ job. The job runs 30 seconds later. In that 30-second window, a customer on Shopee purchases the last 2 units (Shopee still shows qty=2). The Shopee order is accepted. ERP now has stock = -1 after processing the marketplace order.

**Why it happens:**
Inventory sync to marketplace is eventual — it cannot be synchronous because marketplace API calls are slow and rate-limited. Any window between a local stock change and the marketplace update is a risk window.

**Prevention:**
1. **Prioritize sync jobs:** When a POS sale reduces stock to a low level (e.g., <= 3 units), enqueue the inventory sync job with `priority: 1` (high priority in BullMQ) so it runs before other jobs.
2. **Set marketplace safety buffer:** Sync `stock - safety_buffer` to marketplace. E.g., if ERP has 2 units, sync 1 to Shopee and 1 to TikTok Shop. The buffer absorbs sync lag. Make the buffer configurable per product category.
3. **Emergency zero-out:** When ERP stock hits 0, immediately enqueue a high-priority job to set marketplace listings to 0. This is the most critical sync — treat it differently from routine syncs.
4. **Rate limit awareness:** Shopee Open API has per-shop rate limits (commonly cited as 1000 calls/10 minutes for item update endpoints). Do not bulk-sync all products simultaneously — use a throttled BullMQ queue with `limiter: { max: 10, duration: 1000 }`.

**Phase:** Phase 6 (Marketplace).

---

### Pitfall M3: PgBouncer Transaction Mode Breaks Advisory Locks and Prepared Statements

**What goes wrong:**
PgBouncer in `transaction` pooling mode (specified in the PRD) does not support PostgreSQL session-level features: `pg_advisory_lock()`, `LISTEN/NOTIFY`, `SET LOCAL`, and named prepared statements do not work reliably because a new connection may be assigned for each transaction.

**Why it happens:**
Developers use `pg_advisory_lock(product_id)` as an application-level lock thinking it persists for the duration of their operation, but with PgBouncer transaction mode, the advisory lock is released when the connection is returned to the pool between transactions.

**Prevention:**
1. **Do not use session-level advisory locks.** Use `SELECT ... FOR UPDATE` within a single transaction instead (this works correctly with PgBouncer transaction mode).
2. **Do not use `LISTEN/NOTIFY` through PgBouncer.** If real-time notifications are needed, use a dedicated direct connection to PostgreSQL (bypassing PgBouncer) for the LISTEN connection only — or use Redis Pub/Sub instead (already available).
3. **Disable prepared statements in Drizzle ORM:** Set `prepare: false` in the Drizzle connection config when using PgBouncer transaction mode. Named prepared statements require session affinity.
4. **Document this constraint** in the codebase (a comment in the DB connection module) so future developers don't accidentally introduce session-dependent patterns.

**Phase:** Phase 0 (Infrastructure) setup and Phase 1 (Auth) — establish the DB connection pattern before any domain code is written.

---

### Pitfall M4: BullMQ Redis Memory Growth From Completed Job Data

**What goes wrong:**
BullMQ stores the full job data (input + output + logs) in Redis for every completed and failed job. For high-volume operations (marketplace sync jobs running every 5 minutes, or analytics jobs with large JSON payloads), Redis memory grows until it triggers OOM or Redis evicts data using the eviction policy — potentially evicting active queue data instead of old job history.

**Why it happens:**
Default BullMQ behavior keeps all completed and failed jobs indefinitely unless `removeOnComplete` and `removeOnFail` are configured.

**Prevention:**
1. Set retention on all queues at queue definition time: `removeOnComplete: { count: 500, age: 86400 }` (keep max 500 or 1 day, whichever is smaller), `removeOnFail: { count: 200, age: 604800 }` (keep 7 days of failures for debugging).
2. Set Redis `maxmemory` in the Redis Docker container config (e.g., `--maxmemory 512mb`). Set `maxmemory-policy: noeviction` — this makes Redis return errors instead of silently evicting data, which forces the problem to surface immediately rather than silently corrupting queue state.
3. Do not store large data payloads in job data. Store a reference ID instead (e.g., `orderId: "uuid"`) and fetch the actual data from PostgreSQL in the job handler.

**Phase:** Phase 6 (Marketplace) — when BullMQ is first used heavily.

---

### Pitfall M5: Let's Encrypt SSL Certificate Auto-Renewal Failure

**What goes wrong:**
The Let's Encrypt certificate expires (90-day validity) and Certbot's auto-renewal fails silently. Nginx starts returning SSL errors. The POS, admin dashboard, and all APIs become inaccessible with a browser security warning. The business stops.

**Why it happens:**
Certbot auto-renewal depends on the `certbot renew` cron job running, the domain being reachable on port 80 (HTTP challenge), and Nginx reloading after renewal. If any of these break (firewall rule change, domain DNS issue, Nginx not configured to reload after renewal), renewal fails.

**Prevention:**
1. Configure `--deploy-hook "nginx -s reload"` in the Certbot renewal configuration so Nginx automatically reloads when renewal succeeds.
2. UptimeRobot monitors the HTTPS endpoint — it will alert on certificate errors, giving advance warning before the domain goes fully down.
3. Add a cron job that runs `certbot certificates` and alerts if any certificate expires within 20 days.
4. Test the renewal process manually before go-live: `certbot renew --dry-run`.

**Phase:** Phase 0 (Infrastructure).

---

### Pitfall M6: Offline POS — IndexedDB Quota and Browser Storage Eviction

**What goes wrong:**
The browser evicts IndexedDB data under storage pressure (private browsing mode, low-device storage, browser settings that clear site data). Unsynced offline transactions are permanently lost.

**Why it happens:**
IndexedDB is not guaranteed-persistent storage. Browsers can evict it without user warning. In private/incognito mode, IndexedDB is cleared when the tab closes. On low-storage devices, browsers may evict "best effort" storage without notice.

**Prevention:**
1. **Request persistent storage:** Call `navigator.storage.persist()` during POS app initialization. If granted, the browser will not evict data without explicit user action. Show a warning if the user denies this permission.
2. **Sync immediately on network recovery:** Use the Service Worker `sync` event (Background Sync API) to trigger sync as soon as connectivity is restored — do not wait for the user to manually open the POS app.
3. **Display unsync count prominently:** Show a badge/banner in the POS UI: "3 transactions pending sync." This creates urgency so staff connect as soon as possible.
4. **Limit offline transaction count:** If IndexedDB has more than N unsynced transactions (e.g., 50), show a warning and require the cashier to seek connectivity before continuing. This bounds the maximum data loss risk.
5. **Session mode warning:** Block login in private/incognito mode or show a prominent warning that offline mode will not work.

**Phase:** Phase 3 (POS).

---

## Minor Pitfalls

Issues that are annoying or inefficient but do not cause data loss or system failure.

---

### Pitfall m1: Shift Report Discrepancy Due to Timezone Mismatch

**What goes wrong:**
The server uses UTC timestamps. The POS client is in WIB (UTC+7). Shift "open/close" boundaries are calculated on the server using UTC, causing shift reports to include transactions from the wrong local day (e.g., a 23:00 WIB transaction appears in the next day's shift if the server uses midnight UTC).

**Prevention:**
Store all timestamps in UTC (correct). Apply timezone offset (`Asia/Jakarta`, WIB = UTC+7) at report-generation time, not at storage time. Always pass the user's timezone to report API endpoints. Use `date-fns-tz` or `dayjs` with timezone plugin for consistent timezone handling on both server and client.

**Phase:** Phase 3 (POS) — affects shift management; Phase 7 (Finance) — affects period-based financial reports.

---

### Pitfall m2: Marketplace Product Mapping — Mismatched SKU Breaks Sync

**What goes wrong:**
Products on Shopee/TikTok Shop have their own platform-specific IDs. If the ERP doesn't maintain a reliable mapping table (`marketplace_product_id` → internal `product_variant_id`), stock sync pushes to the wrong SKU or fails to find the product entirely.

**Prevention:**
Design the `marketplace_listings` table from the start with columns: `platform`, `platform_product_id`, `platform_sku_id`, `product_variant_id` (FK). This mapping is established during the initial product sync and maintained across all sync operations. Never assume product names match — always use platform IDs.

**Phase:** Phase 6 (Marketplace).

---

### Pitfall m3: Missing COGS Accounting for Marketplace Sales

**What goes wrong:**
Auto-journal for marketplace sales records `Debit Accounts Receivable / Credit Revenue` but does not record the cost of goods sold (COGS). The P&L shows gross revenue but not gross profit, making margin analysis meaningless until COGS journals are added later as a retrofit.

**Prevention:**
From the first journal template design in Phase 7, include COGS entries: `Debit COGS / Credit Inventory` for every sale (both POS and marketplace). This requires the `products` table to carry a `cost_price` field maintained by procurement.

**Phase:** Phase 7 (Finance) — design the journal template with COGS from day one.

---

### Pitfall m4: Docker Compose Health Checks Missing — Startup Race Condition

**What goes wrong:**
Docker Compose starts all services simultaneously. The Node.js API starts before PostgreSQL and Redis are ready. The API crashes on startup. Docker restarts it. If the restart policy is `always`, it loops until the DB is ready — but if the crash happens too fast too many times, Docker applies a backoff delay that makes the API unavailable for minutes.

**Prevention:**
Add `healthcheck` definitions to PostgreSQL and Redis services. Add `depends_on: { postgres: { condition: service_healthy }, redis: { condition: service_healthy } }` to the Node.js API service. Also implement startup retry logic in the application code for DB connections (connect with exponential backoff, do not crash on first failed attempt).

**Phase:** Phase 0 (Infrastructure).

---

### Pitfall m5: Unversioned API Breaking Marketplace Webhook Endpoint

**What goes wrong:**
The webhook endpoint URL is registered with Shopee/TikTok Shop developer console during integration setup. If the endpoint URL changes (e.g., during a refactor), re-registration requires going through the platform's review process, which can take days. During that window, webhook delivery fails and orders are not imported.

**Prevention:**
The webhook endpoint must be on a versioned, stable URL: `/api/v1/webhooks/shopee` and `/api/v1/webhooks/tiktok`. The PRD already mandates `/api/v1/` versioning — apply it consistently to webhook routes. Treat these URLs as a public API contract that cannot change without a migration plan.

**Phase:** Phase 6 (Marketplace).

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|--------|---------------|------------|
| Phase 0 | Docker setup | Disk exhaustion from log accumulation | Log rotation on ALL services, not just app |
| Phase 0 | Docker startup | Race condition: API starts before DB ready | Health checks + `depends_on: condition: service_healthy` |
| Phase 0 | SSL | Certbot renewal failure | Deploy hook for Nginx reload, monitor cert expiry |
| Phase 2 | Inventory | Race condition on concurrent stock writes | `SELECT ... FOR UPDATE` pattern established here |
| Phase 3 | POS offline | Duplicate transactions on sync | Idempotency key (`client_uuid`) designed before sync logic |
| Phase 3 | POS offline | Oversell from stale stock snapshot | Server-side stock validation at sync time, not at offline-record time |
| Phase 3 | POS offline | IndexedDB eviction | `navigator.storage.persist()` + Background Sync API |
| Phase 3 | POS reporting | Timezone mismatch in shift reports | Apply WIB offset at report generation, not storage |
| Phase 6 | Marketplace | Non-idempotent webhook handler | Deduplication table + BullMQ jobId deduplication |
| Phase 6 | Marketplace | Token expiry silent failure | Token refresh middleware + expiry monitoring job |
| Phase 6 | Marketplace | Inventory sync lag causes oversell | Safety buffer + high-priority sync on low stock |
| Phase 6 | Marketplace | SKU mapping failure | `marketplace_listings` mapping table designed before first sync |
| Phase 7 | Accounting | Unbalanced journal entry | DB-level assertion: SUM(debits) = SUM(credits) before commit |
| Phase 7 | Accounting | Missing COGS entries | COGS journal template from day one, requires `cost_price` from Phase 5 |
| All | BullMQ | Redis memory growth | `removeOnComplete` + `removeOnFail` limits on all queues |

---

## Sources

**Confidence note:** External web sources (WebSearch, WebFetch) were unavailable during this research session. All findings are based on:
- Domain expertise in retail ERP systems, POS offline sync patterns, and double-entry accounting
- Knowledge of Shopee Open API and TikTok Shop API behavior from training data (cutoff August 2025)
- PostgreSQL concurrency documentation (well-established behavior)
- IndexedDB storage persistence specification (W3C)
- BullMQ documentation patterns (well-established)
- Docker log rotation behavior (well-established)

**Validation recommended before:**
- Phase 3: Verify Shopee/TikTok Shop webhook retry behavior against current platform docs
- Phase 6: Verify current API rate limits for Shopee Open API v2 and TikTok Shop API (these change frequently)
- Phase 7: Validate PPh 21 tax calculation rules against current Indonesian tax regulations (beyond this research scope)

**Confidence per area:**
| Area | Confidence | Reason |
|------|------------|--------|
| POS offline sync | MEDIUM-HIGH | Well-documented IndexedDB/sync patterns; specific to project constraints |
| Inventory concurrency | HIGH | PostgreSQL `FOR UPDATE` behavior is definitive |
| Marketplace webhooks | MEDIUM | Shopee/TikTok retry behavior is known but platform-specific limits need current verification |
| Double-entry integrity | HIGH | Accounting equation is mathematically invariant; DB pattern is standard |
| Docker/VPS operations | HIGH | Log rotation, disk management behavior is well-established |
