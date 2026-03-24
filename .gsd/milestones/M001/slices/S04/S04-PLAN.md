# S04: Frontend Wiring

**Goal:** The `/marketplace` page shows real channels, real orders, and real webhook events from the DB. No hardcoded stubs remain anywhere in the frontend. The unresolved-SKU flag is visually distinguishable (R012). The platform casing bug is fixed so channel cards render correctly.
**Demo:** Open `/marketplace`. Channels tab shows "Teladan27 Motor" with a properly colored platform badge. Orders tab loads from `/channels/{id}/orders` and shows an order table (or a clean empty state). Webhooks tab loads from `/channels/{id}/webhooks` and shows the event log with processing-status badges. The placeholder text "Order dari Shopee dan TikTok Shop akan muncul" is gone.

## Must-Haves

- Platform casing bug fixed — `PLATFORM_COLORS` keys and `ch.platform` comparisons use lowercase (`'shopee'`, `'tiktok'`) matching the live DB
- Orders tab replaced with a real table fetching from `GET /api/v1/marketplace/channels/:id/orders`
- Webhooks tab replaced with a real table fetching from `GET /api/v1/marketplace/channels/:id/webhooks`
- Paginated envelope unwrapped correctly (`res.data.data` for the inner array)
- Order rows show unresolved-SKU warning badge when `skuResolutionStatus` is `UNRESOLVED` or `PARTIAL` (R012)
- `pnpm typecheck` exits 0

## Verification

```bash
cd apps/web && npx tsc --noEmit
```
```bash
grep -q "PLATFORM_COLORS\['shopee'\]" apps/web/src/app/marketplace/page.tsx || grep -q "'shopee'" apps/web/src/app/marketplace/page.tsx
grep -qv "Order dari Shopee dan TikTok Shop akan muncul" apps/web/src/app/marketplace/page.tsx
```

Manual UAT (browser at `/marketplace`):
1. Channels tab: platform badge has correct color (brand for shopee), status badge shows "Disconnected"
2. Orders tab: renders table or clean empty state — no placeholder paragraph text
3. Webhooks tab: renders table or clean empty state — no placeholder paragraph text
4. No `res.data.data` type errors in browser console

## Tasks

- [x] **T01: Wire real orders and webhooks tabs, fix platform casing, add SKU-unresolved badge** `est:45m`
  - Why: All three stub replacements are in the same file and depend on the same channel selection state — doing them together in one pass avoids multiple partial-file edits
  - Files: `apps/web/src/app/marketplace/page.tsx`
  - Do: Fix `PLATFORM_COLORS` keys to lowercase; add `ChannelOrder`/`WebhookEvent` interfaces; add `ORDER_STATUS_COLORS`/labels maps; add orders + webhooks state and fetch functions triggered by tab change and channel auto-select; replace stub tab panels with real tables including SKU-unresolved badge; handle loading and empty states
  - Verify: `cd apps/web && npx tsc --noEmit` exits 0; stub placeholder text absent from file
  - Done when: TypeScript passes, both tab panels render real data (or clean empty states), platform casing bug is gone, unresolved-SKU badge renders on applicable orders

## Files Likely Touched

- `apps/web/src/app/marketplace/page.tsx`

## Observability / Diagnostics

**Runtime signals:**
- Browser console: `apiGet` failures surface as `res.success === false` with `res.error` string; no error is swallowed silently — empty state is shown instead of crashing
- Orders/webhooks tabs log nothing on success; on API failure the tab shows empty state (no visual error message yet — acceptable for MVP)
- `skuResolutionStatus !== 'RESOLVED'` rows emit a visible amber badge in the Orders table — the badge is the only signal that SKU mapping is incomplete

**Inspection surfaces:**
- Navigate to `/marketplace` → Orders tab → amber "⚠ SKU" badge appears per unresolved order row
- Navigate to `/marketplace` → Webhooks tab → `FAILED` status rows show red badge and truncated error message inline

**Failure visibility:**
- If `GET /api/v1/marketplace/channels/:id/orders` returns non-2xx: `setOrders` is never called, table stays empty; no crash
- If channels array is empty: `useEffect` for tab changes returns early — no fetch attempted

**Redaction:** No PII or secrets are logged; `buyerName` shown in UI only as display text (masked by Shopee anyway)
