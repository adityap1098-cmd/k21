import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db/index.js')
vi.mock('../../queues/lowstock.queue.js', () => ({
  lowStockQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

import { getStockCached, invalidateStockCache } from './stock.service.js'
import { recordMovement, decrementStock } from './movement.service.js'
import { createReservation, cancelReservation, fulfillReservation } from './reservation.service.js'
import { runStockOpname } from './opname.service.js'

describe('inventory — INV-01: Redis stock cache', () => {
  it('getStockCached returns cached value on Redis hit without hitting Postgres')
  it('getStockCached falls back to Postgres on Redis miss and populates cache')
  it('invalidateStockCache deletes the key from Redis')
})

describe('inventory — INV-02: append-only movements', () => {
  it('recordMovement inserts a new inventory_movements row')
  it('recordMovement does not call db.update or db.delete on inventory_movements')
})

describe('inventory — INV-03: movement types', () => {
  it('accepts SALE, PURCHASE, TRANSFER, RETURN, ADJUSTMENT movement types')
  it('qty is negative for SALE and TRANSFER, positive for PURCHASE, RETURN, ADJUSTMENT')
})

describe('inventory — INV-04: ADJUSTMENT validation', () => {
  it('recordMovement with ADJUSTMENT and no reason throws REASON_REQUIRED')
  it('recordMovement with ADJUSTMENT and no approvedBy throws APPROVER_REQUIRED')
})

describe('inventory — INV-05: concurrent decrement', () => {
  it('decrementStock uses SELECT FOR UPDATE inside a transaction')
  it('decrementStock throws INSUFFICIENT_STOCK when available qty < requested qty')
  it('decrementStock accounts for active reservations in available qty calculation')
})

describe('inventory — INV-06: stock reservations', () => {
  it('createReservation inserts stock_reservations row with ACTIVE status')
  it('createReservation throws INSUFFICIENT_STOCK when available < qty')
  it('cancelReservation sets status to CANCELLED and sets resolvedAt')
  it('fulfillReservation sets status to FULFILLED and sets resolvedAt')
})

describe('inventory — INV-07: low-stock alerts', () => {
  it('decrementStock enqueues low-stock BullMQ job when stock drops below threshold')
  it('decrementStock does not enqueue when lowStockThreshold is null')
})

describe('inventory — INV-08: stock opname', () => {
  it('runStockOpname inserts ADJUSTMENT movements for variants with discrepancy')
  it('runStockOpname skips variants where physicalCount matches current stock')
  it('runStockOpname returns count of adjusted variants')
})
