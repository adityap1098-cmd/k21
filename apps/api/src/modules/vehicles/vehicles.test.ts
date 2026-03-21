import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock vars are available in the hoisted vi.mock factory
const { mockDbSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}))

// Mock logAudit to avoid real DB writes
vi.mock('../../middleware/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import {
  createVehicle,
  getVehicleById,
  getVehiclesByCustomer,
  searchByPlateNumber,
  updateVehicle,
} from './vehicles.service.js'

const CUSTOMER_ID = '11111111-1111-1111-1111-111111111111'
const VEHICLE_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = '44444444-4444-4444-4444-444444444444'

const mockVehicle = {
  id: VEHICLE_ID,
  customerId: CUSTOMER_ID,
  plateNumber: 'B1234XYZ',
  vehicleType: 'MOTOR' as const,
  brand: 'Honda',
  model: 'Beat',
  year: 2023,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('vehicles service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('BKL-02: create vehicle', () => {
    it('validates customer exists, creates vehicle with uppercased plateNumber, calls logAudit', async () => {
      // Check customer exists — returns customer
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: CUSTOMER_ID }]),
          }),
        }),
      })

      // Check duplicate plate — returns empty
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      // Insert returns created vehicle
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockVehicle, plateNumber: 'B1234XYZ' }]),
        }),
      })

      const result = await createVehicle(
        {
          customerId: CUSTOMER_ID,
          plateNumber: 'b1234xyz',
          vehicleType: 'MOTOR',
          brand: 'Honda',
          model: 'Beat',
          year: 2023,
        },
        USER_ID,
        '127.0.0.1'
      )

      expect(result).toMatchObject({ plateNumber: 'B1234XYZ', brand: 'Honda' })

      // Verify insert was called with uppercased plate
      const insertCall = mockDbInsert.mock.results[0].value.values
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({ plateNumber: 'B1234XYZ' })
      )

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          tableName: 'vehicles',
          recordId: VEHICLE_ID,
        })
      )
    })
  })

  describe('BKL-02: create vehicle — customer not found', () => {
    it('throws CUSTOMER_NOT_FOUND when customerId does not exist', async () => {
      // Check customer exists — returns empty
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        createVehicle(
          {
            customerId: 'nonexistent-customer-id',
            plateNumber: 'B1234XYZ',
            vehicleType: 'MOTOR',
            brand: 'Honda',
            model: 'Beat',
          },
          USER_ID,
          '127.0.0.1'
        )
      ).rejects.toThrow('CUSTOMER_NOT_FOUND')
    })
  })

  describe('BKL-02: create vehicle — duplicate plate', () => {
    it('throws DUPLICATE_PLATE_NUMBER when plate already exists', async () => {
      // Check customer exists — returns customer
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: CUSTOMER_ID }]),
          }),
        }),
      })

      // Check duplicate plate — returns existing vehicle
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: VEHICLE_ID }]),
        }),
      })

      await expect(
        createVehicle(
          {
            customerId: CUSTOMER_ID,
            plateNumber: 'B1234XYZ',
            vehicleType: 'MOTOR',
            brand: 'Honda',
            model: 'Beat',
          },
          USER_ID,
          '127.0.0.1'
        )
      ).rejects.toThrow('DUPLICATE_PLATE_NUMBER')
    })
  })

  describe('BKL-02: get by id', () => {
    it('returns vehicle when found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVehicle]),
          }),
        }),
      })

      const result = await getVehicleById(VEHICLE_ID)
      expect(result).toMatchObject({ id: VEHICLE_ID, plateNumber: 'B1234XYZ' })
    })

    it('throws VEHICLE_NOT_FOUND when not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(getVehicleById('nonexistent-id')).rejects.toThrow('VEHICLE_NOT_FOUND')
    })
  })

  describe('BKL-03: list by customerId', () => {
    it('returns multiple vehicles for one customer', async () => {
      const vehicle2 = { ...mockVehicle, id: '33333333-3333-3333-3333-333333333333', plateNumber: 'B5678ABC' }

      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockVehicle, vehicle2]),
        }),
      })

      const result = await getVehiclesByCustomer(CUSTOMER_ID)
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ customerId: CUSTOMER_ID })
      expect(result[1]).toMatchObject({ customerId: CUSTOMER_ID })
    })
  })

  describe('BKL-02: search by plate', () => {
    it('returns vehicles matching partial plate number', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockVehicle]),
        }),
      })

      const result = await searchByPlateNumber('1234')
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ plateNumber: 'B1234XYZ' })
    })
  })

  describe('BKL-02: update vehicle', () => {
    it('updates vehicle and calls logAudit with UPDATE', async () => {
      const updatedVehicle = { ...mockVehicle, brand: 'Yamaha', model: 'NMAX' }

      // Select for old value
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVehicle]),
          }),
        }),
      })

      // Update returns updated vehicle
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedVehicle]),
          }),
        }),
      })

      const result = await updateVehicle(
        { id: VEHICLE_ID, brand: 'Yamaha', model: 'NMAX' },
        USER_ID,
        '127.0.0.1'
      )

      expect(result).toMatchObject({ brand: 'Yamaha', model: 'NMAX' })

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          tableName: 'vehicles',
          recordId: VEHICLE_ID,
        })
      )
    })

    it('throws VEHICLE_NOT_FOUND when updating nonexistent vehicle', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        updateVehicle(
          { id: 'nonexistent-id', brand: 'Test' },
          USER_ID,
          '127.0.0.1'
        )
      ).rejects.toThrow('VEHICLE_NOT_FOUND')
    })
  })
})
