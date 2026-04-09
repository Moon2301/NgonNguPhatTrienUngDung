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

    const revenueAgg = await col('bookings')
      .aggregate([
        {
          $match: {
            $or: [{ status: 'SUCCESS' }, { status: { $exists: false } }, { status: null }],
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$total_amount', 0] } },
          },
        },
      ])
      .toArray()
    const totalRevenue = Number(revenueAgg?.[0]?.totalRevenue || 0)

    res.json({ totalBookings, totalMovies, totalUsers, totalRevenue })
  }),
)

router.get(
  '/wallet-topups',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await col('payments')
      .aggregate([
        { $match: { provider: 'VNPAY', purpose: 'TOPUP' } },
        { $sort: { created_at: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: 'id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: 1,
            amount: 1,
            status: 1,
            txn_ref: 1,
            created_at: 1,
            updated_at: 1,
            vnp_response_code: 1,
            user: {
              id: '$user.id',
              username: '$user.username',
              fullName: '$user.full_name',
              email: '$user.email',
            },
          },
        },
      ])
      .toArray()

    res.json({ topups: rows })
  }),
)

router.get(
  '/revenue-series',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      granularity: z.enum(['week', 'month']).default('week'),
      points: z.coerce.number().int().min(1).max(52).default(12),
    })
    const { granularity, points } = schema.parse(req.query)

    const unit = granularity === 'month' ? 'month' : 'week'
    const tz = 'Asia/Ho_Chi_Minh'

    function dtParts(d) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d)
      const get = (t) => parts.find((p) => p.type === t)?.value || ''
      return { y: get('year'), m: get('month'), day: get('day') }
    }

    function bucketKey(d) {
      const p = dtParts(d)
      return unit === 'month' ? `${p.y}-${p.m}` : `${p.y}-${p.m}-${p.day}`
    }

    const now = new Date()
    const start = new Date(now)
    if (unit === 'month') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      start.setMonth(start.getMonth() - (points - 1))
    } else {
      const day = start.getDay() // 0=Sun..6=Sat
      const mondayOffset = (day + 6) % 7
      start.setDate(start.getDate() - mondayOffset)
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - (points - 1) * 7)
    }

    const rows = await col('bookings')
      .aggregate([
        {
          $match: {
            booking_time: { $gte: start },
            $or: [{ status: 'SUCCESS' }, { status: { $exists: false } }, { status: null }],
          },
        },
        {
          $addFields: {
            bucket: {
              $dateTrunc: {
                date: '$booking_time',
                unit,
                timezone: tz,
                ...(unit === 'week' ? { startOfWeek: 'Mon' } : {}),
              },
            },
          },
        },
        {
          $group: {
            _id: '$bucket',
            revenue: { $sum: { $ifNull: ['$total_amount', 0] } },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    const map = new Map(rows.map((r) => [bucketKey(new Date(r._id)), r]))

    const series = []
    for (let i = 0; i < points; i++) {
      const d = new Date(start)
      if (unit === 'month') d.setMonth(start.getMonth() + i)
      else d.setDate(start.getDate() + i * 7)

      const key = bucketKey(d)
      const hit = map.get(key)
      const p = dtParts(d)
      const label = unit === 'month' ? `${p.m}/${p.y}` : `${p.day}/${p.m}`

      series.push({
        label,
        revenue: Number(hit?.revenue || 0),
        bookings: Number(hit?.bookings || 0),
      })
    }

    res.json({ series })
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

