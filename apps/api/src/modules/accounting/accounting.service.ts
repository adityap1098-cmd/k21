import { randomUUID } from 'crypto'
import { db } from '../../db/index.js'
import { journalEntries, journalSourceTypeEnum } from '../../db/schema/accounting.js'
import { transactions } from '../../db/schema/pos.js'
import { sql } from 'drizzle-orm'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type JournalSourceType = (typeof journalSourceTypeEnum.enumValues)[number]

/* ─── Types ─── */

export interface PnlLineItem {
  code: string
  name: string
  amount: number
}

export interface PnlReport {
  revenue: PnlLineItem[]
  expenses: PnlLineItem[]
  netIncome: number
}

export interface BalanceItem {
  code: string
  name: string
  balance: number
}

export interface BalanceReport {
  assets: BalanceItem[]
  liabilities: BalanceItem[]
  equity: BalanceItem[]
  totalAssets: number
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
}

export interface CashFlowItem {
  sourceType: string
  netFlow: number
}

export interface CashFlowReport {
  operating: CashFlowItem[]
  totalNetFlow: number
}

/**
 * Inserts a journal entry stub row inside an existing outer transaction.
 * MUST NOT open its own db.transaction() — PgBouncer TRANSACTION mode forbids nested transactions.
 * sourceType defaults to 'POS_SALE' if not provided.
 */
export async function createJournalEntryStub(
  params: { transactionId: string; total: number; sourceType?: JournalSourceType },
  tx: DrizzleTx
): Promise<void> {
  await (tx as unknown as typeof db).insert(journalEntries).values({
    id: randomUUID(),
    transactionId: params.transactionId,
    sourceType: params.sourceType ?? 'POS_SALE',
    amount: params.total,
    debitCredit: 'DR',
    status: 'PENDING',
    createdAt: new Date(),
  })
}

/**
 * Inserts a journal entry reversal row (for void path).
 * amount is stored as negative to represent the reversal.
 * sourceType is 'VOID'.
 */
export async function createJournalEntryReversal(
  params: { transactionId: string; total: number },
  tx: DrizzleTx
): Promise<void> {
  await (tx as unknown as typeof db).insert(journalEntries).values({
    id: randomUUID(),
    transactionId: params.transactionId,
    sourceType: 'VOID',
    amount: -params.total,
    debitCredit: 'DR',
    status: 'PENDING',
    createdAt: new Date(),
  })
}

/**
 * Inserts an accrual journal entry pair (DR Piutang / CR Pendapatan)
 * when a service order is completed.
 * Creates exactly 2 rows: one DR and one CR for double-entry accounting.
 */
export async function createAccrualJournalEntry(
  params: { serviceOrderId: string; total: number; sourceType?: JournalSourceType },
  tx: DrizzleTx
): Promise<void> {
  const now = new Date()
  const sourceType: JournalSourceType = params.sourceType ?? 'SERVICE_COMPLETION'

  await (tx as unknown as typeof db).insert(journalEntries).values([
    {
      id: randomUUID(),
      transactionId: params.serviceOrderId,
      sourceType,
      amount: params.total,
      debitCredit: 'DR',
      referenceId: params.serviceOrderId,
      status: 'POSTED',
      createdAt: now,
    },
    {
      id: randomUUID(),
      transactionId: params.serviceOrderId,
      sourceType,
      amount: params.total,
      debitCredit: 'CR',
      referenceId: params.serviceOrderId,
      status: 'POSTED',
      createdAt: now,
    },
  ])
}

/**
 * Inserts a marketplace sale journal entry for a fulfilled order.
 * Single DR row with sourceType = 'MARKETPLACE_SALE', transactionId = null.
 * Called by the marketplace worker inside an existing outer transaction.
 * MUST NOT open its own db.transaction() — PgBouncer TRANSACTION mode forbids nesting.
 */
export async function createMarketplaceJournalEntry(
  params: { orderId: string; total: number },
  tx: DrizzleTx
): Promise<void> {
  await (tx as unknown as typeof db).insert(journalEntries).values({
    id: randomUUID(),
    transactionId: null,
    sourceId: params.orderId,
    sourceType: 'MARKETPLACE_SALE',
    amount: params.total,
    debitCredit: 'DR',
    status: 'PENDING',
    createdAt: new Date(),
  })
}

/**
 * Inserts a cash receipt journal entry pair (DR Kas / CR Piutang)
 * when a payment is recorded against a service order.
 * Creates exactly 2 rows: one DR and one CR for double-entry accounting.
 */
