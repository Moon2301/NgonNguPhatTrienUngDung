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

import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { col, nextId } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { parseSeats, uniqueSeats } from '../utils/seats.js';
import { getSeatStatesForShowtime, getSeatHoldMs } from '../services/showtimeSeatmap.js';
import { areAdjacent, leavesLoneSeat } from '../utils/bookingValidation.js';
import { sendTicketEmail } from '../services/emailService.js';

const router = express.Router();

router.get(
    '/showtimes/:id/seatmap',
    asyncHandler(async (req, res) => {
        const showtimeId = Number(req.params.id);
        const showtime = await col('showtimes').findOne({ id: showtimeId });
        if (!showtime) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' });

        const [movie, room] = await Promise.all([
            showtime.movie_id != null ? col('movies').findOne({ id: showtime.movie_id }, { projection: { title: 1 } }) : null,
            showtime.room_id != null ? col('rooms').findOne({ id: showtime.room_id }, { projection: { name: 1, total_rows: 1, total_cols: 1 } }) : null,
        ]);

        const { bookedSeats, heldSeats, occupiedSeats, myBookedSeats } = await getSeatStatesForShowtime(
            showtimeId,
            req.session?.user?.id
        );
        const products = await col('products')
            .find({ $or: [{ active: true }, { active: { $exists: false } }] }, { projection: { _id: 0 } })
            .sort({ id: -1 })
            .toArray();

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
        });

    })
);

