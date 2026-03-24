---
estimated_steps: 5
estimated_files: 1
skills_used:
  - frontend-design
  - make-interfaces-feel-better
  - react-best-practices
---

# T01: Wire real orders and webhooks tabs, fix platform casing, add SKU-unresolved badge

**Slice:** S04 — Frontend Wiring
**Milestone:** M001

## Description

Replace the two stub tab panels in `apps/web/src/app/marketplace/page.tsx` with real data-fetching tables. The current file (~155 lines) has a working Channels tab but stub orders and webhooks panels. This task rewrites the file to:

1. Fix the platform casing bug in `PLATFORM_COLORS` (currently uses uppercase `'SHOPEE'`/`'TIKTOK'` but the live DB stores lowercase `'shopee'`/`'tiktok'` — D008)
2. Add state + fetch logic for orders and webhooks, auto-selecting the first channel
3. Replace the orders stub with a real table (order_sn, buyer, status badge, total, SKU-unresolved badge)
4. Replace the webhooks stub with a real table (event type, processing status, timestamp)
5. Handle loading spinners and empty states in both panels

All backend endpoints are live from S01/S03. No new files, no new dependencies, no backend changes.

## Steps

1. **Fix platform casing** — Change `PLATFORM_COLORS` keys from `'SHOPEE'`/`'TIKTOK'` to `'shopee'`/`'tiktok'`. Change `ch.platform === 'SHOPEE'` comparisons in channel card rendering to use lowercase. This makes channel cards show the correct brand/blue badge and correct icon background colors.

2. **Add order + webhook types and color maps** — Add `ChannelOrder` and `WebhookEvent` interfaces matching S03's corrected shapes:
   ```ts
   interface ChannelOrder {
     id: string; orderSn: string; platform: string; status: string
     buyerName: string | null; totalAmount: string | null
     skuResolutionStatus: string; createdAt: string
   }
   interface WebhookEvent {
     id: string; eventType: string; processingStatus: string
     errorMessage: string | null; processedAt: string | null; createdAt: string
   }
   ```
   Add status color/label maps:
   ```ts
   const ORDER_STATUS_COLORS: Record<string, 'neutral'|'blue'|'amber'|'green'|'red'> = {
     PENDING: 'neutral', CONFIRMED: 'blue', READY_TO_SHIP: 'amber',
     SHIPPED: 'green', DELIVERED: 'green', CANCELLED: 'red',
     RETURNED: 'amber', STOCK_CONFLICT: 'red',
   }
   const ORDER_STATUS_LABELS: Record<string, string> = {
     PENDING: 'Pending', CONFIRMED: 'Dikonfirmasi', READY_TO_SHIP: 'Siap Kirim',
     SHIPPED: 'Terkirim', DELIVERED: 'Diterima', CANCELLED: 'Dibatalkan',
     RETURNED: 'Dikembalikan', STOCK_CONFLICT: 'Stok Konflik',
   }
   const WEBHOOK_STATUS_COLORS: Record<string, 'neutral'|'green'|'red'|'amber'> = {
     PENDING: 'neutral', PROCESSED: 'green', FAILED: 'red', SKIPPED: 'amber',
   }
   ```

3. **Add orders + webhooks state and fetch logic** — Add state variables:
   ```ts
   const [orders, setOrders] = useState<ChannelOrder[]>([])
   const [ordersLoading, setOrdersLoading] = useState(false)
   const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([])
   const [webhooksLoading, setWebhooksLoading] = useState(false)
   ```
   Add fetch functions that use the first channel's id (`channels[0]?.id`):
   ```ts
   const loadOrders = useCallback(async (channelId: string) => {
     setOrdersLoading(true)
     const res = await apiGet<{ data: ChannelOrder[]; total: number }>(`/api/v1/marketplace/channels/${channelId}/orders`)
     if (res.success && res.data) setOrders(res.data.data)
     setOrdersLoading(false)
   }, [])
   const loadWebhooks = useCallback(async (channelId: string) => {
     setWebhooksLoading(true)
     const res = await apiGet<{ data: WebhookEvent[]; total: number }>(`/api/v1/marketplace/channels/${channelId}/webhooks`)
     if (res.success && res.data) setWebhookEvents(res.data.data)
     setWebhooksLoading(false)
   }, [])
   ```
   Add a `useEffect` that fires when `activeTab` changes and `channels` are loaded:
   ```ts
   useEffect(() => {
     const channelId = channels[0]?.id
     if (!channelId) return
     if (activeTab === 'orders') loadOrders(channelId)
     if (activeTab === 'webhooks') loadWebhooks(channelId)
   }, [activeTab, channels, loadOrders, loadWebhooks])
   ```

