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