router.post(
    '/confirm',
    asyncHandler(async (req, res) => {
        const schema = z.object({
            showtimeId: z.coerce.number(),
            seats: z.array(z.string()),
            seatSocketId: z.string().optional().nullable(),
            promoCode: z.string().optional().nullable(),
            customerName: z.string().min(1).max(255),
            customerEmail: z.string().email().max(255),
            customerPhone: z.string().optional().nullable(),
            products: z
                .array(
                    z.object({
                        id: z.coerce.number(),
                        qty: z.coerce.number().int().min(0),
                    })
                )
                .optional(),
            paymentMethod: z.enum(['VNPAY', 'CASH']),
            returnUrl: z.string().optional().nullable(),
        });

        const input = schema.parse(req.body);
        const showtimeId = input.showtimeId;
        const userId = req.session?.user?.id;

        if (!userId) return res.status(401).json({ error: 'Bạn cần đăng nhập để đặt vé.' });

        const showtime = await col('showtimes').findOne({ id: showtimeId });
        if (!showtime) return res.status(404).json({ error: 'Suất chiếu không tồn tại.' });

        // TIME CHECKS
        const now = new Date();
        const startTime = new Date(showtime.start_time);
        const fifteenMinsBefore = new Date(startTime.getTime() - 15 * 60000);

        if (now > startTime) return res.status(400).json({ error: 'Suất chiếu đã bắt đầu hoặc đã kết thúc.' });
        if (now > fifteenMinsBefore) return res.status(400).json({ error: 'Đã quá thời hạn đặt vé trực tuyến (15 phút trước giờ chiếu).' });

        // ANTI-SPAM (Max 5 bookings per day)
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60000);
        const dailyCount = await col('bookings').countDocuments({ user_id: userId, booking_time: { $gt: dayAgo } });
        if (dailyCount >= 5) return res.status(429).json({ error: 'Bạn đã đạt giới hạn đặt vé trong ngày (tối đa 5 lần).' });

        // SEAT VALIDATIONS
        const room = await col('rooms').findOne({ id: showtime.room_id });
        if (!room) return res.status(500).json({ error: 'Dữ liệu phòng chiếu bị lỗi.' });

        if (!areAdjacent(input.seats)) {
            return res.status(400).json({ error: 'Các ghế được chọn phải nằm cạnh nhau trong cùng một hàng.' });
        }

        const { occupiedSeats } = await getSeatStatesForShowtime(showtimeId);
        const conflict = input.seats.some((s) => occupiedSeats.includes(s));
        if (conflict) return res.status(409).json({ error: 'Một số ghế đã bị chọn bởi người khác.' });

        // LONE SEAT CHECK (Check each row in the selection)
        const rowsInSelection = [...new Set(input.seats.map(s => s.charAt(0)))];
        for (const rId of rowsInSelection) {
            const selectedColsInRow = input.seats
                .filter(s => s.startsWith(rId))
                .map(s => parseInt(s.substring(1)));
            const rowOccupiedCols = occupiedSeats
                .filter(s => s.startsWith(rId))
                .map(s => parseInt(s.substring(1)));

            if (leavesLoneSeat(rId, selectedColsInRow, rowOccupiedCols, room.total_cols || 10)) {
                return res.status(400).json({ error: `Không được để ghế trống đơn lẻ ở hàng ${rId}.` });
            }
        }


        const status = input.paymentMethod === 'VNPAY' ? 'PENDING' : 'SUCCESS';
        const seatAmount = input.seats.length * Number(showtime.price || 0);

        let productAmount = 0;
        const productSnapshots = [];
        if (input.products && input.products.length > 0) {
            const pIds = input.products.map((p) => p.id);
            const dbProducts = await col('products').find({ id: { $in: pIds } }).toArray();
            const pMap = new Map(dbProducts.map((p) => [p.id, p]));

            for (const pInput of input.products) {
                const dbP = pMap.get(pInput.id);
                if (dbP && pInput.qty > 0) {
                    const price = Number(dbP.price || 0);
                    productAmount += price * pInput.qty;
                    productSnapshots.push({
                        id: dbP.id,
                        name: dbP.name,
                        price: price,
                        qty: pInput.qty,
                    });
                }
            }
        }

        let promoDiscount = 0;
        let appliedPromo = null;
        if (input.promoCode) {
            const promo = await col('promotions').findOne({ code: input.promoCode, active: true });
            if (promo) {
                if (promo.end_date && new Date(promo.end_date) < now) {
                    // ignore
                } else if (promo.min_order_value && (seatAmount + productAmount) < promo.min_order_value) {
                    // ignore
                } else {
                    promoDiscount = Number(promo.discount_value || 0);
                    appliedPromo = promo.code;
                }
            }
        }

        const totalAmount = Math.max(0, seatAmount + productAmount - promoDiscount);
        const bookingId = await nextId('bookings');

        await col('bookings').insertOne({
            id: bookingId,
            user_id: userId,
            showtime_id: showtimeId,
            customer_name: input.customerName,
            customer_email: input.customerEmail,
            customer_phone: input.customerPhone,
            seat_numbers: input.seats.join(','),
            total_amount: totalAmount,
            booking_time: new Date(),
            status: status,
            payment_method: input.paymentMethod,
            payment_status: status,
            promo_code: appliedPromo,
            promo_discount: promoDiscount,
            products: productSnapshots,
        });

        if (input.paymentMethod === 'VNPAY') {
            const r = await fetch(`${process.env.INTERNAL_API_BASE || `http://localhost:${process.env.PORT || 4000}`}/api/payments/vnpay/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId,
                    amount: totalAmount,
                    orderInfo: `Thanh toán booking #${bookingId}`,
                    returnUrl: input.returnUrl,
                }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) return res.status(r.status).json({ error: d.error || 'Không tạo được URL thanh toán.' });
            return res.status(201).json({ bookingId, paymentUrl: d.url });
        }

        // For Cash/Balance, if success - send email immediately (async)
        if (status === 'SUCCESS') {
            const [movie, room] = await Promise.all([
                col('movies').findOne({ id: showtime.movie_id }),
                col('rooms').findOne({ id: showtime.room_id })
            ]);
            const bookingForEmail = await col('bookings').findOne({ id: bookingId });
            if (movie && room && bookingForEmail) {
                sendTicketEmail(bookingForEmail, movie, showtime, room).catch(err => {
                    console.error('[EMAIL] Failed to send initial ticket email:', err);
                });
            }
        }

        res.json({ bookingId, status });
    })
);

