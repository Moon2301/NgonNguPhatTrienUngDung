import { holdSeats, releaseAllForSocket, releaseSeats, cleanupAllExpired, getHeldEntriesLive } from '../services/seatHolds.js'
import { uniqueSeats } from '../utils/seats.js'

function roomKey(showtimeId) {
  return `showtime:${Number(showtimeId)}`
}

export function registerSeatSocket(io, sessionMiddleware) {
  // Share express-session with socket.io
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next)
  })

  // Periodic cleanup (memory safety)
  setInterval(() => cleanupAllExpired(), 30 * 1000).unref?.()

  io.on('connection', (socket) => {
    socket.on('showtime:join', (payload = {}) => {
      const showtimeId = Number(payload.showtimeId)
      if (!Number.isFinite(showtimeId) || showtimeId <= 0) return
      socket.join(roomKey(showtimeId))
      io.to(socket.id).emit('showtime:holds', { showtimeId, holds: getHeldEntriesLive(showtimeId) })
    })

    socket.on('seat:hold', (payload = {}) => {
      const u = socket.request?.session?.user
      const showtimeId = Number(payload.showtimeId)
      const seats = uniqueSeats(payload.seats || [])
      if (!Number.isFinite(showtimeId) || showtimeId <= 0 || !seats.length) return
      holdSeats({ showtimeId, seats, userId: u?.id || 0, socketId: socket.id })
      io.to(roomKey(showtimeId)).emit('showtime:holds', { showtimeId, holds: getHeldEntriesLive(showtimeId) })
    })

    socket.on('seat:release', (payload = {}) => {
      const u = socket.request?.session?.user
      const showtimeId = Number(payload.showtimeId)
      const seats = uniqueSeats(payload.seats || [])
      if (!Number.isFinite(showtimeId) || showtimeId <= 0 || !seats.length) return
      releaseSeats({ showtimeId, seats, userId: u?.id || 0, socketId: socket.id })
      io.to(roomKey(showtimeId)).emit('showtime:holds', { showtimeId, holds: getHeldEntriesLive(showtimeId) })
    })

    socket.on('disconnect', () => {
      releaseAllForSocket(socket.id)
    })
  })
}

