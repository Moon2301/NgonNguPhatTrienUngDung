import express from 'express'
import { z } from 'zod'
import { col, nextId } from '../db.js'
import { requireAdmin } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getSeatStatesForShowtime, getSeatHoldMs } from '../services/showtimeSeatmap.js'

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

// Front-End hiện gọi POST (apiPost) để update user → hỗ trợ alias cho tiện.
router.post(
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
    return res.json({ user: u })
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

router.get(
  '/movies',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await col('movies').find({}).sort({ id: -1 }).toArray()
    res.json({ movies: rows })
  }),
)

router.post(
  '/movies',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      id: z.coerce.number().optional(),
      title: z.string().min(1).max(255),
      description: z.string().optional().nullable(),
      director: z.string().optional().nullable(),
      cast: z.string().optional().nullable(),
      duration: z.coerce.number().int().min(1).max(1000),
      releaseDate: z.string().optional().nullable(),
      posterUrl: z.string().optional().nullable(),
      genre: z.string().optional().nullable(),
      trailerUrl: z.string().optional().nullable(),
    })
    const input = schema.parse(req.body)

    if (input.id) {
      await col('movies').updateOne(
        { id: input.id },
        {
          $set: {
            title: input.title,
            description: input.description ?? null,
            director: input.director ?? null,
            cast: input.cast ?? null,
            duration: input.duration,
            release_date: input.releaseDate ? new Date(String(input.releaseDate)) : null,
            poster_url: input.posterUrl ?? null,
            genre: input.genre ?? null,
            trailer_url: input.trailerUrl ?? null,
            updated_at: new Date(),
          },
        },
      )
      return res.json({ id: input.id })
    }

    const id = await nextId('movies')
    await col('movies').insertOne({
      id,
      title: input.title,
      description: input.description ?? null,
      director: input.director ?? null,
      cast: input.cast ?? null,
      duration: input.duration,
      release_date: input.releaseDate ? new Date(String(input.releaseDate)) : null,
      poster_url: input.posterUrl ?? null,
      genre: input.genre ?? null,
      trailer_url: input.trailerUrl ?? null,
      created_at: new Date(),
    })
    return res.status(201).json({ id })
  }),
)

router.get(
  '/news',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await col('news').find({}, { projection: { _id: 0 } }).sort({ published_at: -1, id: -1 }).toArray()
    res.json({
      news: rows.map((n) => ({
        ...n,
        imageUrl: n.image_url ?? n.imageUrl ?? null,
        publishedAt: n.published_at ?? n.publishedAt ?? null,
      })),
    })
  }),
)

router.post(
  '/news',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      id: z.coerce.number().optional(),
      title: z.string().min(1).max(500),
      excerpt: z.string().optional().nullable(),
      content: z.string().optional().nullable(),
      category: z.string().optional().nullable(),
      author: z.string().optional().nullable(),
      imageUrl: z.string().optional().nullable(),
      publishedAt: z.string().optional().nullable(),
      active: z.coerce.boolean().optional(),
    })
    const input = schema.parse(req.body)

    const docSet = {
      title: input.title,
      excerpt: input.excerpt ?? null,
      content: input.content ?? null,
      category: input.category ?? null,
      author: input.author ?? null,
      image_url: input.imageUrl ?? null,
      published_at: input.publishedAt ? new Date(String(input.publishedAt)) : null,
      active: typeof input.active === 'boolean' ? input.active : true,
      updated_at: new Date(),
    }

    if (input.id) {
      await col('news').updateOne({ id: input.id }, { $set: docSet })
      return res.json({ id: input.id })
    }

    const id = await nextId('news')
    await col('news').insertOne({ id, ...docSet, created_at: new Date() })
    return res.status(201).json({ id })
  }),
)

router.get(
  '/promotions',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await col('promotions').find({}).sort({ id: -1 }).toArray()
    res.json({ promotions: rows })
  }),
)

