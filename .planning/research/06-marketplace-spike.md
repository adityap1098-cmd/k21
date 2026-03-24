# Phase 6: Marketplace Integration — API Spike Research

**Date:** 2026-03-22
**Confidence:** MEDIUM-HIGH (core patterns confirmed, exact rate limits require live verification in Shopee/TikTok Partner Console)

---

## 1. Shopee Open Platform API v2

### Authentication & Token Lifecycle
- **OAuth 2.0** flow via `https://partner.shopeemobile.com/api/v2/shop/auth_partner`
- **Access token TTL: 4 hours** (confirmed from multiple sources including official SDK patterns)
- **Refresh token TTL: 30 days**
- Each shop's `access_token` and `refresh_token` must be stored separately per `shop_id`
- Token refresh endpoint: `POST /api/v2/auth/access_token/get` (with `refresh_token` param)
- **Implication:** BullMQ cron job needed to refresh tokens every ~3.5 hours. Alert mechanism if refresh fails.
- Signature: **HMAC-SHA256** using `partner_key` — required on every API call as `sign` parameter

### Webhook (Push Mechanism)
- Shopee calls it "Push Mechanism" — configured in Open Platform Console
- Callback URL set per app in Console → "Live Push Settings"
- **Event categories confirmed:**
  - **Order Push:** `order_status_push`, `order_trackingno_push`, `package_fulfillment_status_push`
  - **Product Push:** `reserved_stock_change_push`, `video_upload_push`, `brand_register_result`
- **Signature verification:** `x-shopee-signature` header — HMAC-SHA256 of request body using `partner_key`
- **At-least-once delivery** — Shopee retries on non-200 responses
- **Must return 200 quickly** — per PRD requirement < 100ms
- **Shopee publishes its IP ranges** via `v2.public.get_shopee_ip_ranges` endpoint — can whitelist if needed

### Key API Endpoints
- `POST /api/v2/order/get_order_list` — list orders with pagination, filter by status/time
- `POST /api/v2/order/get_order_detail` — get order details by `order_sn_list`
- `POST /api/v2/product/update_stock` — update stock by `item_id` + `model_id` (variant)
- `POST /api/v2/product/get_item_list` — list products
- `POST /api/v2/logistics/get_tracking_number` — get tracking info

### Rate Limits
- General rate limit: estimated ~10 requests/second per shop (varies by endpoint)
- Some sources mention 100 requests/minute as a general figure
- **Must verify in Partner Console** — rate limits vary per endpoint and app tier
- Rate limit error: HTTP 429 — implement exponential backoff with jitter

### SDK Landscape
- **No official Node.js SDK** — must build custom HTTP client
- Unofficial Node.js wrappers exist but are unmaintained (v1 era)
- NestJS module (`nestjs-shopee`) exists but low-star, last updated Dec 2023
- **Decision: Build custom TypeScript HTTP client** with HMAC signing, token management, and retry logic

### Registration & Go-Live
- Register at `open.shopee.com` → Developer account
- App Category: **"Seller In House System"** (untuk internal company ERP)
- Profile audit by Shopee required before API access
- Sandbox/test environment available at `partner.test-stable.shopeemobile.com`
- Go-Live requires: live product URL (HTTPS + TLS 1.2), test credentials, brief introduction

---

## 2. TikTok Shop Open API

