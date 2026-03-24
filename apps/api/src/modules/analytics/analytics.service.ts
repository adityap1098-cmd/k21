import { eq, and, gte, lte, sql, desc, sum, count } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { transactions, transactionItems, transactionPayments, shiftCashTransactions } from '../../db/schema/pos.js'
import { products, productVariants } from '../../db/schema/products.js'
import { serviceOrders, servicePayments, serviceOrderItems } from '../../db/schema/bengkel.js'

// ─── Raw SQL row types (for db.execute results) ────────────────────────────

interface MarginRow {
  revenue: string | number
  cost: string | number
}

interface RawTransactionRow {
  id: string
  clientUuid: string
  total: string | number
  createdAt: string | Date
  itemCount: string | number
  primaryMethod: string | null
  source: string
}

interface RawTopProductRow {
  variantId: string
  name: string | null
  sku: string | null
  totalQty: string | number
  totalRevenue: string | number
}

interface RawDailyRow {
  day: string | Date
  pos_revenue?: string | number
  svc_revenue?: string | number
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DashboardKpi {
  revenueToday: number
  revenueThisWeek: number
  revenueThisMonth: number
  serviceRevenueToday: number
  serviceRevenueThisWeek: number
  serviceRevenueThisMonth: number
  cashInToday: number
  cashOutToday: number
  cashInThisMonth: number
  cashOutThisMonth: number
  margin: number
  criticalStockItems: Array<{
    variantId: string
    name: string
    sku: string
    stockQty: number
    lowStockThreshold: number
  }>
}

export interface RecentTransaction {
  id: string
  clientUuid: string
  total: number
  itemCount: number
  primaryMethod: string
  createdAt: Date
  source: 'pos' | 'service'
}

export interface TopProduct {
  variantId: string
  name: string
  sku: string
  totalQty: number
  totalRevenue: number
}

export interface DailyRevenue {
  date: string
  pos: number
  service: number
  cashOut: number
}

// ─── getDashboardKpi ────────────────────────────────────────────────────────

export async function getDashboardKpi(): Promise<DashboardKpi> {
  const now = new Date()

  // Start of today (midnight local time, adjusted to UTC)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Start of this week (Monday)
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)