4. **Replace orders stub** — Replace the static `<Card>` placeholder with a real table. Add `AlertTriangle` to lucide imports. Structure:
   - If `ordersLoading`: show spinner
   - If `orders.length === 0`: show empty state (`<Globe>` icon + "Belum ada order" text)
   - Otherwise: `<Card>` with a `<table>` listing columns: Order SN, Pembeli, Status, Unresolved SKU flag, Total, Waktu
   - Status column: `<Badge color={ORDER_STATUS_COLORS[o.status] || 'neutral'}>{ORDER_STATUS_LABELS[o.status] || o.status}</Badge>`
   - SKU flag column: when `o.skuResolutionStatus !== 'RESOLVED'`, show `<Badge color="amber"><AlertTriangle size={11} className="inline mr-1" />SKU</Badge>`
   - Total column: `Rp ${Number(o.totalAmount || 0).toLocaleString('id-ID')}`
   - Date column: `new Date(o.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })`

5. **Replace webhooks stub** — Replace the static `<Card>` placeholder with a real table. Structure:
   - If `webhooksLoading`: show spinner
   - If `webhookEvents.length === 0`: show empty state
   - Otherwise: `<Card>` with a `<table>` listing columns: Event Type, Status, Error, Waktu
   - Status column: `<Badge color={WEBHOOK_STATUS_COLORS[e.processingStatus] || 'neutral'}>{e.processingStatus}</Badge>`
   - Error column: show truncated `errorMessage` when present, dash otherwise
   - Date: format `createdAt` with same locale pattern as orders

## Must-Haves

- [ ] `PLATFORM_COLORS` keys are lowercase (`'shopee'`, `'tiktok'`), not uppercase
- [ ] `ch.platform === 'SHOPEE'` comparisons in channel card updated to lowercase
- [ ] `ChannelOrder` and `WebhookEvent` interfaces added matching S03's corrected column names (`orderSn`, `skuResolutionStatus`, `processingStatus`)
- [ ] Orders fetch unwraps `res.data.data` (paginated envelope), not `res.data` directly
- [ ] Webhooks fetch unwraps `res.data.data` (paginated envelope), not `res.data` directly
- [ ] Orders tab shows `<Badge color="amber">` with `AlertTriangle` icon for `skuResolutionStatus !== 'RESOLVED'` (R012)
- [ ] Stub placeholder text "Order dari Shopee dan TikTok Shop akan muncul" is removed
- [ ] `AlertTriangle` imported from lucide-react
- [ ] `pnpm typecheck` in `apps/web` exits 0

## Verification

```bash
cd apps/web && npx tsc --noEmit
```
```bash
grep -v "Order dari Shopee dan TikTok Shop akan muncul" apps/web/src/app/marketplace/page.tsx | wc -l
# Should equal the total line count — i.e. the string is gone
```
```bash
grep "'shopee'" apps/web/src/app/marketplace/page.tsx
# Must match — confirms lowercase casing fix
```

## Inputs

- `apps/web/src/app/marketplace/page.tsx` — existing file with working Channels tab and two stub panels to replace
- `apps/api/src/modules/marketplace/index.ts` — exported types (`ChannelOrder`, `WebhookEvent`) for interface reference
- `apps/api/src/modules/marketplace/marketplace.service.ts` — S03-corrected field names (`orderSn`, `skuResolutionStatus`, `processingStatus`) to match in frontend interfaces

## Expected Output

- `apps/web/src/app/marketplace/page.tsx` — fully wired marketplace page with real orders table, real webhooks table, fixed platform casing, and unresolved-SKU badge; no stub placeholder text remains

## Observability Impact

**Signals that change after this task:**
- `/marketplace` → Orders tab: shows rows from `GET /api/v1/marketplace/channels/:id/orders` including amber "⚠ SKU" badge for `skuResolutionStatus !== 'RESOLVED'` orders
- `/marketplace` → Webhooks tab: shows rows from `GET /api/v1/marketplace/channels/:id/webhooks` with colored processing-status badges (green=PROCESSED, red=FAILED, amber=SKIPPED)
- `/marketplace` → Channels tab: platform badge now correctly colored (brand=shopee, blue=tiktok) because `PLATFORM_COLORS` keys match DB casing

**How a future agent inspects this:**
- Open browser DevTools → Network tab → navigate to Orders tab → observe `GET /api/v1/marketplace/channels/<uuid>/orders` request
- Check `res.success` and `res.data.data` array in the response to confirm envelope unwrapping
- Confirm amber badge count matches orders where `skuResolutionStatus` is `UNRESOLVED` or `PARTIAL`

**Failure state visibility:**
- API error: empty state card renders instead of table — no JS error thrown, but the table will simply be absent
- Type errors: TypeScript compile check (`npx tsc --noEmit` in `apps/web`) catches shape mismatches at build time
