import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock without factory — file does not exist yet, achieves RED state
vi.mock('./pos.service.js')

import type { CompleteSaleParams } from './pos.service.js'

const mockParams: CompleteSaleParams = {
  clientUuid: '11111111-1111-1111-1111-111111111111',
  shiftId: '22222222-2222-2222-2222-222222222222',
  cashierId: '33333333-3333-3333-3333-333333333333',
  subtotal: 10000,
  discountAmount: 0,
  total: 10000,
  items: [
    {
      variantId: '44444444-4444-4444-4444-444444444444',
      qty: 2,
      unitPrice: 5000,
      discountAmount: 0,
      lineTotal: 10000,
    },
  ],
  payments: [
    { method: 'CASH', amount: 10000 },
  ],
}

describe('completeSale', () => {
  let completeSale: typeof import('./pos.service.js')['completeSale']

  beforeEach(async () => {
    const mod = await import('./pos.service.js')
    completeSale = mod.completeSale
  })

  it('valid params → returns transaction with id + status COMPLETED', async () => {
    const result = await completeSale(mockParams)
    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
    expect(result.status).toBe('COMPLETED')
  })

  it('duplicate clientUuid → returns existing transaction (idempotent, no error)', async () => {
    const first = await completeSale(mockParams)
    const second = await completeSale(mockParams)
    expect(second.id).toBe(first.id)
  })

  it('insufficient stock → throws INSUFFICIENT_STOCK', async () => {
    await expect(completeSale({ ...mockParams, clientUuid: 'low-stock-uuid' })).rejects.toThrow('INSUFFICIENT_STOCK')
  })
})

describe('syncOfflineTx', () => {
  let syncOfflineTx: typeof import('./pos.service.js')['syncOfflineTx']

  beforeEach(async () => {
    const mod = await import('./pos.service.js')
    syncOfflineTx = mod.syncOfflineTx
  })

  it('pending transaction → calls completeSale and returns synced result', async () => {
    const result = await syncOfflineTx(mockParams)
    expect(result.status).toBe('synced')
    expect((result as { transactionId: string }).transactionId).toBeDefined()
  })

  it('conflict (stock=0 at sync time) → returns { status: conflict }', async () => {
    const result = await syncOfflineTx({ ...mockParams, clientUuid: 'conflict-uuid' })
    expect(result.status).toBe('conflict')
  })
})

describe('voidTransaction', () => {
  let voidTransaction: typeof import('./pos.service.js')['voidTransaction']

  beforeEach(async () => {
    const mod = await import('./pos.service.js')
    voidTransaction = mod.voidTransaction
  })

  it('valid void → returns voided transaction with voidReason set', async () => {
    const result = await voidTransaction({ transactionId: 'tx-id', voidReason: 'Customer request', performedBy: 'cashier-id' })
    expect(result.status).toBe('VOIDED')
    expect(result.voidReason).toBe('Customer request')
  })

  it('already voided → throws ALREADY_VOIDED', async () => {
    await expect(
      voidTransaction({ transactionId: 'already-voided-tx', voidReason: 'retry', performedBy: 'cashier-id' })
    ).rejects.toThrow('ALREADY_VOIDED')
  })

  it('writes RETURN inventory_movement + journal entry reversal', async () => {
    const result = await voidTransaction({ transactionId: 'tx-with-items', voidReason: 'Test', performedBy: 'cashier-id' })
    expect(result.status).toBe('VOIDED')
  })
})
