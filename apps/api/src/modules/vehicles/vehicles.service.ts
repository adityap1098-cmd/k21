import { randomUUID } from 'crypto'
import { eq, ilike } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { customers, vehicles } from '../../db/schema/index.js'
import { logAudit } from '../../middleware/audit.js'
import type { Vehicle } from '../../db/schema/index.js'

export async function createVehicle(
  params: {
    customerId: string
    plateNumber: string
    vehicleType: 'MOTOR' | 'MOBIL'
    brand: string
    model: string
    year?: number
  },
  userId: string,
  ipAddress: string
): Promise<Vehicle> {
  const { customerId, plateNumber, vehicleType, brand, model, year } = params

  // Validate customer exists
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1)

  if (!customer) {
    throw new Error('CUSTOMER_NOT_FOUND')
  }

  const upperPlate = plateNumber.toUpperCase()

  // Check for duplicate plate number
  const existing = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(eq(vehicles.plateNumber, upperPlate))

  if (existing.length > 0) {
    throw new Error('DUPLICATE_PLATE_NUMBER')
  }

  const id = randomUUID()

  const [vehicle] = await db
    .insert(vehicles)
    .values({ id, customerId, plateNumber: upperPlate, vehicleType, brand, model, year })
    .returning()

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'vehicles',
    recordId: vehicle.id,
    oldValue: null,
    newValue: { plateNumber: vehicle.plateNumber, brand: vehicle.brand, model: vehicle.model, customerId: vehicle.customerId },
    ipAddress,
  })

  return vehicle
}

export async function getVehicleById(id: string): Promise<Vehicle> {
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1)

  if (!vehicle) {
    throw new Error('VEHICLE_NOT_FOUND')
  }

  return vehicle
}

export async function getVehicles(filters?: {
  customerId?: string
}): Promise<Vehicle[]> {
  if (filters?.customerId) {
    const results = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.customerId, filters.customerId))
    return results
  }

  const results = await db.select().from(vehicles)
  return results
}

export async function getVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
  return getVehicles({ customerId })
}

export async function searchByPlateNumber(plateNumber: string): Promise<Vehicle[]> {
  const pattern = `%${plateNumber}%`

  const results = await db
    .select()
    .from(vehicles)
    .where(ilike(vehicles.plateNumber, pattern))

  return results
}

export async function updateVehicle(
  params: {
    id: string
    plateNumber?: string
    brand?: string
    model?: string
    year?: number
    vehicleType?: 'MOTOR' | 'MOBIL'
    isActive?: boolean
  },
  userId: string,
  ipAddress: string
): Promise<Vehicle> {
  const { id, ...updates } = params

  const [old] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1)

  if (!old) {
    throw new Error('VEHICLE_NOT_FOUND')
  }

  // Uppercase plateNumber if provided
  if (updates.plateNumber) {
    updates.plateNumber = updates.plateNumber.toUpperCase()

    // Check for duplicate plate if plate is being changed
    if (updates.plateNumber !== old.plateNumber) {
      const existing = await db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(eq(vehicles.plateNumber, updates.plateNumber))

      if (existing.length > 0) {
        throw new Error('DUPLICATE_PLATE_NUMBER')
      }
    }
  }

  const [updated] = await db
    .update(vehicles)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'vehicles',
    recordId: id,
    oldValue: { plateNumber: old.plateNumber, brand: old.brand, model: old.model, isActive: old.isActive },
    newValue: { plateNumber: updated.plateNumber, brand: updated.brand, model: updated.model, isActive: updated.isActive },
    ipAddress,
  })

  return updated
}