  // Start of this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // ── POS Retail Revenue (COMPLETED transactions) ──
  const [todayRow] = await db
    .select({ total: sum(transactions.total) })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, 'COMPLETED'),
        gte(transactions.createdAt, startOfToday)
      )
    )

  const [weekRow] = await db
    .select({ total: sum(transactions.total) })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, 'COMPLETED'),
        gte(transactions.createdAt, startOfWeek)
      )
    )

  const [monthRow] = await db
    .select({ total: sum(transactions.total) })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, 'COMPLETED'),
        gte(transactions.createdAt, startOfMonth)
      )
    )

  // ── Service Revenue (from service_payments table) ──
  const [svcTodayRow] = await db
    .select({ total: sum(servicePayments.amount) })
    .from(servicePayments)
    .where(gte(servicePayments.paidAt, startOfToday))

  const [svcWeekRow] = await db
    .select({ total: sum(servicePayments.amount) })
    .from(servicePayments)
    .where(gte(servicePayments.paidAt, startOfWeek))

  const [svcMonthRow] = await db
    .select({ total: sum(servicePayments.amount) })
    .from(servicePayments)
    .where(gte(servicePayments.paidAt, startOfMonth))

  // Margin calculation: (revenue - cost) / revenue — POS only (service has no cost tracking yet)
  const marginRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(ti.line_total), 0) AS revenue,
      COALESCE(SUM(ti.qty * CAST(pv.cost_price AS integer)), 0) AS cost
    FROM transaction_items ti
    INNER JOIN transactions t ON ti.transaction_id = t.id
    LEFT JOIN product_variants pv ON ti.variant_id = pv.id
    WHERE t.status = 'COMPLETED'
      AND t.created_at >= ${startOfMonth.toISOString()}
  `)

  const marginData = (marginRows as unknown as MarginRow[])[0]
  const revenue = Number(marginData?.revenue ?? 0)
  const cost = Number(marginData?.cost ?? 0)
  const margin = revenue > 0 ? (revenue - cost) / revenue : 0

  // ── Cash In/Out from shift_cash_transactions ──
  const cashTxRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'IN'  AND created_at >= ${startOfToday.toISOString()} THEN amount ELSE 0 END), 0) AS cash_in_today,
      COALESCE(SUM(CASE WHEN type = 'OUT' AND created_at >= ${startOfToday.toISOString()} THEN amount ELSE 0 END), 0) AS cash_out_today,
      COALESCE(SUM(CASE WHEN type = 'IN'  AND created_at >= ${startOfMonth.toISOString()} THEN amount ELSE 0 END), 0) AS cash_in_month,
      COALESCE(SUM(CASE WHEN type = 'OUT' AND created_at >= ${startOfMonth.toISOString()} THEN amount ELSE 0 END), 0) AS cash_out_month
    FROM shift_cash_transactions
    WHERE created_at >= ${startOfMonth.toISOString()}
  `)

  const cashTxData = (cashTxRows as unknown as Array<{
    cash_in_today: string | number
    cash_out_today: string | number
    cash_in_month: string | number
    cash_out_month: string | number
  }>)[0]

  // Critical stock items — where stockQty <= lowStockThreshold
  const criticalStockItems = await db
    .select({
      variantId: productVariants.id,
      name: products.name,
      sku: productVariants.sku,
      stockQty: productVariants.stockQty,
      lowStockThreshold: productVariants.lowStockThreshold,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.isActive, true),
        sql`${productVariants.lowStockThreshold} IS NOT NULL AND ${productVariants.stockQty} <= ${productVariants.lowStockThreshold}`
      )
    )
    .orderBy(productVariants.stockQty)
    .limit(20)

  return {
    revenueToday: Number(todayRow?.total ?? 0),
    revenueThisWeek: Number(weekRow?.total ?? 0),
    revenueThisMonth: Number(monthRow?.total ?? 0),
    serviceRevenueToday: Number(svcTodayRow?.total ?? 0),
    serviceRevenueThisWeek: Number(svcWeekRow?.total ?? 0),
    serviceRevenueThisMonth: Number(svcMonthRow?.total ?? 0),
    cashInToday: Number(cashTxData?.cash_in_today ?? 0),
    cashOutToday: Number(cashTxData?.cash_out_today ?? 0),
    cashInThisMonth: Number(cashTxData?.cash_in_month ?? 0),
    cashOutThisMonth: Number(cashTxData?.cash_out_month ?? 0),
    margin,
    criticalStockItems: criticalStockItems.map(item => ({
      variantId: item.variantId,
      name: item.name,
      sku: item.sku,
      stockQty: item.stockQty,
      lowStockThreshold: item.lowStockThreshold ?? 0,
    })),
  }
}

// ─── getRecentTransactions ──────────────────────────────────────────────────

export async function getRecentTransactions(limit = 10): Promise<RecentTransaction[]> {
  // Get recent POS transactions
  const posRows = await db.execute(sql`
    SELECT
      t.id,
      t.client_uuid AS "clientUuid",
      t.total,
      t.created_at AS "createdAt",
      (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id) AS "itemCount",
      (
        SELECT tp.method
        FROM transaction_payments tp
        WHERE tp.transaction_id = t.id
        ORDER BY tp.amount DESC
        LIMIT 1
      ) AS "primaryMethod",
      'pos' AS source
    FROM transactions t
    WHERE t.status = 'COMPLETED'
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `)

  // Get recent service payments (grouped by order for a single entry per payment)
  const svcRows = await db.execute(sql`
    SELECT
      sp.id,
      so.order_number AS "clientUuid",
      sp.amount AS total,
      sp.paid_at AS "createdAt",
      (SELECT COUNT(*) FROM service_order_items soi WHERE soi.service_order_id = so.id) AS "itemCount",
      sp.method AS "primaryMethod",
      'service' AS source
    FROM service_payments sp
    INNER JOIN service_orders so ON sp.service_order_id = so.id
    ORDER BY sp.paid_at DESC
    LIMIT ${limit}
  `)

  // Merge and sort by date DESC, take top N
  const all = [
    ...(posRows as unknown as RawTransactionRow[]).map(row => ({
      id: row.id,
      clientUuid: row.clientUuid,
      total: Number(row.total),
      itemCount: Number(row.itemCount),
      primaryMethod: row.primaryMethod ?? 'CASH',
      createdAt: new Date(row.createdAt),
      source: 'pos' as const,
    })),
    ...(svcRows as unknown as RawTransactionRow[]).map(row => ({
      id: row.id,
      clientUuid: row.clientUuid,
      total: Number(row.total),
      itemCount: Number(row.itemCount),
      primaryMethod: row.primaryMethod ?? 'CASH',
      createdAt: new Date(row.createdAt),
      source: 'service' as const,
    })),
  ]

  all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return all.slice(0, limit)
}

