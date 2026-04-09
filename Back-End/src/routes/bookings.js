import express from 'express'
import { z } from 'zod'
import { col, nextId } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseSeats, uniqueSeats } from '../utils/seats.js'
import { apiFetchJson } from '../utils/internalFetch.js'
import { getSeatStatesForShowtime, SEAT_HOLD_MS } from '../services/showtimeSeatmap.js'
import { getHeldEntriesLive } from '../services/seatHolds.js'

import { sendBookingEmail } from '../services/mailService.js'

const router = express.Router()

router.get(
  '/showtimes/:id/seatmap',
  asyncHandler(async (req, res) => {
    const showtimeId = Number(req.params.id)
    const showtime = await col('showtimes').findOne({ id: showtimeId })
    if (!showtime) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' })

    const [movie, room] = await Promise.all([
      showtime.movie_id != null ? col('movies').findOne({ id: showtime.movie_id }, { projection: { title: 1 } }) : null,
      showtime.room_id != null ? col('rooms').findOne({ id: showtime.room_id }, { projection: { name: 1, total_rows: 1, total_cols: 1 } }) : null,
    ])

    const { bookedSeats, heldSeats, occupiedSeats } = await getSeatStatesForShowtime(showtimeId)
    const products = await col('products')
      .find({ $or: [{ active: true }, { active: { $exists: false } }] }, { projection: { _id: 0 } })
      .sort({ id: -1 })
      .toArray()

    res.json({
      showtime: {
        ...showtime,
        movieTitle: movie?.title || null,
        roomName: room?.name || null,
      },
      rows: room?.total_rows || 10,
      cols: room?.total_cols || 10,
      products,
      occupiedSeats,
      bookedSeats,
      heldSeats,
      holdMinutes: Math.round(SEAT_HOLD_MS / 60000),
    })
  }),
)

router.post(
  '/apply-promo',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      code: z.string().min(1),
      originalAmount: z.coerce.number().min(0),
      showtimeId: z.coerce.number().optional(),
    })
    const input = schema.parse(req.body)

    const code = input.code.toUpperCase().trim()
    const now = new Date()
    const promo = await col('promotions').findOne({
      code,
      active: true,
      $or: [{ expires_at: null }, { expires_at: { $gt: now } }],
    })
    if (!promo) {
      return res.json({ success: false, message: 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn!' })
    }

    const limit = promo.usage_limit == null ? null : Number(promo.usage_limit)
    const used = promo.usage_count == null ? 0 : Number(promo.usage_count)
    if (limit != null && Number.isFinite(limit) && limit >= 0 && used >= limit) {
      return res.json({ success: false, message: 'Mã khuyến mãi đã hết lượt sử dụng.' })
    }

    if (promo.showtime_id && input.showtimeId && Number(promo.showtime_id) !== Number(input.showtimeId)) {
      return res.json({ success: false, message: 'Mã này chỉ áp dụng cho suất chiếu cụ thể!' })
    }

    const discountAmount = Number(promo.discount_amount || 0)
    const discountPercent = Number(promo.discount_percent || 0)
    let discount = 0
    if (discountAmount > 0) discount = Math.min(discountAmount, input.originalAmount)
    else if (discountPercent > 0) discount = (input.originalAmount * discountPercent) / 100

    // VNPay + VND: luôn làm tròn về số nguyên VND
    discount = Math.round(discount)

    const newTotal = Math.max(0, Math.round(input.originalAmount - discount))
    const discountText = discountAmount > 0 ? `Giảm ${Math.round(discountAmount)}đ` : `Giảm ${discountPercent}%`

    const remaining = limit != null && Number.isFinite(limit) && limit >= 0 ? Math.max(0, limit - used) : null
    return res.json({ success: true, discount, newTotal, discountText, remaining })
  }),
)

