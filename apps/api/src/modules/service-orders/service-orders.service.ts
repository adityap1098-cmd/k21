import { randomUUID } from 'crypto'
import { eq, and, not, sql, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { serviceOrders, serviceOrderItems, servicePayments, vehicles, customers } from '../../db/schema/index.js'
import { logAudit } from '../../middleware/audit.js'
import { getVehicleById } from '../vehicles/vehicles.service.js'
import { getServiceItemById } from '../service-catalog/service-catalog.service.js'
import { recordMovement } from '../inventory/movement.service.js'
import { invalidateStockCache } from '../inventory/stock.service.js'
import { createAccrualJournalEntry, createCashReceiptJournalEntry } from '../accounting/accounting.service.js'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// --- Helpers ---

function generateSoNumber(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `SO-${date}-${rand}`
}

type WorkStatus = 'BOOKING' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED'

const VALID_TRANSITIONS: Record<WorkStatus, WorkStatus[]> = {
  BOOKING: ['CHECKED_IN'],
  CHECKED_IN: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
}

function assertTransition(current: WorkStatus, target: WorkStatus): void {
  if (!VALID_TRANSITIONS[current]?.includes(target)) {
    throw new Error('INVALID_STATUS_TRANSITION')
  }
}

// --- Service Functions ---

export async function createServiceOrder(
  params: {
    vehicleId: string
    mechanicId?: string
    complaint?: string
    estimatedCompletionAt?: string
    estimatedCost?: number
    bookingDate?: string
    createdBy: string
  },
  userId: string,
  ipAddress: string,
) {
  // Validate vehicle exists — re-throws VEHICLE_NOT_FOUND as-is
  await getVehicleById(params.vehicleId)

  const id = randomUUID()
  const orderNumber = generateSoNumber()

  const [order] = await db
    .insert(serviceOrders)
    .values({
      id,
      orderNumber,
      vehicleId: params.vehicleId,
      mechanicId: params.mechanicId ?? null,
      workStatus: 'BOOKING',
      paymentStatus: 'UNPAID',
      complaint: params.complaint ?? null,
      estimatedCompletionAt: params.estimatedCompletionAt ? new Date(params.estimatedCompletionAt) : null,
      estimatedCost: params.estimatedCost ?? null,
      bookingDate: params.bookingDate ? new Date(params.bookingDate) : null,
      createdBy: params.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'service_orders',
    recordId: id,
    oldValue: null,
    newValue: { orderNumber, vehicleId: params.vehicleId, workStatus: 'BOOKING', paymentStatus: 'UNPAID' },
    ipAddress,
  })

  return order
}

export async function getServiceOrderById(id: string) {
  const [order] = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.id, id))
    .limit(1)

  if (!order) {
    throw new Error('SERVICE_ORDER_NOT_FOUND')
  }

  return order
}

export async function getOpenServiceOrders() {
  const orders = await db
    .select()
    .from(serviceOrders)
    .where(not(eq(serviceOrders.workStatus, 'COMPLETED')))

  return orders
}

export async function updateWorkStatus(
  id: string,
  targetStatus: WorkStatus,
  userId: string,
  ipAddress: string,
) {
  const order = await getServiceOrderById(id)

  assertTransition(order.workStatus as WorkStatus, targetStatus)

  const updateObj: Record<string, unknown> = {
    workStatus: targetStatus,
    updatedAt: new Date(),
  }

  if (targetStatus === 'CHECKED_IN') {
    updateObj.checkedInAt = new Date()
  }

  if (targetStatus === 'COMPLETED') {
    updateObj.completedAt = new Date()
  }

  const [updated] = await db
    .update(serviceOrders)
    .set(updateObj)
    .where(eq(serviceOrders.id, id))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'service_orders',
    recordId: id,
    oldValue: { workStatus: order.workStatus },
    newValue: { workStatus: targetStatus },
    ipAddress,
  })

  return updated
}

