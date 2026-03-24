# Phase 6: Marketplace Integration — Context

**Goal:** Orders from Shopee and TikTok Shop are automatically imported and inventory stays synchronised across all channels without manual intervention.

**Depends on:** Phase 2 (inventory + stock reservation ✅), Phase 3 (accounting stub with MARKETPLACE_SALE ✅)

## Scope

Connect K21 ERP to Shopee Open Platform v2 and TikTok Shop Open API so that:
1. Incoming marketplace orders create stock reservations automatically
2. Order lifecycle events (confirm → ship → complete / cancel) update inventory and create journal entries
3. Stock changes in K21 push to both marketplaces to prevent overselling
4. OAuth tokens are refreshed automatically before expiry
5. All webhook events are deduplicated and processed asynchronously via BullMQ

## Key Constraints

- **No official Node.js SDKs** — custom TypeScript HTTP clients for both platforms
- **Webhook handler must return 200 < 100ms** — thin handler, all logic in BullMQ workers
- **Token lifecycle:** Shopee access_token 4h / refresh 30d, TikTok access_token 24h / refresh 365d
- **HMAC-SHA256** signature verification on all webhooks
- **Package-level fulfillment** on TikTok (1 order → N packages) — data model must account for this
- **`journal_entries.transactionId`** currently references POS `transactions.id` — marketplace journal entries need this FK relaxed or a bridge record created

## Existing Code

- `apps/api/src/modules/marketplace/` — stub service returning hardcoded DISCONNECTED channels
- `apps/web/src/app/marketplace/page.tsx` — UI shell with tabs (channels, orders, webhooks)
- `marketplaceRouter` already wired to `/api/v1/marketplace`
- Accounting service already has `MARKETPLACE_SALE` in journal_source_type enum
- Inventory module has `reserveStock()`, `releaseReservation()`, `recordMovement()` ready

## Research

See `.planning/research/06-marketplace-spike.md` for full API spike results.

---
*Created: 2026-03-22*
