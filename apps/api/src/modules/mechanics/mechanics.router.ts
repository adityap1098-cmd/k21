import { Router } from 'express'
import { z } from 'zod'
import { eq, ilike, and } from 'drizzle-orm'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { db } from '../../db/index.js'
import { mechanics } from '../../db/schema/bengkel.js'

export const mechanicsRouter = Router()

// ─── GET /mechanics ────────────────────────────────────────────────────
// List all active mechanics (for dropdown). All authenticated users can access.
mechanicsRouter.get(
  '/',
  authenticate,
  async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(mechanics)
        .where(eq(mechanics.isActive, true))
        .orderBy(mechanics.name)
      res.json({ success: true, data: rows, error: null })
    } catch (err) {
      console.error('[mechanics] GET / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /mechanics/all ────────────────────────────────────────────────
// List all mechanics including inactive (for admin management).
mechanicsRouter.get(
  '/all',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(mechanics)
        .orderBy(mechanics.name)
      res.json({ success: true, data: rows, error: null })
    } catch (err) {
      console.error('[mechanics] GET /all failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── POST /mechanics ───────────────────────────────────────────────────
const createSchema = z.object({
  name:      z.string().min(1).max(255),
  phone:     z.string().max(30).optional(),
  specialty: z.string().max(255).optional(),
})

mechanicsRouter.post(
  '/',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, data: null, error: 'Nama mekanik wajib diisi' })
    }

    try {
      // Check duplicate (case-insensitive)
      const existing = await db
        .select()
        .from(mechanics)
        .where(ilike(mechanics.name, parsed.data.name.trim()))
        .limit(1)

      if (existing.length > 0) {
        return res.status(409).json({ success: false, data: null, error: 'Nama mekanik sudah terdaftar' })
      }

      const [created] = await db
        .insert(mechanics)
        .values({
          name:      parsed.data.name.trim(),
          phone:     parsed.data.phone?.trim() || null,
          specialty: parsed.data.specialty?.trim() || null,
        })
        .returning()

      res.status(201).json({ success: true, data: created, error: null })
    } catch (err) {
      console.error('[mechanics] POST / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── PATCH /mechanics/:id ──────────────────────────────────────────────
const updateSchema = z.object({
  name:      z.string().min(1).max(255).optional(),
  phone:     z.string().max(30).optional(),
  specialty: z.string().max(255).optional(),
  isActive:  z.boolean().optional(),
})

mechanicsRouter.patch(
  '/:id',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, data: null, error: 'Invalid data' })
    }

    try {
      // Check duplicate name if changing name
      if (parsed.data.name) {
        const existing = await db
          .select()
          .from(mechanics)
          .where(and(
            ilike(mechanics.name, parsed.data.name.trim()),
          ))
          .limit(1)

        if (existing.length > 0 && existing[0].id !== req.params.id) {
          return res.status(409).json({ success: false, data: null, error: 'Nama mekanik sudah terdaftar' })
        }
      }

      const [updated] = await db
        .update(mechanics)
        .set({
          ...(parsed.data.name      !== undefined && { name: parsed.data.name.trim() }),
          ...(parsed.data.phone     !== undefined && { phone: parsed.data.phone?.trim() || null }),
          ...(parsed.data.specialty !== undefined && { specialty: parsed.data.specialty?.trim() || null }),
          ...(parsed.data.isActive  !== undefined && { isActive: parsed.data.isActive }),
          updatedAt: new Date(),
        })
        .where(eq(mechanics.id, req.params.id))
        .returning()

      if (!updated) {
        return res.status(404).json({ success: false, data: null, error: 'Mekanik tidak ditemukan' })
      }

      res.json({ success: true, data: updated, error: null })
    } catch (err) {
      console.error('[mechanics] PATCH /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── DELETE /mechanics/:id ─────────────────────────────────────────────
// Soft delete — set isActive = false
mechanicsRouter.delete(
  '/:id',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    try {
      const [updated] = await db
        .update(mechanics)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(mechanics.id, req.params.id))
        .returning()

      if (!updated) {
        return res.status(404).json({ success: false, data: null, error: 'Mekanik tidak ditemukan' })
      }

      res.json({ success: true, data: updated, error: null })
    } catch (err) {
      console.error('[mechanics] DELETE /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)
