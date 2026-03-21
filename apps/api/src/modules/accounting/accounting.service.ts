import { randomUUID } from 'crypto'
import { db } from '../../db/index.js'
import { journalEntries } from '../../db/schema/accounting.js'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Inserts a journal entry stub row inside an existing outer transaction.
 * MUST NOT open its own db.transaction() — PgBouncer TRANSACTION mode forbids nested transactions.
 * sourceType defaults to 'POS_SALE' if not provided.
 */
export async function createJournalEntryStub(
  params: { transactionId: string; total: number; sourceType?: string },
  tx: DrizzleTx
): Promise<void> {
  await (tx as unknown as typeof db).insert(journalEntries).values({
    id: randomUUID(),
    transactionId: params.transactionId,
    sourceType: params.sourceType ?? 'POS_SALE',
    amount: params.total,
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
  params: { serviceOrderId: string; total: number; sourceType?: string },
  tx: DrizzleTx
): Promise<void> {
  const now = new Date()
  const sourceType = params.sourceType ?? 'SERVICE_COMPLETION'

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
