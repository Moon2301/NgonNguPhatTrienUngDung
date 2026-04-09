import express from 'express'
import { z } from 'zod'
import { col, nextId } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseSeats, uniqueSeats } from '../utils/seats.js'
import { apiFetchJson } from '../utils/internalFetch.js'
import { getSeatStatesForShowtime, getSeatHoldMs } from '../services/showtimeSeatmap.js'
import { getHeldEntriesLive } from '../sockets/seatSocket.js'
import { areAdjacent, leavesLoneSeat } from '../utils/bookingValidation.js'
import { sendBookingEmail } from '../services/mailService.js'

const router = express.Router()

/* ───── helpers ───── */

function calculateSeatPrice(seatId, basePrice, startTime) {
  const row = seatId.charAt(0).toUpperCase()
  let price = Number(basePrice || 0)

  if (['D', 'E', 'F', 'G'].includes(row)) price += 20000
  else if (row === 'H') price += 25000

  const date = new Date(startTime)
  const day = date.getDay()
  const hour = date.getHours()

  if ([0, 5, 6].includes(day)) price += 10000
  if (hour >= 17) price += 15000

  return price
}

/* ───── GET seatmap ───── */

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

    const { bookedSeats, heldSeats, occupiedSeats, myBookedSeats } = await getSeatStatesForShowtime(
      showtimeId,
      req.session?.user?.id,
    )

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
      myBookedSeats,
      holdMinutes: Math.round(getSeatHoldMs() / 60000),
    })
  }),
)

/* ───── POST apply-promo ───── */

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

    discount = Math.round(discount)
    const newTotal = Math.max(0, Math.round(input.originalAmount - discount))
    const discountText = discountAmount > 0 ? `Giảm ${Math.round(discountAmount)}đ` : `Giảm ${discountPercent}%`
    const remaining = limit != null && Number.isFinite(limit) && limit >= 0 ? Math.max(0, limit - used) : null
    return res.json({ success: true, discount, newTotal, discountText, remaining })
  }),
)

/* ───── POST confirm (create booking) ───── */

router.post(
  '/confirm',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      showtimeId: z.coerce.number(),
      seats: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
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

    const userId = req.session?.user?.id
    if (!userId) return res.status(401).json({ error: 'Bạn cần đăng nhập để đặt vé.' })

    const st = await col('showtimes').findOne({ id: input.showtimeId })
    if (!st) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' })

    const now = new Date()
    const startTime = new Date(st.start_time)
    const fifteenMinsBefore = new Date(startTime.getTime() - 15 * 60000)
    if (now > startTime) return res.status(400).json({ error: 'Suất chiếu đã bắt đầu hoặc đã kết thúc.' })
    if (now > fifteenMinsBefore) return res.status(400).json({ error: 'Đã quá thời hạn đặt vé trực tuyến (15 phút trước giờ chiếu).' })

    const dayAgo = new Date(now.getTime() - 24 * 60 * 60000)
    const dailyCount = await col('bookings').countDocuments({ user_id: userId, booking_time: { $gt: dayAgo } })
    if (dailyCount >= 5) return res.status(429).json({ error: 'Bạn đã đạt giới hạn đặt vé trong ngày (tối đa 5 lần).' })

    const requestedSeats = Array.isArray(input.seats)
      ? uniqueSeats(input.seats.map((s) => String(s).trim()).filter(Boolean))
      : uniqueSeats(parseSeats(input.seats))

    const room = await col('rooms').findOne({ id: st.room_id })
    if (!room) return res.status(500).json({ error: 'Dữ liệu phòng chiếu bị lỗi.' })

    if (!areAdjacent(requestedSeats)) {
      return res.status(400).json({ error: 'Các ghế được chọn phải nằm cạnh nhau.' })
    }

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

    const { bookedSeats, heldSeats } = await getSeatStatesForShowtime(input.showtimeId)

    const bookedConflict = requestedSeats.find((s) => bookedSeats.includes(s))
    if (bookedConflict) return res.status(409).json({ error: `Ghế ${bookedConflict} đã được đặt.` })

    const sockId = input.seatSocketId ? String(input.seatSocketId) : ''
    if (sockId) {
      const holds = getHeldEntriesLive(input.showtimeId)
      const bySeat = new Map(holds.map((h) => [String(h.seat), h]))
      const heldByOther = requestedSeats.find((s) => {
        if (!heldSeats.includes(s)) return false
        const h = bySeat.get(String(s))
        if (!h) return false
        return String(h.socketId) !== sockId
      })
      if (heldByOther) return res.status(409).json({ error: `Ghế ${heldByOther} đang được giữ chỗ.` })
    } else {
      const heldConflict = requestedSeats.find((s) => heldSeats.includes(s))
      if (heldConflict) return res.status(409).json({ error: `Ghế ${heldConflict} đang được giữ chỗ.` })
    }

    const rowsInSelection = [...new Set(requestedSeats.map((s) => s.charAt(0)))]
    for (const rId of rowsInSelection) {
      const selectedColsInRow = requestedSeats.filter((s) => s.startsWith(rId)).map((s) => parseInt(s.substring(1)))
      const rowBookedCols = bookedSeats.filter((s) => s.startsWith(rId)).map((s) => parseInt(s.substring(1)))
      if (leavesLoneSeat(rId, selectedColsInRow, rowBookedCols, room.total_cols || 10)) {
        return res.status(400).json({ error: `Không được để ghế trống đơn lẻ ở hàng ${rId}.` })
      }
    }

    const method = input.paymentMethod || 'CASH'
    const status = method === 'VNPAY' ? 'PENDING' : 'SUCCESS'

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

    let promo = null
    let promoDiscount = 0
    let promoCodeApplied = null
    if (input.promoCode && String(input.promoCode).trim()) {
      const code = String(input.promoCode).toUpperCase().trim()
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
      sendBookingEmail(bookingId).catch((err) => console.error('[EMAIL]', err))
    }

    return res.status(201).json({ bookingId })
  }),
)