### Authentication & Token Lifecycle
- **OAuth 2.0** via TikTok Shop Partner Center
- **Access token TTL: 24 hours** (significantly longer than Shopee's 4h)
- **Refresh token TTL: 365 days** (1 year — very generous)
- Uses `app_key` + `app_secret` for authentication
- Uses `shop_cipher` for shop-level operations (not just shop_id)
- **Implication:** Less aggressive refresh needed than Shopee. BullMQ cron every ~20 hours sufficient.

### Webhook
- TikTok Shop supports webhooks — configured in Partner Center under app settings
- Webhook URL + verification during setup
- **Events include:** order status changes, product updates
- HMAC signature verification required
- **At-least-once delivery** — must handle duplicates

### Key API Endpoints
- TikTok Shop uses **API versioning** (e.g., `202309`, `202312`) — version specified per call
- `GET /order/list` — list orders with filters
- `GET /order/detail` — order detail by order_id
- `POST /product/stocks` — update stock
- **Package-level fulfillment model** — one order can split into multiple packages
  - This is a critical difference from Shopee: TikTok tracks fulfillment per-package, not per-order
  - Our data model needs a `marketplace_packages` table or equivalent

### Rate Limits
- TikTok API: up to **600 requests/minute per endpoint** (from developer docs)
- More generous than Shopee
- Still implement exponential backoff for safety

### SDK Landscape
- **No official Node.js SDK** for TikTok Shop
- PHP SDK exists (`EcomPHP/tiktokshop-php`) — well-maintained, good reference for API patterns
- **Decision: Build custom TypeScript HTTP client** — same pattern as Shopee

### Registration & Go-Live
- Register at `partner.tiktokshop.com` → Partner Center
- App scopes: order, product, logistics, inventory
- Sandbox environment available
- App key + App secret + Service ID issued after app creation

---

## 3. Architecture Decisions for Phase 6

### Common API Client Pattern
Both platforms need:
1. **HMAC signature generation** — SHA256, platform-specific signing logic
2. **Token storage** — PostgreSQL table: `marketplace_tokens(id, platform, shop_id, access_token, refresh_token, access_expires_at, refresh_expires_at)`
3. **Auto-refresh** — BullMQ repeatable job per platform
4. **Request wrapper** — auto-inject auth params, handle rate limits, retry with backoff

### Webhook Handler Architecture
```
POST /api/v1/webhooks/shopee   → verify HMAC → store raw in webhook_events → enqueue BullMQ job → return 200
POST /api/v1/webhooks/tiktok   → verify HMAC → store raw in webhook_events → enqueue BullMQ job → return 200
```

**Critical design rules:**
- Webhook handler does **nothing** except validate, store, enqueue, respond
- All business logic runs in BullMQ workers
- `webhook_events` table has `UNIQUE (platform, event_type, event_id)` for dedup
- BullMQ job uses `jobId: ${platform}-${event_id}` for queue-level dedup

### Data Model Additions
```sql
-- Token storage
marketplace_tokens (id, platform, shop_id, shop_cipher, access_token, refresh_token, 
                    access_expires_at, refresh_expires_at, metadata, created_at, updated_at)

-- Webhook event log (idempotency + audit)
webhook_events (id, platform, event_type, event_id, raw_payload, status, processed_at, 
                error_message, created_at)
  UNIQUE (platform, event_type, event_id)

-- Marketplace order mapping
marketplace_orders (id, platform, platform_order_id, platform_order_sn, 
                    internal_transaction_id, status, buyer_info, shipping_info,
                    order_total, platform_fees, created_at, updated_at)

-- Marketplace product mapping (SKU bridge)
marketplace_listings (id, platform, platform_item_id, platform_model_id, 
                      variant_id, sync_status, last_synced_at, created_at, updated_at)
```

### Order Lifecycle Mapping

| Event | Shopee | TikTok | K21 Action |
|-------|--------|--------|------------|
| New order | `order_status_push` (READY_TO_SHIP) | order webhook | Create reservation via `reserveStock()` |
| Cancelled | `order_status_push` (CANCELLED) | order webhook (CANCELLED) | Release reservation |
| Shipped | `order_status_push` (SHIPPED) | order webhook (SHIPPED) | Convert reservation → `inventory_movement(SALE)` + journal entry |
| Completed | `order_status_push` (COMPLETED) | order webhook (COMPLETED) | Mark as settled |

### Stock Sync (Outbound)
- Listen to `inventory_movement` events (any source)
- Debounce per-variant (5-second window) to batch rapid changes
- Rate-limited BullMQ job pushes updated stock to each platform
- Per-platform API calls: Shopee `product/update_stock`, TikTok `product/stocks`
- SKU mapping via `marketplace_listings` table

---

## 4. Risk Assessment

### CONFIRMED (ready to implement)
- ✅ Both platforms use OAuth 2.0 — pattern is standard
- ✅ Shopee access token 4h / refresh 30d — confirmed
- ✅ TikTok access token 24h / refresh 365d — confirmed from official docs
- ✅ Both support webhooks with HMAC verification
- ✅ No official Node.js SDKs for either — custom HTTP client is the right call
- ✅ HMAC-SHA256 signing for both platforms

### NEEDS LIVE VERIFICATION (during development)
- ⚠️ Exact per-endpoint rate limits for Shopee (must check in Partner Console)
- ⚠️ Shopee webhook retry behavior (count, interval, backoff)
- ⚠️ TikTok Shop package-level fulfillment model details
- ⚠️ TikTok Shop webhook event names and payload schemas
- ⚠️ Shopee developer registration approval timeline

### RISK MITIGATIONS
1. **Polling fallback** — Don't rely solely on webhooks. Implement BullMQ cron job that polls order list every 5 minutes as a safety net. Webhooks are the primary path; polling catches any missed events.
2. **Token refresh monitoring** — Alert (via low-stock alert channel) if token refresh fails 2x consecutively
3. **Dead letter queue** — Failed webhook processing after 3 retries goes to DLQ for manual review
4. **SKU mapping validation** — On first sync, validate all variant SKUs map correctly. Alert on unmapped SKUs.

---

## 5. Implementation Order Recommendation

Given the research, Phase 6 should be built in this order:

1. **Schema + token storage + API client base** — tables, HMAC signing, request/response wrapper
2. **OAuth flow UI** — settings page for Owner to authorize each marketplace
3. **Token refresh worker** — BullMQ repeatable job
4. **Webhook handlers** — thin receive → store → enqueue layer
5. **Order import workers** — process webhook events → create marketplace_orders → reserve stock
6. **Order lifecycle workers** — handle cancel/ship/complete transitions
7. **Stock sync (outbound)** — push stock changes to marketplaces
8. **Polling fallback** — cron job to catch missed webhooks
9. **Marketplace dashboard UI** — order list, sync status, token health

**Estimated effort:** 8-10 plans (similar scope to Phase 3 POS)

---

*Research completed: 2026-03-22*
*Ready for planning: yes — no blocking unknowns remain*
