import express from 'express'
import { z } from 'zod'
import { col, nextId } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseSeats, uniqueSeats } from '../utils/seats.js'

const router = express.Router()

const PASS_LOCK_MS = 2 * 60 * 1000

function parseDateMaybe(v) {
  if (v == null) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function isPassExpired(pass, now) {
  const expireAt = parseDateMaybe(pass.expire_at) || parseDateMaybe(pass.start_time)
  if (!expireAt) return false
  return expireAt.getTime() <= now.getTime()
}

async function enrichPasses(passes) {
  if (!passes.length) return []
  const showtimeIds = [...new Set(passes.map((p) => p.showtime_id).filter((x) => x != null))]
  const showtimes = showtimeIds.length ? await col('showtimes').find({ id: { $in: showtimeIds } }).toArray() : []
  const showtimeMap = new Map(showtimes.map((s) => [s.id, s]))

  const movieIds = [...new Set(showtimes.map((s) => s.movie_id).filter((x) => x != null))]
  const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]
  const [movies, rooms] = await Promise.all([
    movieIds.length
      ? col('movies').find({ id: { $in: movieIds } }, { projection: { id: 1, title: 1, poster_url: 1 } }).toArray()
      : [],
    roomIds.length ? col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray() : [],
  ])
  const movieTitleMap = new Map(movies.map((m) => [m.id, m.title]))
  const moviePosterMap = new Map(movies.map((m) => [m.id, m.poster_url || null]))
  const roomMap = new Map(rooms.map((r) => [r.id, r.name]))

  return passes.map((tp) => {
    const st = tp.showtime_id != null ? showtimeMap.get(tp.showtime_id) : null
    return {
      ...tp,
      seat_number: tp.seat_number ?? null,
      original_amount: tp.original_amount ?? null,
      start_time: st?.start_time ?? null,
      price: st?.price ?? null,
      movieTitle: st ? movieTitleMap.get(st.movie_id) || null : null,
      posterUrl: st ? moviePosterMap.get(st.movie_id) || null : null,
      roomName: st ? roomMap.get(st.room_id) || null : null,
    }
  })
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      keyword: z.string().optional(),
      filter: z.string().optional(),
    })
    const { keyword, filter } = schema.parse(req.query)

    const now = new Date()

    if (filter === 'my') {
      const userId = req.session?.user?.id
      if (!userId) return res.json({ passes: [] })
      const rows = await col('ticket_passes')
        .find({
          seller_id: userId,
          status: { $in: ['AVAILABLE', 'LOCKED'] },
          $or: [{ expire_at: { $gt: now } }, { expire_at: { $exists: false } }],
        })
        .sort({ created_at: -1, id: -1 })
        .toArray()
      const enriched = await enrichPasses(rows)
      return res.json({ passes: enriched.filter((p) => !isPassExpired(p, now)) })
    }

    if (keyword && keyword.trim()) {
      const q = String(keyword).toLowerCase().trim()
      const cutoff = new Date(Date.now() - PASS_LOCK_MS)
      const available = await col('ticket_passes')
        .find({
          $and: [
            { $or: [{ status: 'AVAILABLE' }, { status: 'LOCKED', locked_at: { $lt: cutoff } }] },
            { $or: [{ expire_at: { $gt: now } }, { expire_at: { $exists: false } }] },
          ],
        })
        .sort({ created_at: -1, id: -1 })
        .toArray()
      const enriched = await enrichPasses(available)
      return res.json({
        passes: enriched
          .map((p) => (p.status === 'LOCKED' ? { ...p, status: 'AVAILABLE' } : p))
          .filter((p) => !isPassExpired(p, now) && (p.movieTitle || '').toLowerCase().includes(q)),
      })
    }

    const cutoff = new Date(Date.now() - PASS_LOCK_MS)
    const rows = await col('ticket_passes')
      .find({
        $and: [
          { $or: [{ status: 'AVAILABLE' }, { status: 'LOCKED', locked_at: { $lt: cutoff } }] },
          { $or: [{ expire_at: { $gt: now } }, { expire_at: { $exists: false } }] },
        ],
      })
      .sort({ created_at: -1, id: -1 })
      .toArray()
    const enriched = await enrichPasses(rows)
    res.json({ passes: enriched.map((p) => (p.status === 'LOCKED' ? { ...p, status: 'AVAILABLE' } : p)).filter((p) => !isPassExpired(p, now)) })
  }),
)