router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
        const userId = req.session.user.id;
        const now = new Date();

        // Fetch all non-failed, non-transferred bookings
        const bookings = await col('bookings')
            .find({ user_id: userId, status: { $nin: ['FAILED', 'CANCELLED', 'TRANSFERRED'] } })
            .sort({ booking_time: -1 })
            .toArray();

        // Batch fetch showtimes
        const stIds = [...new Set(bookings.map((b) => b.showtime_id))];
        const showtimes = await col('showtimes').find({ id: { $in: stIds } }).toArray();
        const stMap = new Map(showtimes.map((s) => [s.id, s]));

        // Batch fetch movies & rooms
        const mvIds = [...new Set(showtimes.map((s) => s.movie_id))];
        const movies = await col('movies').find({ id: { $in: mvIds } }).toArray();
        const mvMap = new Map(movies.map((m) => [m.id, m]));

        const rmIds = [...new Set(showtimes.map((s) => s.room_id))];
        const rooms = await col('rooms').find({ id: { $in: rmIds } }).toArray();
        const rmMap = new Map(rooms.map((r) => [r.id, r]));

        const result = bookings.map((b) => {
            const st = stMap.get(b.showtime_id);
            const mv = st ? mvMap.get(st.movie_id) : null;
            const rm = st ? rmMap.get(st.room_id) : null;

            // Calculate Dynamic Status
            let ticketStatus = 'PAST';
            if (st && st.start_time) {
                const startTime = new Date(st.start_time);
                // End time = start + duration (default 120m)
                const endTime = new Date(startTime.getTime() + (mv?.duration || 120) * 60000);

                if (now < startTime) {
                    ticketStatus = 'UPCOMING';
                } else if (now >= startTime && now <= endTime) {
                    ticketStatus = 'LIVE';
                }
            }

            return {
                ...b,
                movieTitle: mv?.title || 'Phim không tên',
                posterUrl: mv?.poster_url || null,
                duration: mv?.duration || 120,
                roomName: rm?.name || 'Phòng chiếu',
                start_time: st?.start_time || null,
                originalPrice: Number(st?.price || 0),
                ticketStatus: ticketStatus, // New field for UI tabs/badges
            };
        });

        // Enrichment: Mark which seats are already listed for sale
        const finalResults = await Promise.all(result.map(async (b) => {
            const listed = await col('ticket_passes').find({ 
                booking_id: b.id, 
                status: 'AVAILABLE' 
            }).toArray();
            return {
                ...b,
                listedSeats: listed.map(l => l.seat_number)
            };
        }));

        res.json({ bookings: finalResults });
    })
);

router.get(
    '/public/:id',
    asyncHandler(async (req, res) => {
        const bookingId = Number(req.params.id);
        const booking = await col('bookings').findOne({ id: bookingId });
        if (!booking) return res.status(404).json({ error: 'Vé không tồn tại.' });

        const st = await col('showtimes').findOne({ id: booking.showtime_id });
        const mv = st ? await col('movies').findOne({ id: st.movie_id }) : null;
        const rm = st ? await col('rooms').findOne({ id: st.room_id }) : null;

        res.json({
            id: booking.id,
            movieTitle: mv?.title || 'Phim không tên',
            posterUrl: mv?.poster_url || null,
            duration: mv?.duration || 120,
            roomName: rm?.name || 'Phòng chiếu',
            start_time: st?.start_time || null,
            seat_numbers: booking.seat_numbers,
            customer_name: booking.customer_name,
            total_amount: booking.total_amount,
            status: booking.status,
            booking_time: booking.booking_time
        });
    })
);

router.post(
    '/:id/resend-email',
    requireAuth,
    asyncHandler(async (req, res) => {
        const userId = req.session.user.id;
        const bookingId = Number(req.params.id);
        const booking = await col('bookings').findOne({ id: bookingId });

        if (!booking) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
        if (booking.user_id !== userId) return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này.' });

        // Real email sending
        const showtime = await col('showtimes').findOne({ id: booking.showtime_id });
        if (!showtime) return res.status(404).json({ error: 'Không tìm thấy thông tin suất chiếu.' });

        const [movie, room] = await Promise.all([
            col('movies').findOne({ id: showtime.movie_id }),
            col('rooms').findOne({ id: showtime.room_id })
        ]);

        if (!movie || !room) return res.status(500).json({ error: 'Dữ liệu phim hoặc phòng chiếu bị thiếu.' });

        try {
            await sendTicketEmail(booking, movie, showtime, room);
            res.json({ message: 'Đã gửi lại vé vào email ' + booking.customer_email + ' thành công!' });
        } catch (error) {
            res.status(500).json({ error: 'Gửi email thất bại: ' + error.message });
        }
    })
);


router.post(
    '/apply-promo',
    asyncHandler(async (req, res) => {
        const { code, amount } = req.body;
        if (!code) return res.status(400).json({ error: 'Mã không hợp lệ' });

        const promo = await col('promotions').findOne({ code, active: true });
        if (!promo) return res.status(404).json({ error: 'Mã không tồn tại hoặc đã hết hạn.' });

        const now = new Date();
        if (promo.end_date && new Date(promo.end_date) < now) {
            return res.status(400).json({ error: 'Mã đã hết hạn.' });
        }
        if (promo.min_order_value && amount < promo.min_order_value) {
            return res.status(400).json({ error: `Đơn hàng tối thiểu ${promo.min_order_value.toLocaleString()}đ để dùng mã này.` });
        }

        res.json({
            code: promo.code,
            discountValue: promo.discount_value,
        });
    })
);

export default router;