export async function assignMechanic(
  id: string,
  mechanicId: string,
  userId: string,
  ipAddress: string,
) {
  const order = await getServiceOrderById(id)

  const [updated] = await db
    .update(serviceOrders)
    .set({ mechanicId, updatedAt: new Date() })
    .where(eq(serviceOrders.id, id))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'service_orders',
    recordId: id,
    oldValue: { mechanicId: order.mechanicId },
    newValue: { mechanicId },
    ipAddress,
  })

  return updated
}

export async function updateEstimate(
  id: string,
  params: { estimatedCompletionAt?: string; estimatedCost?: number },
  userId: string,
  ipAddress: string,
) {
  const order = await getServiceOrderById(id)

  const updateObj: Record<string, unknown> = { updatedAt: new Date() }

  if (params.estimatedCompletionAt !== undefined) {
    updateObj.estimatedCompletionAt = new Date(params.estimatedCompletionAt)
  }

  if (params.estimatedCost !== undefined) {
    updateObj.estimatedCost = params.estimatedCost
  }

  const [updated] = await db
    .update(serviceOrders)
    .set(updateObj)
    .where(eq(serviceOrders.id, id))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'service_orders',
    recordId: id,
    oldValue: { estimatedCompletionAt: order.estimatedCompletionAt, estimatedCost: order.estimatedCost },
    newValue: { estimatedCompletionAt: params.estimatedCompletionAt, estimatedCost: params.estimatedCost },
    ipAddress,
  })

  return updated
}

export async function getServiceOrdersByVehicle(vehicleId: string) {
  const orders = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.vehicleId, vehicleId))

  return orders
}

// --- Line Item Functions ---

export async function addLineItem(
  params: {
    serviceOrderId: string
    itemType: 'SERVICE' | 'PART'
    catalogItemId?: string
    variantId?: string
    description?: string
    qty: number
    unitPrice?: number
  },
  userId: string,
  ipAddress: string,
) {
  // Validate order exists
  await getServiceOrderById(params.serviceOrderId)

  let description = params.description
  let unitPrice = params.unitPrice

  if (params.itemType === 'SERVICE' && params.catalogItemId) {
    const catalogItem = await getServiceItemById(params.catalogItemId)
    unitPrice = unitPrice ?? catalogItem.defaultPrice
    description = description ?? catalogItem.name
  }

  if (params.itemType === 'PART') {
    if (!params.variantId) {
      throw new Error('VARIANT_ID_REQUIRED')
    }
    if (!description) {
      throw new Error('DESCRIPTION_REQUIRED')
    }
    if (unitPrice == null) {
      throw new Error('UNIT_PRICE_REQUIRED')
    }
  }

  // At this point unitPrice and description must be defined
  const finalUnitPrice = unitPrice!
  const finalDescription = description!
  const lineTotal = params.qty * finalUnitPrice
  const id = randomUUID()

  const [item] = await db
    .insert(serviceOrderItems)
    .values({
      id,
      serviceOrderId: params.serviceOrderId,
      itemType: params.itemType,
      catalogItemId: params.catalogItemId ?? null,
      variantId: params.variantId ?? null,
      description: finalDescription,
      qty: params.qty,
      unitPrice: finalUnitPrice,
      lineTotal,
    })
    .returning()

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'service_order_items',
    recordId: id,
    oldValue: null,
    newValue: { serviceOrderId: params.serviceOrderId, itemType: params.itemType, description: finalDescription, qty: params.qty, unitPrice: finalUnitPrice, lineTotal },
    ipAddress,
  })

  return item
}

export async function removeLineItem(
  params: { serviceOrderId: string; itemId: string },
  userId: string,
  ipAddress: string,
) {
  const [item] = await db
    .select()
    .from(serviceOrderItems)
    .where(
      and(
        eq(serviceOrderItems.id, params.itemId),
        eq(serviceOrderItems.serviceOrderId, params.serviceOrderId),
      ),
    )
    .limit(1)

  if (!item) {
    throw new Error('LINE_ITEM_NOT_FOUND')
  }

  const [deleted] = await db
    .delete(serviceOrderItems)
    .where(eq(serviceOrderItems.id, params.itemId))
    .returning()

  await logAudit({
    userId,
    action: 'DELETE',
    tableName: 'service_order_items',
    recordId: params.itemId,
    oldValue: { description: item.description, qty: item.qty, unitPrice: item.unitPrice },
    newValue: null,
    ipAddress,
  })

  return deleted
}

