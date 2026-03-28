import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import {
  createVehicle,
  getVehicleById,
  getVehicles,
  searchByPlateNumber,
  updateVehicle,
} from './vehicles.service.js'

export const vehiclesRouter = Router()

const createVehicleSchema = z.object({
  customerId: z.string().uuid(),
  plateNumber: z.string().min(1).max(20),
  vehicleType: z.enum(['MOTOR', 'MOBIL']),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(2100).optional(),
})

const updateVehicleSchema = z.object({
  plateNumber: z.string().min(1).max(20).optional(),
  vehicleType: z.enum(['MOTOR', 'MOBIL']).optional(),
  brand: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  isActive: z.boolean().optional(),
})

// GET / — list vehicles (optional ?customerId= filter)
vehiclesRouter.get('/', authenticate, async (req, res) => {
  try {
    const customerId = req.query.customerId as string | undefined
    const data = await getVehicles(customerId ? { customerId } : undefined)
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[vehicles] GET / failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// GET /search — search by plate number (MUST be before /:id)
vehiclesRouter.get('/search', authenticate, async (req, res) => {
  try {
    const plateNumber = (req.query.plateNumber as string) ?? ''
    const data = await searchByPlateNumber(plateNumber)
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[vehicles] GET /search failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// GET /:id — get vehicle by id
vehiclesRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const data = await getVehicleById(req.params.id)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'VEHICLE_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[vehicles] GET /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// POST / — create vehicle
vehiclesRouter.post('/', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = createVehicleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await createVehicle(parsed.data, req.user!.sub, ipAddress)
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'CUSTOMER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'DUPLICATE_PLATE_NUMBER') {
      res.status(409).json({ success: false, data: null, error: message })
    } else {
      console.error('[vehicles] POST / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// PATCH /:id — update vehicle
vehiclesRouter.patch('/:id', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = updateVehicleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await updateVehicle({ id: req.params.id, ...parsed.data }, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'VEHICLE_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'DUPLICATE_PLATE_NUMBER') {
      res.status(409).json({ success: false, data: null, error: message })
    } else {
      console.error('[vehicles] PATCH /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})
