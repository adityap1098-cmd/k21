import { eq, and, sum, desc, count, gte, lte, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { shifts, transactions, transactionPayments, shiftCashTransactions } from '../../db/schema/pos.js'
import type { Shift, ShiftCashTransaction } from '../../db/schema/pos.js'
import { users } from '../../db/schema/users.js'

export interface ShiftReconciliation {
  shiftId: string
  cashierId: string
  openedAt: Date
  closedAt: Date | null
  openingFloat: number
  totalSales: number
  salesByCash: number
  salesByTransfer: number
  salesByQris: number
  cashIn: number
  cashOut: number
  expectedCash: number
  actualCash: number
  discrepancy: number
}

// ─── openShift ─────────────────────────────────────────────────────────────

export async function openShift(params: {
  cashierId: string
  openingFloat: number
}): Promise<Shift> {
  const { cashierId, openingFloat } = params

  // Guard: one open shift per cashier
  const existing = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.cashierId, cashierId), eq(shifts.status, 'OPEN')))
    .limit(1)

  if (existing.length > 0) {
    throw new Error('SHIFT_ALREADY_OPEN')
  }

  const [newShift] = await db
    .insert(shifts)
    .values({
      cashierId,
      openingFloat,
      status: 'OPEN',
    })
    .returning()

  return newShift
}

// ─── closeShift ────────────────────────────────────────────────────────────

export async function closeShift(params: {
  shiftId: string
  cashierId: string
  closingCash: number
}): Promise<ShiftReconciliation> {
  const { shiftId, cashierId, closingCash } = params

  const updated = await db
    .update(shifts)
    .set({
      status: 'CLOSED',
      closingCash,
      closedAt: new Date(),
    })
    .where(
      and(
        eq(shifts.id, shiftId),
        eq(shifts.cashierId, cashierId),
        eq(shifts.status, 'OPEN')
      )
    )
    .returning()

  if (updated.length === 0) {
    throw new Error('SHIFT_NOT_FOUND')
  }

  const recon = await aggregateReconciliation(updated[0])

  // Auto-record selisih ke shift_cash_transactions supaya arus kas tetap terlacak
  if (recon.discrepancy !== 0) {
    const isShortage = recon.discrepancy < 0
    await db.insert(shiftCashTransactions).values({
      shiftId,
      type: isShortage ? 'OUT' : 'IN',
      amount: Math.abs(recon.discrepancy),
      description: isShortage
        ? `[PERINGATAN] Kas kurang Rp ${Math.abs(recon.discrepancy).toLocaleString('id-ID')} — kemungkinan pemakaian kas tidak tercatat. Harap diperiksa.`
        : `[PERINGATAN] Kas lebih Rp ${recon.discrepancy.toLocaleString('id-ID')} — kemungkinan pemasukan tidak tercatat atau kembalian kurang. Harap diperiksa.`,
      createdBy: cashierId,
    })
  }

  return recon
}

// ─── getActiveShift ────────────────────────────────────────────────────────

export async function getActiveShift(cashierId: string): Promise<Shift | null> {
  const rows = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.cashierId, cashierId), eq(shifts.status, 'OPEN')))
    .limit(1)

  return rows[0] ?? null
}

// ─── getShiftReconciliation ────────────────────────────────────────────────

export async function getShiftReconciliation(shiftId: string): Promise<ShiftReconciliation> {
  // Fetch the shift row
  const shiftRows = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1)

  if (shiftRows.length === 0) {
    throw new Error('SHIFT_NOT_FOUND')
  }

  return aggregateReconciliation(shiftRows[0])
}

// ─── addCashTransaction ───────────────────────────────────────────────────

