import crypto from 'crypto'
import express from 'express'
import { z } from 'zod'
import { col } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseSeats, uniqueSeats } from '../utils/seats.js'

const router = express.Router()

function requireTicketSecret() {
  const s = String(process.env.TICKET_HASH_CODE || '').trim()
  if (!s) {
    const err = new Error('Thiếu cấu hình TICKET_HASH_CODE.')
    // @ts-ignore
    err.status = 500
    throw err
  }
  return s
}

function to20DigitsFromHmac({ secret, message }) {
  const hex = crypto.createHmac('sha256', secret).update(message, 'utf-8').digest('hex')
  const bi = BigInt(`0x${hex}`)
  const mod = 10n ** 20n
  const n = bi % mod
  return n.toString().padStart(20, '0')
}

router.get(
  '/qr',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      bookingId: z.coerce.number().int().min(1),
      seat: z.string().min(1).max(10),
    })
    const input = schema.parse(req.query)

    const booking = await col('bookings').findOne(
      { id: input.bookingId },
      { projection: { id: 1, user_id: 1, status: 1, seat_numbers: 1 } },
    )
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy vé.' })
    if (Number(booking.user_id) !== Number(req.session.user.id)) return res.status(403).json({ error: 'Không có quyền.' })
    if (booking.status !== 'SUCCESS') return res.status(409).json({ error: 'Chỉ tạo QR cho vé đã thanh toán.' })

    const seat = String(input.seat).trim().toUpperCase()
    const seats = uniqueSeats(parseSeats(booking.seat_numbers || ''))
    if (!seats.includes(seat)) return res.status(400).json({ error: 'Ghế không thuộc vé này.' })

    // Vé đang đăng bán/đang bị khoá → không cho tạo QR
    const selling = await col('ticket_passes').findOne(
      { booking_id: booking.id, seat_number: seat, status: { $in: ['AVAILABLE', 'LOCKED'] } },
      { projection: { id: 1 } },
    )
    if (selling) return res.status(409).json({ error: 'Vé đang được đăng bán nên không thể tạo QR.' })

    const secret = requireTicketSecret()
    const ticketKey = `PELE-${booking.id}-${seat}`
    const code20 = to20DigitsFromHmac({ secret, message: ticketKey })
    const payload = `PELE${code20}`
    res.json({ bookingId: booking.id, seat, code: code20, payload })
  }),
)

export default router