export async function getLineItems(serviceOrderId: string) {
  const items = await db
    .select()
    .from(serviceOrderItems)
    .where(eq(serviceOrderItems.serviceOrderId, serviceOrderId))

  return items
}

// --- Completion (BKL-12: spare part inventory decrement) ---

export async function completeServiceOrder(
  serviceOrderId: string,
  userId: string,
  ipAddress: string,
) {
  let partVariantIds: string[] = []

  const updatedOrder = await db.transaction(async (tx) => {
    // 1. Fetch order inside transaction
    const orderRows = await (tx as unknown as typeof db)
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.id, serviceOrderId))
      .limit(1)

    const order = orderRows[0]
    if (!order) throw new Error('SERVICE_ORDER_NOT_FOUND')

    // 2. Assert order is IN_PROGRESS (direct check, not assertTransition)
    if (order.workStatus !== 'IN_PROGRESS') {
      throw new Error('ORDER_NOT_IN_PROGRESS')
    }

    // 3. Fetch line items
    const lineItems = await (tx as unknown as typeof db)
      .select()
      .from(serviceOrderItems)
      .where(eq(serviceOrderItems.serviceOrderId, serviceOrderId))

    // 4. Filter PART items with variantId
    const partItems = lineItems.filter(
      (i) => i.itemType === 'PART' && i.variantId != null,
    )

    // 5. FOR UPDATE lock + stock check for each PART item
    for (const item of partItems) {
      const rows = await (tx as DrizzleTx).execute(
        sql`SELECT stock_qty FROM product_variants WHERE id = ${item.variantId} FOR UPDATE`,
      )
      const variant = (rows as unknown as Array<{ stock_qty: number }>)[0]
      if (!variant || variant.stock_qty < item.qty) {
        throw new Error('INSUFFICIENT_STOCK')
      }
    }

    // 6. Record movement + decrement stock for each PART item
    for (const item of partItems) {
      await recordMovement(
        {
          variantId: item.variantId!,
          movementType: 'SALE',
          qty: item.qty,
          reference: serviceOrderId,
          performedBy: userId,
        },
        tx,
      )

      await (tx as DrizzleTx).execute(
        sql`UPDATE product_variants SET stock_qty = stock_qty - ${item.qty}, updated_at = now() WHERE id = ${item.variantId}`,
      )
    }

    // Collect unique variantIds for post-commit cache invalidation
    partVariantIds = [...new Set(partItems.map((i) => i.variantId!))]

    // 7. Update order to COMPLETED
    const [updated] = await (tx as unknown as typeof db)
      .update(serviceOrders)
      .set({
        workStatus: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(serviceOrders.id, serviceOrderId))
      .returning()

    // 8. Create accrual journal entry (DR Piutang / CR Pendapatan) — atomic with completion
    const total = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)
    if (total > 0) {
      await createAccrualJournalEntry({ serviceOrderId, total, sourceType: 'SERVICE_COMPLETION' }, tx)
    }

    return updated
  })

  // 9. Invalidate stock cache AFTER transaction commits (not inside)
  for (const variantId of partVariantIds) {
    await invalidateStockCache(variantId)
  }

  // 10. Audit log for completion
  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'service_orders',
    recordId: serviceOrderId,
    oldValue: { workStatus: 'IN_PROGRESS' },
    newValue: { workStatus: 'COMPLETED' },
    ipAddress,
  })

  return updatedOrder
}

// --- Payments (BKL-19/BKL-20) ---