export async function addCashTransaction(params: {
  shiftId: string
  type: 'IN' | 'OUT'
  amount: number
  description: string
  createdBy: string
}): Promise<ShiftCashTransaction> {
  // Verify shift is open
  const shiftRows = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, params.shiftId), eq(shifts.status, 'OPEN')))
    .limit(1)

  if (shiftRows.length === 0) {
    throw new Error('SHIFT_NOT_OPEN')
  }

  const [row] = await db
    .insert(shiftCashTransactions)
    .values({
      shiftId: params.shiftId,
      type: params.type,
      amount: params.amount,
      description: params.description,
      createdBy: params.createdBy,
    })
    .returning()

  return row
}

// ─── getCashTransactions ──────────────────────────────────────────────────

export async function getCashTransactions(shiftId: string): Promise<ShiftCashTransaction[]> {
  return db
    .select()
    .from(shiftCashTransactions)
    .where(eq(shiftCashTransactions.shiftId, shiftId))
    .orderBy(desc(shiftCashTransactions.createdAt))
}

// ─── listShifts ───────────────────────────────────────────────────────────

export interface ShiftListItem {
  id: string
  cashierId: string
  cashierName: string
  status: string
  openingFloat: number
  closingCash: number | null
  openedAt: Date
  closedAt: Date | null
  totalSales: number
  transactionCount: number
  discrepancy: number | null
}

