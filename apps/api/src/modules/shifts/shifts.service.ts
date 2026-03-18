import { eq, and, sum } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { shifts, transactions, transactionPayments } from '../../db/schema/pos.js'
import type { Shift } from '../../db/schema/pos.js'

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

  // Pass the already-retrieved shift to avoid a redundant SELECT
  return aggregateReconciliation(updated[0])
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

  let salesByCash = 0
  let salesByTransfer = 0
  let salesByQris = 0

  for (const row of paymentTotals) {
    const total = Number(row.total ?? 0)
    if (row.method === 'CASH') salesByCash = total
    else if (row.method === 'TRANSFER') salesByTransfer = total
    else if (row.method === 'QRIS') salesByQris = total
  }

  const totalSales = salesByCash + salesByTransfer + salesByQris
  const openingFloat = shift.openingFloat
  const actualCash = shift.closingCash ?? 0
  const expectedCash = openingFloat + salesByCash
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
    expectedCash,
    actualCash,
    discrepancy,
  }
}