// ─── getTopProducts ─────────────────────────────────────────────────────────

export async function getTopProducts(days = 30, limit = 10): Promise<TopProduct[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const rows = await db.execute(sql`
    SELECT
      ti.variant_id AS "variantId",
      p.name,
      pv.sku,
      SUM(ti.qty) AS "totalQty",
      SUM(ti.line_total) AS "totalRevenue"
    FROM transaction_items ti
    INNER JOIN transactions t ON ti.transaction_id = t.id
    LEFT JOIN product_variants pv ON ti.variant_id = pv.id
    LEFT JOIN products p ON pv.product_id = p.id
    WHERE t.status = 'COMPLETED'
      AND t.created_at >= ${since.toISOString()}
    GROUP BY ti.variant_id, p.name, pv.sku
    ORDER BY SUM(ti.qty) DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as RawTopProductRow[]).map(row => ({
    variantId: row.variantId,
    name: row.name ?? 'Unknown',
    sku: row.sku ?? '-',
    totalQty: Number(row.totalQty),
    totalRevenue: Number(row.totalRevenue),
  }))
}

// ─── getRevenueChart ────────────────────────────────────────────────────────

export async function getRevenueChart(days = 7): Promise<DailyRevenue[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  // POS revenue per day
  const posRows = await db.execute(sql`
    SELECT
      DATE(t.created_at AT TIME ZONE 'Asia/Jakarta') AS day,
      COALESCE(SUM(t.total), 0) AS pos_revenue
    FROM transactions t
    WHERE t.status = 'COMPLETED'
      AND t.created_at >= ${since.toISOString()}
    GROUP BY DATE(t.created_at AT TIME ZONE 'Asia/Jakarta')
    ORDER BY day ASC
  `)

  // Service revenue per day
  const svcRows = await db.execute(sql`
    SELECT
      DATE(sp.paid_at AT TIME ZONE 'Asia/Jakarta') AS day,
      COALESCE(SUM(sp.amount), 0) AS svc_revenue
    FROM service_payments sp
    WHERE sp.paid_at >= ${since.toISOString()}
    GROUP BY DATE(sp.paid_at AT TIME ZONE 'Asia/Jakarta')
    ORDER BY day ASC
  `)

  // Cash out per day
  const cashOutRows = await db.execute(sql`
    SELECT
      DATE(ct.created_at AT TIME ZONE 'Asia/Jakarta') AS day,
      COALESCE(SUM(ct.amount), 0) AS cash_out
    FROM shift_cash_transactions ct
    WHERE ct.type = 'OUT'
      AND ct.created_at >= ${since.toISOString()}
    GROUP BY DATE(ct.created_at AT TIME ZONE 'Asia/Jakarta')
    ORDER BY day ASC
  `)

  // Build maps
  const posMap = new Map<string, number>()
  for (const row of posRows as unknown as RawDailyRow[]) {
    const dateStr = new Date(row.day).toISOString().slice(0, 10)
    posMap.set(dateStr, Number(row.pos_revenue ?? 0))
  }

  const svcMap = new Map<string, number>()
  for (const row of svcRows as unknown as RawDailyRow[]) {
    const dateStr = new Date(row.day).toISOString().slice(0, 10)
    svcMap.set(dateStr, Number(row.svc_revenue ?? 0))
  }

  const cashOutMap = new Map<string, number>()
  for (const row of cashOutRows as unknown as RawDailyRow[]) {
    const dateStr = new Date(row.day).toISOString().slice(0, 10)
    cashOutMap.set(dateStr, Number((row as any).cash_out ?? 0))
  }

  // Fill in all days in the range
  const result: DailyRevenue[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const dayLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    result.push({
      date: dayLabel,
      pos: posMap.get(key) ?? 0,
      service: svcMap.get(key) ?? 0,
      cashOut: cashOutMap.get(key) ?? 0,
    })
  }

  return result
}