/* ───── GET /me ───── */

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.user.id
    const now = new Date()

    const bookings = await col('bookings')
      .find({ user_id: userId, status: { $nin: ['FAILED', 'CANCELLED', 'TRANSFERRED'] } })
      .sort({ booking_time: -1 })
      .toArray()

    const stIds = [...new Set(bookings.map((b) => b.showtime_id).filter((x) => x != null))]
    const showtimes = stIds.length ? await col('showtimes').find({ id: { $in: stIds } }).toArray() : []
    const stMap = new Map(showtimes.map((s) => [s.id, s]))

    const mvIds = [...new Set(showtimes.map((s) => s.movie_id).filter((x) => x != null))]
    const rmIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]
    const [movies, rooms] = await Promise.all([
      mvIds.length ? col('movies').find({ id: { $in: mvIds } }).toArray() : [],
      rmIds.length ? col('rooms').find({ id: { $in: rmIds } }).toArray() : [],
    ])
    const mvMap = new Map(movies.map((m) => [m.id, m]))
    const rmMap = new Map(rooms.map((r) => [r.id, r]))

    const bookingIds = bookings.map((b) => b.id)
    const allPasses = bookingIds.length
      ? await col('ticket_passes')
          .find({ booking_id: { $in: bookingIds }, status: { $in: ['AVAILABLE', 'LOCKED', 'SOLD'] } })
          .toArray()
      : []
    const listedByBooking = new Map()
    const soldByBooking = new Map()
    for (const lp of allPasses) {
      if (lp.status === 'AVAILABLE' || lp.status === 'LOCKED') {
        const arr = listedByBooking.get(lp.booking_id) || []
        arr.push(lp.seat_number)
        listedByBooking.set(lp.booking_id, arr)
      } else if (lp.status === 'SOLD') {
        const arr = soldByBooking.get(lp.booking_id) || []
        arr.push(lp.seat_number)
        soldByBooking.set(lp.booking_id, arr)
      }
    }

    const result = bookings.map((b) => {
      const st = stMap.get(b.showtime_id)
      const mv = st ? mvMap.get(st.movie_id) : null
      const rm = st ? rmMap.get(st.room_id) : null

      let ticketStatus = 'PAST'
      if (st && st.start_time) {
        const start = new Date(st.start_time)
        const end = new Date(start.getTime() + (mv?.duration || 120) * 60000)
        if (now < start) ticketStatus = 'UPCOMING'
        else if (now >= start && now <= end) ticketStatus = 'LIVE'
      }

      const seatCount = (b.seat_numbers || '').split(',').filter(Boolean).length
      const baseAmt = Number(b.tickets_amount || b.total_amount || 0)
      const originalPricePerSeat = seatCount > 0 ? Math.round(baseAmt / seatCount) : 0

      return {
        ...b,
        movieTitle: mv?.title || null,
        posterUrl: mv?.poster_url || null,
        duration: mv?.duration || null,
        roomName: rm?.name || null,
        start_time: st?.start_time || null,
        originalPrice: Number(st?.price || 0),
        ticketStatus,
        originalPricePerSeat,
        listedSeats: listedByBooking.get(b.id) || [],
        soldSeats: soldByBooking.get(b.id) || [],
      }
    })

    res.json({ bookings: result })
  }),
)

/* ───── GET /public/:id ───── */

router.get(
  '/public/:id',
  asyncHandler(async (req, res) => {
    const bookingId = Number(req.params.id)
    const booking = await col('bookings').findOne({ id: bookingId })
    if (!booking) return res.status(404).json({ error: 'Vé không tồn tại.' })

    const st = await col('showtimes').findOne({ id: booking.showtime_id })
    const mv = st ? await col('movies').findOne({ id: st.movie_id }) : null
    const rm = st ? await col('rooms').findOne({ id: st.room_id }) : null

    res.json({
      id: booking.id,
      movieTitle: mv?.title || null,
      posterUrl: mv?.poster_url || null,
      duration: mv?.duration || null,
      roomName: rm?.name || null,
      start_time: st?.start_time || null,
      seat_numbers: booking.seat_numbers,
      customer_name: booking.customer_name,
      total_amount: booking.total_amount,
      status: booking.status,
      booking_time: booking.booking_time,
    })
  }),
)

/* ───── GET /:id/view (QR ticket view) ───── */

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

/* ───── POST /:id/resend-email ───── */

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

/* ───── POST /:id/check-in (admin) ───── */

router.post(
  '/:id/check-in',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const adminId = req.session.user.id

    const adminUser = await col('users').findOne({ id: adminId })
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền soát vé.' })
    }

    const booking = await col('bookings').findOne({ id })
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy vé.' })
    if (booking.status !== 'SUCCESS') return res.status(400).json({ error: 'Vé chưa được thanh toán thành công.' })

    const result = await col('bookings').updateOne(
      { id, checkin_status: { $ne: 'USED' } },
      {
        $set: {
          checkin_status: 'USED',
          checked_in_at: new Date(),
          checked_in_by: adminId,
        },
      },
    )

    if (result.matchedCount === 0) {
      return res.status(409).json({ error: 'Vé này đã được sử dụng trước đó.' })
    }

    res.json({ success: true, message: 'Soát vé thành công!' })
  }),
)

export default router
