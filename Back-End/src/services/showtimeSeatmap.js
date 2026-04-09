import { col } from '../db.js'
import { parseSeats, uniqueSeats } from '../utils/seats.js'
import { getHeldSeatsLive } from './seatHolds.js'

/** Thời gian giữ ghế (VNPay PENDING) trước khi coi như trả chỗ. */
export const SEAT_HOLD_MS = 5 * 60 * 1000

/**
 * @returns {{ bookedSeats: string[], heldSeats: string[], occupiedSeats: string[] }}
 */
export async function getSeatStatesForShowtime(showtimeId) {
  const cutoff = Date.now() - SEAT_HOLD_MS
  const rows = await col('bookings')
    .find(
      { showtime_id: showtimeId, status: { $nin: ['FAILED', 'CANCELLED'] } },
      { projection: { seat_numbers: 1, status: 1, booking_time: 1 } },
    )
    .toArray()

  const booked = new Set()
  const held = new Set(getHeldSeatsLive(showtimeId))

  for (const b of rows) {
    const seats = parseSeats(b.seat_numbers || '')
    const st = b.status
    if (st === 'PENDING') {
      const t = b.booking_time ? new Date(b.booking_time).getTime() : 0
      if (t < cutoff) continue
      for (const s of seats) held.add(s)
    } else {
      for (const s of seats) booked.add(s)
    }
  }

  const bookedSeats = uniqueSeats([...booked])
  const heldSeats = uniqueSeats([...held])
  const occupiedSeats = uniqueSeats([...bookedSeats, ...heldSeats])
  return { bookedSeats, heldSeats, occupiedSeats }
}
