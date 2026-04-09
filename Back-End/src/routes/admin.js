import express from 'express'
import { z } from 'zod'
import { col } from '../db.js'
import { requireAdmin } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get(
  '/dashboard',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [totalBookings, totalMovies, totalUsers] = await Promise.all([
      col('bookings').countDocuments({}),
      col('movies').countDocuments({}),
      col('users').countDocuments({}),
    ])

    // Bookings not implemented yet → revenue is best-effort
    res.json({ totalBookings, totalMovies, totalUsers, totalRevenue: 0 })
  }),
)

router.get(
  '/users',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await col('users')
      .find({}, { projection: { _id: 0, passwordHash: 0 } })
      .sort({ id: 1 })
      .toArray()
    res.json({ users: rows })
  }),
)

router.patch(
  '/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })

    const schema = z.object({
      role: z.enum(['USER', 'ADMIN']).optional(),
      isBlocked: z.coerce.boolean().optional(),
    })
    const input = schema.parse(req.body)

    const $set = {}
    if (input.role) $set.role = input.role
    if (typeof input.isBlocked === 'boolean') $set.is_blocked = input.isBlocked

    if (!Object.keys($set).length) return res.json({ success: true })

    await col('users').updateOne({ id }, { $set })
    const u = await col('users').findOne({ id }, { projection: { _id: 0, passwordHash: 0 } })
    if (!u) return res.status(404).json({ error: 'Không tìm thấy user.' })
    res.json({ user: u })
  }),
)

router.delete(
  '/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })

    // Prevent deleting root admin for safety
    if (id === 1) return res.status(409).json({ error: 'Không thể xóa admin gốc.' })

    await col('users').deleteOne({ id })
    res.json({ success: true })
  }),
)

export default router