router.get(
  '/me/list',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.user.id
    const now = new Date()
    const rows = await col('ticket_passes')
      .find({
        seller_id: userId,
        status: { $in: ['AVAILABLE', 'LOCKED'] },
        $or: [{ expire_at: { $gt: now } }, { expire_at: { $exists: false } }],
      })
      .sort({ created_at: -1, id: -1 })
      .toArray()
    const enriched = await enrichPasses(rows)
    res.json({ passes: enriched.filter((p) => !isPassExpired(p, now)) })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    let pass = await col('ticket_passes').findOne({ id })
    if (!pass) return res.status(404).json({ error: 'Không tìm thấy vé.' })
    if (pass.status === 'LOCKED') {
      const lockedAt = pass.locked_at ? new Date(pass.locked_at).getTime() : 0
      if (lockedAt && Date.now() - lockedAt > PASS_LOCK_MS) {
        await col('ticket_passes').updateOne({ id, status: 'LOCKED' }, { $set: { status: 'AVAILABLE' }, $unset: { locked_by: '', locked_at: '' } })
        pass = await col('ticket_passes').findOne({ id })
      }
    }
    const enriched = await enrichPasses([pass])
    res.json({ pass: enriched[0] || pass })
  }),
)

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      bookingId: z.coerce.number(),
      seats: z.array(z.string().min(1)).min(1),
      passPrice: z.coerce.number().min(1000), // giá / 1 vé (1 ghế)
      reason: z.string().optional().nullable(),
      contactInfo: z.string().optional().nullable(),
    })
    const input = schema.parse(req.body)
    const sellerId = req.session.user.id

    const booking = await col('bookings').findOne(
      { id: input.bookingId },
      { projection: { id: 1, user_id: 1, showtime_id: 1, seat_numbers: 1, tickets_amount: 1, total_amount: 1, status: 1 } },
    )
    if (!booking) return res.status(404).json({ error: 'Booking không tồn tại.' })
    if (Number(booking.user_id) !== Number(sellerId)) return res.status(403).json({ error: 'Không có quyền.' })
    if (booking.status !== 'SUCCESS') return res.status(409).json({ error: 'Chỉ có thể đăng bán vé đã thanh toán (SUCCESS).' })

    const bookingSeats = uniqueSeats(parseSeats(booking.seat_numbers || ''))
    const requestedSeats = uniqueSeats(input.seats.map((s) => String(s).trim()).filter(Boolean))
    const invalid = requestedSeats.find((s) => !bookingSeats.includes(s))
    if (invalid) return res.status(400).json({ error: `Ghế ${invalid} không thuộc booking này.` })

    const existing = await col('ticket_passes')
      .find(
        { booking_id: input.bookingId, seat_number: { $in: requestedSeats }, status: { $in: ['AVAILABLE', 'LOCKED', 'SOLD'] } },
        { projection: { id: 1, seat_number: 1, status: 1 } },
      )
      .toArray()
    if (existing.length) {
      const s = existing[0]?.seat_number || '?'
      return res.status(409).json({ error: `Ghế ${s} đã/đang được đăng bán.` })
    }

    const now = new Date()
    const showtime = await col('showtimes').findOne(
      { id: booking.showtime_id },
      { projection: { start_time: 1 } },
    )
    const expireAt = parseDateMaybe(showtime?.start_time)
    const expire_at = expireAt ? expireAt : undefined

    const docs = []
    const ids = []
    const baseAmt = Number(booking.tickets_amount || booking.total_amount || 0)
    const perSeatOriginal = Math.round(baseAmt / Math.max(1, bookingSeats.length))
    const finalPassPrice = input.passPrice

    if (finalPassPrice > perSeatOriginal) {
      return res.status(400).json({ error: `Giá bán (${finalPassPrice.toLocaleString()}đ) không được vượt quá giá mua gốc (${perSeatOriginal.toLocaleString()}đ).` })
    }

    for (const seat of requestedSeats) {
      const id = await nextId('ticket_passes')
      ids.push(id)
      docs.push({
        id,
        seller_id: sellerId,
        buyer_id: null,
        booking_id: input.bookingId,
        showtime_id: booking.showtime_id,
        seat_number: seat,
        original_amount: perSeatOriginal,
        pass_price: finalPassPrice,
        reason: input.reason || null,
        contact_info: input.contactInfo || null,
        status: 'AVAILABLE',
        created_at: now,
        ...(expire_at ? { expire_at } : {}),
      })
    }
    if (docs.length) await col('ticket_passes').insertMany(docs)
    res.status(201).json({ ids })
  }),
)