export async function recordServicePayment(
  serviceOrderId: string,
  params: { amount: number; method: string; reference?: string },
  userId: string,
  ipAddress: string,
) {
  // Validate order exists and is COMPLETED
  const order = await getServiceOrderById(serviceOrderId)
  if (order.workStatus !== 'COMPLETED') {
    throw new Error('ORDER_NOT_COMPLETED')
  }

  // Fetch existing payments to compute totalPaid
  const existingPayments = await db
    .select()
    .from(servicePayments)
    .where(eq(servicePayments.serviceOrderId, serviceOrderId))

  const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0)

  // Compute order total from line items
  const items = await getLineItems(serviceOrderId)
  const total = items.reduce((sum, i) => sum + i.lineTotal, 0)

  const remaining = total - totalPaid
  if (params.amount > remaining) {
    throw new Error('OVERPAYMENT')
  }

  const newStatus = (totalPaid + params.amount) >= total ? 'PAID' : 'PARTIAL'
  const paymentId = randomUUID()

  const payment = await db.transaction(async (tx) => {
    // Insert payment row
    const [inserted] = await (tx as unknown as typeof db)
      .insert(servicePayments)
      .values({
        id: paymentId,
        serviceOrderId,
        amount: params.amount,
        method: params.method as any,
        reference: params.reference ?? null,
        paidAt: new Date(),
        createdBy: userId,
      })
      .returning()

    // Create cash receipt journal entry (DR Kas / CR Piutang)
    await createCashReceiptJournalEntry(
      { serviceOrderId, amount: params.amount, paymentId },
      tx,
    )

    // Update paymentStatus on service order
    await (tx as unknown as typeof db)
      .update(serviceOrders)
      .set({ paymentStatus: newStatus, updatedAt: new Date() })
      .where(eq(serviceOrders.id, serviceOrderId))

    return inserted
  })

  // Audit log for payment creation
  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'service_payments',
    recordId: paymentId,
    oldValue: null,
    newValue: { amount: params.amount, method: params.method, paymentStatus: newStatus },
    ipAddress,
  })

  return { payment, paymentStatus: newStatus }
}

// --- Receivables Query (BKL-21) ---

export async function getReceivables(customerId?: string) {
  // Fetch UNPAID/PARTIAL service orders joined to vehicles and customers
  let query = db
    .select({
      serviceOrderId: serviceOrders.id,
      orderNumber: serviceOrders.orderNumber,
      customerId: vehicles.customerId,
      customerName: customers.name,
      vehicleId: serviceOrders.vehicleId,
      plateNumber: vehicles.plateNumber,
      workStatus: serviceOrders.workStatus,
      paymentStatus: serviceOrders.paymentStatus,
    })
    .from(serviceOrders)
    .innerJoin(vehicles, eq(serviceOrders.vehicleId, vehicles.id))
    .innerJoin(customers, eq(vehicles.customerId, customers.id))
    .where(inArray(serviceOrders.paymentStatus, ['UNPAID', 'PARTIAL']))
    .$dynamic()

  if (customerId) {
    query = query.where(
      and(
        inArray(serviceOrders.paymentStatus, ['UNPAID', 'PARTIAL']),
        eq(vehicles.customerId, customerId),
      ),
    )
  }

  const orders = await query

  // For each order, compute total from line items and totalPaid from payments
  const results = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(serviceOrderItems)
        .where(eq(serviceOrderItems.serviceOrderId, order.serviceOrderId))

      const total = items.reduce((sum, i) => sum + i.lineTotal, 0)

      const payments = await db
        .select()
        .from(servicePayments)
        .where(eq(servicePayments.serviceOrderId, order.serviceOrderId))

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

      return {
        ...order,
        total,
        totalPaid,
        outstanding: total - totalPaid,
      }
    }),
  )

  return results
}

// --- Service History Query (BKL-15/BKL-22) ---

export async function getServiceHistory(plateNumber: string) {
  // Find vehicle by plate number first
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.plateNumber, plateNumber))
    .limit(1)

  if (!vehicle) {
    return []
  }

  // Get all service orders for this vehicle, ordered by creation date DESC
  const orders = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.vehicleId, vehicle.id))

  // Sort by createdAt DESC (in-memory, since drizzle orderBy returns a chain)
  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return orders
}