router.post(
  '/promotions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      id: z.coerce.number().optional(),
      code: z.string().min(1).max(50),
      title: z.string().min(1).max(255),
      description: z.string().optional().nullable(),
      discountAmount: z.coerce.number().min(0).optional(),
      discountPercent: z.coerce.number().min(0).max(100).optional(),
      expiresAt: z.string().optional().nullable(),
      active: z.coerce.boolean().optional(),
      showtimeId: z.coerce.number().optional().nullable(),
      usageLimit: z.coerce.number().int().min(0).optional().nullable(),
    })
    const input = schema.parse(req.body)
    const code = String(input.code).toUpperCase().trim()

    const docSet = {
      code,
      title: input.title,
      description: input.description ?? null,
      discount_amount: Number(input.discountAmount || 0),
      discount_percent: Number(input.discountPercent || 0),
      expires_at: input.expiresAt ? new Date(String(input.expiresAt)) : null,
      active: typeof input.active === 'boolean' ? input.active : true,
      showtime_id: input.showtimeId ? Number(input.showtimeId) : null,
      usage_limit: input.usageLimit == null ? null : Number(input.usageLimit),
      updated_at: new Date(),
    }

    if (input.id) {
      // prevent code collision
      const existing = await col('promotions').findOne({ code, id: { $ne: input.id } }, { projection: { id: 1 } })
      if (existing) return res.status(409).json({ error: 'Code đã tồn tại.' })
      await col('promotions').updateOne({ id: input.id }, { $set: docSet })
      return res.json({ id: input.id })
    }

    const existing = await col('promotions').findOne({ code }, { projection: { id: 1 } })
    if (existing) return res.status(409).json({ error: 'Code đã tồn tại.' })
    const id = await nextId('promotions')
    await col('promotions').insertOne({ id, ...docSet, usage_count: 0, created_at: new Date() })
    return res.status(201).json({ id })
  }),
)

router.delete(
  '/promotions/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    await col('promotions').deleteOne({ id })
    res.json({ success: true })
  }),
)

router.delete(
  '/movies/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    await col('movies').deleteOne({ id })
    res.json({ success: true })
  }),
)

router.delete(
  '/news/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    await col('news').deleteOne({ id })
    res.json({ success: true })
  }),
)

router.get(
  '/products',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await col('products').find({}, { projection: { _id: 0 } }).sort({ id: -1 }).toArray()
    res.json({ products: rows })
  }),
)

router.post(
  '/products',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      id: z.coerce.number().optional(),
      name: z.string().min(1).max(255),
      price: z.coerce.number().min(0),
      imageUrl: z.string().optional().nullable(),
      category: z.string().optional().nullable(),
      active: z.coerce.boolean().optional(),
    })
    const input = schema.parse(req.body)

    const docSet = {
      name: input.name,
      price: Number(input.price || 0),
      image_url: input.imageUrl ?? null,
      category: input.category ?? null,
      active: typeof input.active === 'boolean' ? input.active : true,
      updated_at: new Date(),
    }

    if (input.id) {
      await col('products').updateOne({ id: input.id }, { $set: docSet })
      return res.json({ id: input.id })
    }

    const id = await nextId('products')
    await col('products').insertOne({ id, ...docSet, created_at: new Date() })
    return res.status(201).json({ id })
  }),
)

router.delete(
  '/products/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    await col('products').deleteOne({ id })
    res.json({ success: true })
  }),
)

router.get(
  '/bookings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      date: z.string().optional(),
    })
    const { search, status, date } = schema.parse(req.query)

    const q = search && search.trim() ? String(search).toLowerCase().trim() : null
    const st = status && status !== 'all' ? String(status) : null
    const d = date ? String(date) : null

    const match = {}
    if (st) match.status = st
    if (d) {
      const start = new Date(`${d}T00:00:00.000Z`)
      const end = new Date(`${d}T23:59:59.999Z`)
      match.booking_time = { $gte: start, $lte: end }
    }
    if (q) {
      match.$or = [{ customer_name: { $regex: q, $options: 'i' } }, { customer_email: { $regex: q, $options: 'i' } }]
    }

    const bookings = await col('bookings').find(match).sort({ booking_time: -1, id: -1 }).toArray()
    const showtimeIds = [...new Set(bookings.map((b) => b.showtime_id).filter((x) => x != null))]
    const showtimes = showtimeIds.length ? await col('showtimes').find({ id: { $in: showtimeIds } }).toArray() : []
    const showtimeMap = new Map(showtimes.map((s) => [s.id, s]))
    const movieIds = [...new Set(showtimes.map((s) => s.movie_id).filter((x) => x != null))]
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]
    const [movies, rooms] = await Promise.all([
      movieIds.length ? col('movies').find({ id: { $in: movieIds } }, { projection: { id: 1, title: 1 } }).toArray() : [],
      roomIds.length ? col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray() : [],
    ])
    const movieMap = new Map(movies.map((m) => [m.id, m.title]))
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]))

    res.json({
      bookings: bookings.map((b) => {
        const stDoc = showtimeMap.get(b.showtime_id)
        return {
          ...b,
          booking_type: b.booking_type || (b.from_ticket_pass_id ? 'PASS' : 'TICKET'),
          start_time: stDoc?.start_time ?? null,
          movieTitle: stDoc ? movieMap.get(stDoc.movie_id) || null : null,
          roomName: stDoc ? roomMap.get(stDoc.room_id) || null : null,
        }
      }),
    })
  }),
)