export async function createCashReceiptJournalEntry(
  params: { serviceOrderId: string; amount: number; paymentId: string },
  tx: DrizzleTx
): Promise<void> {
  const now = new Date()

  await (tx as unknown as typeof db).insert(journalEntries).values([
    {
      id: randomUUID(),
      transactionId: params.serviceOrderId,
      sourceType: 'CASH_RECEIPT',
      amount: params.amount,
      debitCredit: 'DR',
      referenceId: params.paymentId,
      status: 'POSTED',
      createdAt: now,
    },
    {
      id: randomUUID(),
      transactionId: params.serviceOrderId,
      sourceType: 'CASH_RECEIPT',
      amount: params.amount,
      debitCredit: 'CR',
      referenceId: params.paymentId,
      status: 'POSTED',
      createdAt: now,
    },
  ])
}

/* ─── Report Functions ─── */

/**
 * Returns P&L report for a date range.
 * Groups journal entries by sourceType to show revenue and expenses.
 */
export async function getPnlReport(
  startDate: Date,
  endDate: Date
): Promise<PnlReport> {

  // P&L uses only the revenue-side (CR) of double-entry pairs to avoid double-counting.
  // POS_SALE stubs are single DR rows — treat DR amount as revenue (simplified).
  // SERVICE_COMPLETION: only the CR row represents revenue recognised.
  // CASH_RECEIPT: cash collection, NOT new revenue (AR conversion) — excluded from P&L.
  // Expenses: DR side of purchase/payroll/supplier entries.

  const SOURCE_NAMES: Record<string, string> = {
    POS_SALE: 'Penjualan Retail',
    MARKETPLACE_SALE: 'Penjualan Marketplace',
    SERVICE_COMPLETION: 'Pendapatan Jasa',
    PURCHASE: 'Pembelian Barang',
    SUPPLIER_PAYMENT: 'Pembayaran Supplier',
    PAYROLL: 'Beban Gaji',
    VOID: 'Pembatalan / Void',
  }

  const revenue: PnlLineItem[] = []
  const expenses: PnlLineItem[] = []

  // Fetch again grouped by (sourceType, debitCredit) for correct P&L
  const pnlRows = await db.execute(sql`
    SELECT
      source_type  AS "sourceType",
      debit_credit AS "debitCredit",
      COALESCE(SUM(amount), 0) AS total
    FROM journal_entries
    WHERE created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
    GROUP BY source_type, debit_credit
  `)

  for (const row of pnlRows as unknown as Array<{ sourceType: string; debitCredit: string | null; total: string }>) {
    const amount = Number(row.total)
    if (amount === 0) continue
    const side = row.debitCredit ?? 'DR'
    const type = row.sourceType
    const name = SOURCE_NAMES[type] ?? type.replace(/_/g, ' ')

    if (type === 'POS_SALE' && side === 'DR') {
      revenue.push({ code: 'POS', name, amount })
    } else if (type === 'MARKETPLACE_SALE' && side === 'DR') {
      revenue.push({ code: 'MKT', name, amount })
    } else if (type === 'SERVICE_COMPLETION' && side === 'CR') {
      revenue.push({ code: 'SVC', name, amount })
    } else if (type === 'VOID' && side === 'DR') {
      revenue.push({ code: 'VID', name: 'Pembatalan / Void', amount: -amount }) // reduces revenue
    } else if (type === 'PURCHASE' && side === 'DR') {
      expenses.push({ code: 'BLI', name, amount })
    } else if (type === 'SUPPLIER_PAYMENT' && side === 'DR') {
      expenses.push({ code: 'SUP', name, amount })
    } else if (type === 'PAYROLL' && side === 'DR') {
      expenses.push({ code: 'GAJ', name, amount })
    }
  }

  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  return {
    revenue,
    expenses,
    netIncome: totalRevenue - totalExpenses,
  }
}

/**
 * Returns balance sheet as of a given date.
 *
 * Journal entry conventions used by this system:
 *  - POS_SALE stub  → single DR row (cash + revenue in one, simplified)
 *  - SERVICE_COMPLETION → DR Piutang Usaha + CR Pendapatan Jasa (double-entry pair)
 *  - CASH_RECEIPT       → DR Kas + CR Piutang Usaha (double-entry pair)
 *  - PURCHASE           → DR Pembelian + CR Hutang Usaha
 *  - SUPPLIER_PAYMENT   → DR Hutang Usaha + CR Kas
 *  - PAYROLL            → DR Beban Gaji + CR Hutang Gaji
 *  - VOID               → DR reversal
 *
 * Balance sheet mapping:
 *  Assets      = Kas (POS_SALE DR + CASH_RECEIPT DR) + Piutang (SERVICE_COMPLETION DR - CASH_RECEIPT CR)
 *  Liabilities = Hutang Usaha (PURCHASE CR) + Hutang Gaji (PAYROLL CR)
 *  Equity      = Retained Earnings = all revenue CR - all expense DR
 */