export async function listShifts(params: {
  page: number
  limit: number
  status?: 'OPEN' | 'CLOSED'
  dateFrom?: string
  dateTo?: string
  cashierId?: string
}): Promise<{ items: ShiftListItem[]; total: number }> {
  const { page, limit, status, dateFrom, dateTo, cashierId } = params

  // Build conditions
  const conditions: any[] = []
  if (status) conditions.push(eq(shifts.status, status))
  if (cashierId) conditions.push(eq(shifts.cashierId, cashierId))
  if (dateFrom) conditions.push(gte(shifts.openedAt, new Date(dateFrom)))
  if (dateTo) {
    const endDate = new Date(dateTo)
    endDate.setDate(endDate.getDate() + 1) // include the full day
    conditions.push(lte(shifts.openedAt, endDate))
  }

  // Build WHERE fragments
  const whereFragments: any[] = []
  if (status) whereFragments.push(sql`s.status = ${status}`)
  if (cashierId) whereFragments.push(sql`s.cashier_id = ${cashierId}`)
  if (dateFrom) whereFragments.push(sql`s.opened_at >= ${new Date(dateFrom).toISOString()}`)
  if (dateTo) {
    const endDate = new Date(dateTo)
    endDate.setDate(endDate.getDate() + 1)
    whereFragments.push(sql`s.opened_at <= ${endDate.toISOString()}`)
  }

  const whereClause = whereFragments.length > 0
    ? sql`WHERE ${sql.join(whereFragments, sql` AND `)}`
    : sql``

  // Count total
  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS total FROM shifts s ${whereClause}
  `)
  const total = Number((countResult as unknown as any[])[0]?.total ?? 0)

  // Fetch shifts with cashier name + aggregated sales
  const rows = await db.execute(sql`
    SELECT
      s.id,
      s.cashier_id,
      COALESCE(u.name, u.email, 'Unknown') AS cashier_name,
      s.status,
      s.opening_float,
      s.closing_cash,
      s.opened_at,
      s.closed_at,
      COALESCE(agg.total_sales, 0) AS total_sales,
      COALESCE(agg.tx_count, 0) AS transaction_count
    FROM shifts s
    LEFT JOIN users u ON u.id = s.cashier_id
    LEFT JOIN LATERAL (
      SELECT
        SUM(tp.amount) AS total_sales,
        COUNT(DISTINCT t.id) AS tx_count
      FROM transactions t
      JOIN transaction_payments tp ON tp.transaction_id = t.id
      WHERE t.shift_id = s.id AND t.status = 'COMPLETED'
    ) agg ON true
    ${whereClause}
    ORDER BY s.opened_at DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `)

  // For each shift, compute discrepancy if closed
  const items: ShiftListItem[] = (rows as unknown as any[]).map(row => {
    const openingFloat = Number(row.opening_float ?? 0)
    const closingCash = row.closing_cash != null ? Number(row.closing_cash) : null

    return {
      id: row.id,
      cashierId: row.cashier_id,
      cashierName: row.cashier_name,
      status: row.status,
      openingFloat,
      closingCash,
      openedAt: row.opened_at,
      closedAt: row.closed_at ?? null,
      totalSales: Number(row.total_sales ?? 0),
      transactionCount: Number(row.transaction_count ?? 0),
      discrepancy: null, // will be calculated for closed shifts on detail view
    }
  })

  return { items, total }
}

// ─── getDailyCashReport ──────────────────────────────────────────────────

export interface DailyCashReport {
  date: string
  shifts: Array<{
    id: string
    cashierName: string
    openedAt: Date
    closedAt: Date | null
    openingFloat: number
    salesByCash: number
    salesByTransfer: number
    salesByQris: number
    cashIn: number
    cashOut: number
    closingCash: number | null
    expectedCash: number
    discrepancy: number
    transactionCount: number
  }>
  summary: {
    totalOpeningFloat: number
    totalSalesByCash: number
    totalSalesByTransfer: number
    totalSalesByQris: number
    totalSales: number
    totalCashIn: number
    totalCashOut: number
    totalExpectedCash: number
    totalActualCash: number
    totalDiscrepancy: number
    totalTransactions: number
  }
}

export async function getDailyCashReport(date: string): Promise<DailyCashReport> {
  const dayStart = new Date(date + 'T00:00:00+07:00')
  const dayEnd = new Date(date + 'T23:59:59+07:00')

  // Get all shifts that were opened on this date
  const dayShifts = await db
    .select()
    .from(shifts)
    .where(and(
      gte(shifts.openedAt, dayStart),
      lte(shifts.openedAt, dayEnd),
    ))
    .orderBy(shifts.openedAt)

  const shiftDetails = await Promise.all(dayShifts.map(async (shift) => {
    // Get cashier name
    const userRows = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, shift.cashierId))
      .limit(1)

    const cashierName = userRows[0]?.name || userRows[0]?.email?.split('@')[0] || 'Unknown'

    // Aggregate payment totals
    const paymentTotals = await db
      .select({
        method: transactionPayments.method,
        total: sum(transactionPayments.amount),
      })
      .from(transactionPayments)
      .innerJoin(transactions, eq(transactionPayments.transactionId, transactions.id))
      .where(and(
        eq(transactions.shiftId, shift.id),
        eq(transactions.status, 'COMPLETED'),
      ))
      .groupBy(transactionPayments.method)

    // Transaction count
    const txCountResult = await db
      .select({ cnt: count() })
      .from(transactions)
      .where(and(
        eq(transactions.shiftId, shift.id),
        eq(transactions.status, 'COMPLETED'),
      ))

    // Cash in/out
    const cashTxTotals = await db
      .select({
        type: shiftCashTransactions.type,
        total: sum(shiftCashTransactions.amount),
      })
      .from(shiftCashTransactions)
      .where(eq(shiftCashTransactions.shiftId, shift.id))
      .groupBy(shiftCashTransactions.type)

    let salesByCash = 0, salesByTransfer = 0, salesByQris = 0
    for (const row of paymentTotals) {
      const total = Number(row.total ?? 0)
      if (row.method === 'CASH') salesByCash = total
      else if (row.method === 'TRANSFER') salesByTransfer = total
      else if (row.method === 'QRIS') salesByQris = total
    }

    let cashIn = 0, cashOut = 0
    for (const row of cashTxTotals) {
      const total = Number(row.total ?? 0)
      if (row.type === 'IN') cashIn = total
      else if (row.type === 'OUT') cashOut = total
    }

    const expectedCash = shift.openingFloat + salesByCash + cashIn - cashOut
    const actualCash = shift.closingCash ?? 0
    const discrepancy = actualCash - expectedCash

    return {
      id: shift.id,
      cashierName,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt ?? null,
      openingFloat: shift.openingFloat,
      salesByCash,
      salesByTransfer,
      salesByQris,
      cashIn,
      cashOut,
      closingCash: shift.closingCash ?? null,
      expectedCash,
      discrepancy,
      transactionCount: Number(txCountResult[0]?.cnt ?? 0),
    }
  }))

  // Summary
  const summary = shiftDetails.reduce((acc, s) => ({
    totalOpeningFloat: acc.totalOpeningFloat + s.openingFloat,
    totalSalesByCash: acc.totalSalesByCash + s.salesByCash,
    totalSalesByTransfer: acc.totalSalesByTransfer + s.salesByTransfer,
    totalSalesByQris: acc.totalSalesByQris + s.salesByQris,
    totalSales: acc.totalSales + s.salesByCash + s.salesByTransfer + s.salesByQris,
    totalCashIn: acc.totalCashIn + s.cashIn,
    totalCashOut: acc.totalCashOut + s.cashOut,
    totalExpectedCash: acc.totalExpectedCash + s.expectedCash,
    totalActualCash: acc.totalActualCash + (s.closingCash ?? 0),
    totalDiscrepancy: acc.totalDiscrepancy + s.discrepancy,
    totalTransactions: acc.totalTransactions + s.transactionCount,
  }), {
    totalOpeningFloat: 0, totalSalesByCash: 0, totalSalesByTransfer: 0,
    totalSalesByQris: 0, totalSales: 0, totalCashIn: 0, totalCashOut: 0,
    totalExpectedCash: 0, totalActualCash: 0, totalDiscrepancy: 0, totalTransactions: 0,
  })

  return { date, shifts: shiftDetails, summary }
}

// ─── aggregateReconciliation (internal) ───────────────────────────────────

async function aggregateReconciliation(shift: Shift): Promise<ShiftReconciliation> {
  // Aggregate payment totals per method for COMPLETED transactions in this shift
  const paymentTotals = await db
    .select({
      method: transactionPayments.method,
      total: sum(transactionPayments.amount),
    })
    .from(transactionPayments)
    .innerJoin(transactions, eq(transactionPayments.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.shiftId, shift.id),
        eq(transactions.status, 'COMPLETED')
      )
    )
    .groupBy(transactionPayments.method)

  // Aggregate cash in/out transactions
  const cashTxTotals = await db
    .select({
      type: shiftCashTransactions.type,
      total: sum(shiftCashTransactions.amount),
    })
    .from(shiftCashTransactions)
    .where(eq(shiftCashTransactions.shiftId, shift.id))
    .groupBy(shiftCashTransactions.type)

  let salesByCash = 0
  let salesByTransfer = 0
  let salesByQris = 0

  for (const row of paymentTotals) {
    const total = Number(row.total ?? 0)
    if (row.method === 'CASH') salesByCash = total
    else if (row.method === 'TRANSFER') salesByTransfer = total
    else if (row.method === 'QRIS') salesByQris = total
  }

  let cashIn = 0
  let cashOut = 0
  for (const row of cashTxTotals) {
    const total = Number(row.total ?? 0)
    if (row.type === 'IN') cashIn = total
    else if (row.type === 'OUT') cashOut = total
  }

  const totalSales = salesByCash + salesByTransfer + salesByQris
  const openingFloat = shift.openingFloat
  const actualCash = shift.closingCash ?? 0
  // Expected = modal + penjualan tunai + pemasukan kas - pengeluaran kas
  const expectedCash = openingFloat + salesByCash + cashIn - cashOut
  const discrepancy = actualCash - expectedCash

  return {
    shiftId: shift.id,
    cashierId: shift.cashierId,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt ?? null,
    openingFloat,
    totalSales,
    salesByCash,
    salesByTransfer,
    salesByQris,
    cashIn,
    cashOut,
    expectedCash,
    actualCash,
    discrepancy,
  }
}
