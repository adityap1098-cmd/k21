import { randomUUID } from 'crypto'
import { db } from '../db/index.js'
import { auditLogs } from '../db/schema/index.js'

export async function logAudit(params: {
  userId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  tableName: string
  recordId: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  ipAddress: string
}): Promise<void> {
  await db.insert(auditLogs).values({
    id: randomUUID(),
    userId: params.userId,
    action: params.action,
    tableName: params.tableName,
    recordId: params.recordId,
    oldValue: params.oldValue,
    newValue: params.newValue,
    ipAddress: params.ipAddress,
    createdAt: new Date(),
  })
}