router.post(
  '/bookings/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const schema = z.object({ status: z.string().min(1).max(50) })
    const { status } = schema.parse(req.body)
    const current = await col('bookings').findOne({ id }, { projection: { status: 1 } })
    if (!current) return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' })
    if (current.status === 'CANCELLED') {
      return res.status(409).json({ error: 'Hóa đơn đã huỷ, không thể đổi trạng thái.' })
    }
    await col('bookings').updateOne({ id }, { $set: { status, updated_at: new Date() } })
    res.json({ success: true })
  }),
)

router.get(
  '/showtimes',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const showtimes = await col('showtimes').find({}).sort({ start_time: -1, id: -1 }).toArray()
    const movieIds = [...new Set(showtimes.map((s) => s.movie_id).filter((x) => x != null))]
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]
    const [movies, rooms] = await Promise.all([
      movieIds.length ? col('movies').find({ id: { $in: movieIds } }, { projection: { id: 1, title: 1 } }).toArray() : [],
      roomIds.length ? col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray() : [],
    ])
    const movieMap = new Map(movies.map((m) => [m.id, m.title]))
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]))
    res.json({
      showtimes: showtimes.map((s) => ({
        ...s,
        movieTitle: movieMap.get(s.movie_id) || null,
        roomName: roomMap.get(s.room_id) || null,
      })),
    })
  }),
)

router.post(
  '/showtimes',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      id: z.coerce.number().optional(),
      movieId: z.coerce.number(),
      roomId: z.coerce.number(),
      startTime: z.string(),
      price: z.coerce.number(),
    })
    const input = schema.parse(req.body)
    const start = input.startTime.replace('T', ' ').slice(0, 19)

    if (input.id) {
      await col('showtimes').updateOne(
        { id: input.id },
        { $set: { movie_id: input.movieId, room_id: input.roomId, start_time: start, price: input.price } },
      )
      return res.json({ id: input.id })
    }
    const id = await nextId('showtimes')
    await col('showtimes').insertOne({ id, movie_id: input.movieId, room_id: input.roomId, start_time: start, price: input.price })
    return res.status(201).json({ id })
  }),
)

router.delete(
  '/showtimes/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    await col('showtimes').deleteOne({ id })
    res.json({ success: true })
  }),
)

router.get(
  '/seatmap/:showtimeId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const showtimeId = Number(req.params.showtimeId)
    const showtime = await col('showtimes').findOne({ id: showtimeId })
    if (!showtime) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' })

    const [movie, room] = await Promise.all([
      showtime.movie_id != null ? col('movies').findOne({ id: showtime.movie_id }, { projection: { title: 1 } }) : null,
      showtime.room_id != null ? col('rooms').findOne({ id: showtime.room_id }, { projection: { name: 1, total_rows: 1, total_cols: 1 } }) : null,
    ])

    const { bookedSeats, heldSeats, occupiedSeats } = await getSeatStatesForShowtime(showtimeId)

    const bookingDocs = await col('bookings')
      .find(
        { showtime_id: showtimeId, status: { $nin: ['FAILED', 'CANCELLED'] } },
        {
          projection: {
            id: 1,
            seat_numbers: 1,
            status: 1,
            booking_time: 1,
            customer_name: 1,
            total_amount: 1,
          },
        },
      )
      .sort({ booking_time: -1, id: -1 })
      .toArray()

    const cutoff = Date.now() - getSeatHoldMs()
    const activeBookings = bookingDocs.filter((b) => {
      if (b.status !== 'PENDING') return true
      const t = b.booking_time ? new Date(b.booking_time).getTime() : 0
      return t >= cutoff
    })

    res.json({
      showtime: {
        ...showtime,
        movieTitle: movie?.title || null,
        roomName: room?.name || null,
      },
      rows: room?.total_rows || 10,
      cols: room?.total_cols || 10,
      occupiedSeats,
      bookedSeats,
      heldSeats,
      holdMinutes: Math.round(getSeatHoldMs() / 60000),
      bookings: activeBookings,
    })
  }),
)

export default router