function calculateSeatPrice(seatId, basePrice, startTime) {
  const row = seatId.charAt(0).toUpperCase()
  const col = parseInt(seatId.substring(1))
  let price = Number(basePrice || 0)

  // Seat Type Surcharges
  if (['D', 'E', 'F', 'G'].includes(row)) price += 20000 // VIP
  else if (row === 'H') price += 25000 // Couple (split per seat, total 50k extra)

  // Time Surcharges
  const date = new Date(startTime)
  const day = date.getDay() // 0: Sun, 6: Sat
  const hour = date.getHours()

  if ([0, 5, 6].includes(day)) price += 10000 // Weekend (Fri, Sat, Sun)
  if (hour >= 17) price += 15000 // Peak Hour

  return price
}


router.post(
  '/confirm',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      showtimeId: z.coerce.number(),
      seats: z.string().min(1),
      seatSocketId: z.string().optional().nullable(),
      promoCode: z.string().optional().nullable(),
      customerName: z.string().min(1).max(255),
      customerEmail: z.string().email().max(255),
      customerPhone: z.string().optional().nullable(),
      products: z
        .array(
          z.object({
            id: z.coerce.number(),
            qty: z.coerce.number().int().min(0).max(99),
          }),
        )
        .optional()
        .default([]),
      paymentMethod: z.enum(['CASH', 'VNPAY']).optional(),
      returnUrl: z.string().url().optional(),
    })
    const input = schema.parse(req.body)

    const st = await col('showtimes').findOne({ id: input.showtimeId })
    if (!st) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' })

    const { occupiedSeats } = await getSeatStatesForShowtime(input.showtimeId)
    const requestedSeats = uniqueSeats(parseSeats(input.seats))
    const conflict = requestedSeats.find((s) => occupiedSeats.includes(s))
    if (conflict) return res.status(409).json({ error: `Ghế ${conflict} đã được chọn.` })

    // Couple Seat Validation: Must be in pairs (H1-H2, H3-H4...)
    for (const seat of requestedSeats) {
      if (seat.startsWith('H')) {
        const num = parseInt(seat.substring(1))
        const partnerNum = num % 2 === 0 ? num - 1 : num + 1
        const partner = `H${partnerNum}`
        if (!requestedSeats.includes(partner)) {
          return res.status(400).json({ error: `Ghế đôi (${seat}) phải được đặt cùng với ghế ${partner}.` })
        }
      }
    }

    // Block seats that are currently held via Socket.IO (by another client)
    const sockId = input.seatSocketId ? String(input.seatSocketId) : ''
    if (sockId) {
      const holds = getHeldEntriesLive(input.showtimeId)
      const bySeat = new Map(holds.map((h) => [String(h.seat), h]))
      const heldByOther = requestedSeats.find((s) => {
        const h = bySeat.get(String(s))
        if (!h) return false
        return String(h.socketId) !== sockId
      })
      if (heldByOther) return res.status(409).json({ error: `Ghế ${heldByOther} đang được giữ chỗ.` })
    }

    const userId = req.session?.user?.id || null
    const method = input.paymentMethod || 'CASH'
    const status = method === 'VNPAY' ? 'PENDING' : 'SUCCESS'

    // Calculate totals server-side (dynamic pricing)
    let ticketsAmount = 0
    for (const s of requestedSeats) {
      ticketsAmount += calculateSeatPrice(s, st.price, st.start_time)
    }

    const items = Array.isArray(input.products) ? input.products : []
    const productQty = new Map()
    for (const it of items) {
      const pid = Number(it.id)
      const qty = Number(it.qty)
      if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue
      productQty.set(pid, Math.min(99, (productQty.get(pid) || 0) + qty))
    }
    const productIds = [...productQty.keys()]
    const productDocs = productIds.length
      ? await col('products')
          .find({ id: { $in: productIds }, $or: [{ active: true }, { active: { $exists: false } }] }, { projection: { _id: 0 } })
          .toArray()
      : []
    const productMap = new Map(productDocs.map((p) => [Number(p.id), p]))

    const bookingProducts = []
    let productsAmount = 0
    for (const [pid, qty] of productQty.entries()) {
      const p = productMap.get(pid)
      if (!p) continue
      const unit = Number(p.price || 0)
      const line = Math.max(0, unit * qty)
      productsAmount += line
      bookingProducts.push({
        product_id: pid,
        name: String(p.name || ''),
        image_url: p.image_url ?? null,
        unit_price: unit,
        qty,
        line_total: line,
      })
    }

    const originalAmount = ticketsAmount + productsAmount

    // promo snapshot (re-validate on server)
    let promo = null
    let promoDiscount = 0
    let promoCodeApplied = null
    if (input.promoCode && String(input.promoCode).trim()) {
      const code = String(input.promoCode).toUpperCase().trim()
      const now = new Date()
      const p = await col('promotions').findOne({
        code,
        active: true,
        $or: [{ expires_at: null }, { expires_at: { $gt: now } }],
      })
      if (!p) return res.status(409).json({ error: 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn!' })
      if (p.showtime_id && Number(p.showtime_id) !== Number(input.showtimeId)) {
        return res.status(409).json({ error: 'Mã này chỉ áp dụng cho suất chiếu cụ thể!' })
      }
      const limit = p.usage_limit == null ? null : Number(p.usage_limit)
      const used = p.usage_count == null ? 0 : Number(p.usage_count)
      if (limit != null && Number.isFinite(limit) && limit >= 0 && used >= limit) {
        return res.status(409).json({ error: 'Mã khuyến mãi đã hết lượt sử dụng.' })
      }
      const discountAmount = Number(p.discount_amount || 0)
      const discountPercent = Number(p.discount_percent || 0)
      if (discountAmount > 0) promoDiscount = Math.min(discountAmount, originalAmount)
      else if (discountPercent > 0) promoDiscount = (originalAmount * discountPercent) / 100
      promo = p
      promoCodeApplied = code
    }

    // VNPay + VND: luôn làm tròn về số nguyên VND
    promoDiscount = Math.round(promoDiscount)
    const finalAmount = Math.max(0, Math.round(originalAmount - promoDiscount))

    const bookingId = await nextId('bookings')
    await col('bookings').insertOne({
      id: bookingId,
      booking_type: 'TICKET',
      user_id: userId,
      showtime_id: input.showtimeId,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone || null,
      seat_numbers: requestedSeats.join(','),
      tickets_amount: ticketsAmount,
      products_amount: productsAmount,
      products: bookingProducts,
      total_amount: finalAmount,
      promo_code: promoCodeApplied,
      promo_id: promo?.id ?? null,
      promo_discount: promo ? promoDiscount : 0,
      booking_time: new Date(),
      status,
      payment_method: method,
      payment_status: method === 'VNPAY' ? 'CREATED' : null,
    })

    if (method === 'VNPAY') {
      // tạo URL thanh toán VNPay
      const d = await apiFetchJson('/api/payments/vnpay/create', {
        method: 'POST',
        body: {
          bookingId,
          amount: finalAmount,
          orderInfo: `Thanh toán booking #${bookingId}`,
          returnUrl: input.returnUrl,
        },
      })
      return res.status(201).json({ bookingId, paymentUrl: d.url })
    }

    if (method === 'CASH') {
       await sendBookingEmail(bookingId)
    }

    return res.status(201).json({ bookingId })
  }),
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.user.id
    const bookings = await col('bookings')
      .find({ user_id: userId, status: 'SUCCESS' })
      .sort({ booking_time: -1, id: -1 })
      .toArray()
    const showtimeIds = [...new Set(bookings.map((b) => b.showtime_id).filter((x) => x != null))]
    const showtimes = showtimeIds.length ? await col('showtimes').find({ id: { $in: showtimeIds } }).toArray() : []
    const showtimeMap = new Map(showtimes.map((s) => [s.id, s]))
    const movieIds = [...new Set(showtimes.map((s) => s.movie_id).filter((x) => x != null))]
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]
    const [movies, rooms] = await Promise.all([
      movieIds.length ? col('movies').find({ id: { $in: movieIds } }, { projection: { id: 1, title: 1, poster_url: 1, duration: 1 } }).toArray() : [],
      roomIds.length ? col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray() : [],
    ])
    const movieMap = new Map(movies.map((m) => [m.id, m]))
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]))

    const now = Date.now()
    const out = bookings.map((b) => {
      const st = showtimeMap.get(b.showtime_id)
      const mv = st ? movieMap.get(st.movie_id) : null
      
      const startTimeVal = st?.start_time ? new Date(st.start_time).getTime() : 0
      let ticketStatus = 'PAST'

      if (b.checkin_status === 'USED') {
        ticketStatus = 'PAST'
      } else if (startTimeVal > 0) {
        if (now < startTimeVal) ticketStatus = 'UPCOMING'
        else if (now <= startTimeVal + 150 * 60000) ticketStatus = 'LIVE'
      }

      const seatCount = (b.seat_numbers || '').split(',').filter(Boolean).length
      // Fallback to total_amount if tickets_amount is missing (for older records)
      const baseAmt = Number(b.tickets_amount || b.total_amount || 0)
      const originalPricePerSeat = seatCount > 0 ? Math.round(baseAmt / seatCount) : 0

      return {
        ...b,
        start_time: st?.start_time ?? null,
        price: st?.price ?? null,
        movieTitle: mv?.title ?? null,
        posterUrl: mv?.poster_url ?? null,
        roomName: st ? roomMap.get(st.room_id) || null : null,
        duration: mv?.duration ?? null,
        ticketStatus,
        originalPricePerSeat,
      }
    })
    res.json({ bookings: out })
  }),
)