router.post(
  '/:id/buy',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const buyerId = req.session.user.id
    const now = new Date()

    let pass = await col('ticket_passes').findOne({ id })
    if (!pass) return res.status(404).json({ error: 'Không tìm thấy vé.' })
    if (pass.status === 'LOCKED') {
      const lockedAt = pass.locked_at ? new Date(pass.locked_at).getTime() : 0
      if (lockedAt && Date.now() - lockedAt > PASS_LOCK_MS) {
        await col('ticket_passes').updateOne({ id, status: 'LOCKED' }, { $set: { status: 'AVAILABLE' }, $unset: { locked_by: '', locked_at: '' } })
        pass = await col('ticket_passes').findOne({ id })
      }
    }
    if (pass.status !== 'AVAILABLE') {
      return res.status(409).json({ error: 'Vé không còn khả dụng.', code: 'PASS_NOT_AVAILABLE', status: pass.status || null })
    }
    if (Number(pass.seller_id) === Number(buyerId)) return res.status(409).json({ error: 'Không thể mua vé của chính bạn.' })

    if (isPassExpired(pass, now)) {
      return res.status(409).json({ error: 'Vé pass đã hết hạn.' })
    }
    if (!pass.expire_at) {
      const st = await col('showtimes').findOne({ id: pass.showtime_id }, { projection: { start_time: 1 } })
      if (st && isPassExpired({ ...pass, start_time: st.start_time }, now)) {
        return res.status(409).json({ error: 'Vé pass đã hết hạn.' })
      }
    }

    const price = Number(pass.pass_price || 0)
    const buyer = await col('users').findOne(
      { id: buyerId },
      { projection: { id: 1, wallet: 1, fullName: 1, username: 1, email: 1, phone: 1 } },
    )
    if (!buyer) return res.status(404).json({ error: 'Không tìm thấy người mua.' })
    if (Number(buyer.wallet || 0) < price) {
      return res.status(409).json({
        error: 'Ví không đủ tiền để mua pass.',
        code: 'WALLET_NOT_ENOUGH',
        need: Math.max(0, price - Number(buyer.wallet || 0)),
      })
    }

    const sellerId = Number(pass.seller_id)
    const bookingId = Number(pass.booking_id)
    const seat = String(pass.seat_number || '').trim()
    if (!seat) return res.status(500).json({ error: 'Pass thiếu seat_number.' })

    // lock pass
    const locked = await col('ticket_passes').findOneAndUpdate(
      { id, status: 'AVAILABLE' },
      { $set: { status: 'LOCKED', locked_by: buyerId, locked_at: new Date() } },
      { returnDocument: 'after' },
    )
    const lockedPass = locked?.value ?? locked
    if (!lockedPass) return res.status(409).json({ error: 'Vé không còn khả dụng.' })

    const sellerBooking = await col('bookings').findOne({ id: bookingId }, { projection: { id: 1, user_id: 1, showtime_id: 1, seat_numbers: 1, status: 1 } })
    if (!sellerBooking || Number(sellerBooking.user_id) !== sellerId) {
      await col('ticket_passes').updateOne({ id }, { $set: { status: 'AVAILABLE' }, $unset: { locked_by: '', locked_at: '' } })
      return res.status(409).json({ error: 'Booking gốc không hợp lệ.' })
    }

    const sellerSeats = uniqueSeats(parseSeats(sellerBooking.seat_numbers || ''))
    if (!sellerSeats.includes(seat)) {
      await col('ticket_passes').updateOne({ id }, { $set: { status: 'CANCELLED', cancelled_at: new Date() } })
      return res.status(409).json({ error: 'Ghế không còn trong booking gốc.' })
    }

    // money transfer
    await col('users').updateOne({ id: buyerId }, { $inc: { wallet: -price } })
    await col('users').updateOne({ id: sellerId }, { $inc: { wallet: price } })
    req.session.user.wallet = Number(req.session.user.wallet || 0) - price

    // split booking seat: remove from seller booking; create new booking for buyer
    const remaining = sellerSeats.filter((s) => s !== seat)
    await col('bookings').updateOne({ id: bookingId }, { $set: { seat_numbers: remaining.join(','), updated_at: new Date() } })

    const newBookingId = await nextId('bookings')
    await col('bookings').insertOne({
      id: newBookingId,
      booking_type: 'PASS',
      user_id: buyerId,
      showtime_id: sellerBooking.showtime_id,
      customer_name: buyer.fullName || buyer.username || `User#${buyerId}`,
      customer_email: buyer.email || `user${buyerId}@local`,
      customer_phone: buyer.phone || null,
      seat_numbers: seat,
      tickets_amount: 0,
      products_amount: 0,
      products: [],
      total_amount: price,
      booking_time: new Date(),
      status: 'SUCCESS',
      payment_method: 'WALLET',
      payment_status: 'SUCCESS',
      from_ticket_pass_id: id,
    })

    await col('ticket_passes').updateOne(
      { id },
      { $set: { status: 'SOLD', buyer_id: buyerId, sold_at: new Date(), buyer_booking_id: newBookingId }, $unset: { locked_by: '', locked_at: '' } },
    )

    res.json({ success: true, bookingId: newBookingId })
  }),
)

router.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const userId = req.session.user.id

    const pass = await col('ticket_passes').findOne({ id })
    if (!pass) return res.status(404).json({ error: 'Không tìm thấy vé.' })
    if (Number(pass.seller_id) !== Number(userId)) return res.status(403).json({ error: 'Không có quyền.' })
    if (pass.status === 'SOLD') return res.status(409).json({ error: 'Vé đã bán, không thể huỷ.' })

    await col('ticket_passes').updateOne({ id }, { $set: { status: 'CANCELLED', cancelled_at: new Date() } })
    res.json({ success: true })
  }),
)

export default router

