import { col } from '../db.js';
import { parseSeats, uniqueSeats } from '../utils/seats.js';
import { getHeldSeatsLive } from '../sockets/seatSocket.js';

export const SEAT_HOLD_MS = 5 * 60 * 1000;


export async function getSeatStatesForShowtime(showtimeId, currentUserId = null) {
    const cutoff = Date.now() - SEAT_HOLD_MS;
    const rows = await col('bookings')
        .find(
            { showtime_id: showtimeId, status: { $nin: ['FAILED', 'CANCELLED'] } },
            { projection: { seat_numbers: 1, status: 1, booking_time: 1, user_id: 1 } }
        )
        .toArray();

    const booked = new Set();
    const myBooked = new Set();
    const held = new Set(getHeldSeatsLive(showtimeId));

    for (const b of rows) {
        const seats = parseSeats(b.seat_numbers || '');
        const st = b.status;
        const isMine = currentUserId && String(b.user_id) === String(currentUserId);

        if (st === 'PENDING') {
            const t = b.booking_time ? new Date(b.booking_time).getTime() : 0;
            if (t < cutoff) continue;
            for (const s of seats) held.add(s);
        } else {
            for (const s of seats) {
                booked.add(s);
                if (isMine) myBooked.add(s);
            }
        }
    }

    const bookedSeats = uniqueSeats([...booked]);
    const heldSeats = uniqueSeats([...held]);
    const myBookedSeats = uniqueSeats([...myBooked]);
    const occupiedSeats = uniqueSeats([...bookedSeats, ...heldSeats]);
    return { bookedSeats, heldSeats, occupiedSeats, myBookedSeats };
}