router.post(
  '/:id/resend-email',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const userId = req.session.user.id
    const b = await col('bookings').findOne({ id, user_id: userId })
    if (!b) return res.status(404).json({ error: 'Không tìm thấy booking.' })

    await sendBookingEmail(id)
    res.json({ success: true, message: 'Đã gửi lại email xác nhận thành công!' })
  }),
)

router.get(
  '/:id/view',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const b = await col('bookings').findOne({ id })
    if (!b) return res.status(404).json({ error: 'Không tìm thấy booking.' })

    const st = await col('showtimes').findOne({ id: b.showtime_id })
    const mv = st ? await col('movies').findOne({ id: st.movie_id }) : null
    const rm = st ? await col('rooms').findOne({ id: st.room_id }) : null

    let auditor = null
    if (b.checkin_status === 'USED' && b.checked_in_by) {
      const u = await col('users').findOne({ id: b.checked_in_by }, { projection: { fullName: 1, username: 1 } })
      if (u) auditor = u.fullName || u.username
    }

    res.json({
      id: b.id,
      customer_name: b.customer_name,
      seat_numbers: b.seat_numbers,
      total_amount: b.total_amount,
      status: b.status,
      checkin_status: b.checkin_status || 'UNUSED',
      checked_in_at: b.checked_in_at || null,
      checked_in_by_name: auditor,
      movieTitle: mv?.title || null,
      posterUrl: mv?.poster_url || null,
      roomName: rm?.name || null,
      start_time: st?.start_time || null,
      duration: mv?.duration || null,
    })
  }),
)

router.post(
  '/:id/check-in',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const adminId = req.session.user.id
    
    // Check if user is admin
    const adminUser = await col('users').findOne({ id: adminId })
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền soát vé.' })
    }

    const booking = await col('bookings').findOne({ id })
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy vé.' })
    if (booking.status !== 'SUCCESS') return res.status(400).json({ error: 'Vé chưa được thanh toán thành công.' })

    // Atomic update to prevent double check-in
    const result = await col('bookings').updateOne(
      { id, checkin_status: { $ne: 'USED' } },
      { 
        $set: { 
          checkin_status: 'USED', 
          checked_in_at: new Date(), 
          checked_in_by: adminId 
        } 
      }
    )

    if (result.matchedCount === 0) {
      return res.status(409).json({ error: 'Vé này đã được sử dụng trước đó.' })
    }

    res.json({ success: true, message: 'Soát vé thành công!' })
  }),
)

export default router