export async function getBalanceSheet(asOfDate: Date): Promise<BalanceReport> {
  // Aggregate by (sourceType, debitCredit) so DR and CR amounts are separated
  const rows = await db.execute(sql`
    SELECT
      source_type   AS "sourceType",
      debit_credit  AS "debitCredit",
      COALESCE(SUM(amount), 0) AS total
    FROM journal_entries
    WHERE created_at <= ${asOfDate.toISOString()}
    GROUP BY source_type, debit_credit
  `)

  // Helper: look up aggregated amount for a (type, side) combination
  const byKey = new Map<string, number>()
  for (const row of rows as unknown as Array<{ sourceType: string; debitCredit: string | null; total: string }>) {
    const key = `${row.sourceType}:${row.debitCredit ?? 'DR'}`
    byKey.set(key, Number(row.total))
  }
  const get = (type: string, side: 'DR' | 'CR'): number => byKey.get(`${type}:${side}`) ?? 0

  // ── Assets ──────────────────────────────────────────────────────────────
  // Kas & Bank: POS cash sales + service payments received
  const kasFromPos       = get('POS_SALE', 'DR')           // POS stub (DR only)
  const kasFromMarket    = get('MARKETPLACE_SALE', 'DR')
  const kasFromService   = get('CASH_RECEIPT', 'DR')        // payment received
  const kasOutSupplier   = get('SUPPLIER_PAYMENT', 'DR')    // cash paid to supplier
  const totalKas         = kasFromPos + kasFromMarket + kasFromService - kasOutSupplier

  // Piutang Usaha: services billed but not yet collected
  const piutangDibuat    = get('SERVICE_COMPLETION', 'DR')  // AR created
  const piutangLunas     = get('CASH_RECEIPT', 'CR')        // AR cleared on payment
  const netPiutang       = piutangDibuat - piutangLunas

  const assets: BalanceItem[] = []
  if (totalKas > 0) {
    assets.push({ code: 'KAS', name: 'Kas & Bank', balance: totalKas })
  }
  if (netPiutang > 0) {
    assets.push({ code: 'PIU', name: 'Piutang Usaha', balance: netPiutang })
  }

  // ── Liabilities ──────────────────────────────────────────────────────────
  // Hutang Usaha: purchases on credit
  const hutangUsaha   = get('PURCHASE', 'CR')
  const hutangGaji    = get('PAYROLL', 'CR')
  const liabilities: BalanceItem[] = []
  if (hutangUsaha > 0) {
    liabilities.push({ code: 'HUT', name: 'Hutang Usaha', balance: hutangUsaha })
  }
  if (hutangGaji > 0) {
    liabilities.push({ code: 'GAJ', name: 'Hutang Gaji', balance: hutangGaji })
  }

  // ── Equity / Retained Earnings ───────────────────────────────────────────
  // Revenue = POS sales + service revenue (CR side of accrual)
  const revPos        = get('POS_SALE', 'DR')               // stub — proxy for revenue
  const revMarket     = get('MARKETPLACE_SALE', 'DR')
  const revService    = get('SERVICE_COMPLETION', 'CR')      // actual CR = revenue recognised
  const voids         = get('VOID', 'DR')                   // voids reduce revenue

  // Expenses = cost of purchases + payroll + supplier payments
  const expPurchase   = get('PURCHASE', 'DR')
  const expPayroll    = get('PAYROLL', 'DR')
  const expSupplier   = get('SUPPLIER_PAYMENT', 'DR')

  const totalRevenue  = revPos + revMarket + revService - voids
  const totalExpenses = expPurchase + expPayroll + expSupplier
  const retainedEarnings = totalRevenue - totalExpenses

  const equity: BalanceItem[] = []
  equity.push({ code: 'RET', name: 'Retained Earnings', balance: retainedEarnings })

  // ── Totals & balance check ───────────────────────────────────────────────
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0)
  const totalLiabilitiesAndEquity =
    liabilities.reduce((s, l) => s + l.balance, 0) +
    equity.reduce((s, e) => s + e.balance, 0)
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilitiesAndEquity,
    isBalanced,
  }
}

/**
 * Returns cash flow report for a date range.
 * Groups journal entries by sourceType to show cash movements.
 */
export async function getCashFlow(startDate: Date, endDate: Date): Promise<CashFlowReport> {
  const entries = await db
    .select({
      sourceType: journalEntries.sourceType,
      amount: journalEntries.amount,
    })
    .from(journalEntries)
    .where(
      sql`${journalEntries.createdAt} >= ${startDate.toISOString()} AND ${journalEntries.createdAt} <= ${endDate.toISOString()}`
    )

  // Group by sourceType and sum amounts
  const grouped = new Map<string, number>()
  entries.forEach((e) => {
    const current = grouped.get(e.sourceType) || 0
    grouped.set(e.sourceType, current + e.amount)
  })

  // All sourceTypes are operating activities
  const operating: CashFlowItem[] = Array.from(grouped.entries()).map(([sourceType, netFlow]) => ({
    sourceType,
    netFlow,
  }))

  const totalNetFlow = Array.from(grouped.values()).reduce((sum, amount) => sum + amount, 0)

  return {
    operating,
    totalNetFlow,
  }
}
