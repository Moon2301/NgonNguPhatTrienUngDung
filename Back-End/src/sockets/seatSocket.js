import {
  holdSeats,
  releaseSeats,
  releaseAllForSocket,
  getHeldEntriesLive,
  getHeldSeatsLive,
  isHeldByOther,
  cleanupAllExpired,
} from '../services/seatHolds.js'

export { getHeldSeatsLive, getHeldEntriesLive }

const MAX_SEATS_PER_USER = 8
const CLEANUP_INTERVAL_MS = 5_000

export function registerSeatSocket(io) {
  io.on('connection', (socket) => {
    let currentShowtimeId = null

    const getUser = () => socket.request.session?.user

    function broadcastHolds(showtimeId) {
      const sid = String(showtimeId)
      const holds = getHeldEntriesLive(showtimeId)
      io.to(`showtime:${sid}`).emit('showtime:holds', {
        showtimeId: Number(showtimeId),
        holds,
      })
    }

    socket.on('showtime:join', (payload) => {
      const showtimeId = payload?.showtimeId ?? payload
      if (currentShowtimeId) {
        socket.leave(`showtime:${currentShowtimeId}`)
      }
      currentShowtimeId = String(showtimeId)
      socket.join(`showtime:${currentShowtimeId}`)
      broadcastHolds(currentShowtimeId)
    })

    socket.on('seat:hold', (payload) => {
      const user = getUser()
      if (!user) {
        socket.emit('error', { message: 'Bạn cần đăng nhập để chọn ghế.' })
        return
      }

      const showtimeId = payload?.showtimeId ?? currentShowtimeId
      if (!showtimeId) return

      const seats = Array.isArray(payload?.seats) ? payload.seats : [payload?.seats].filter(Boolean)
      if (!seats.length) return

      const currentHolds = getHeldEntriesLive(showtimeId)
      const userHoldCount = currentHolds.filter((h) => Number(h.userId) === Number(user.id)).length

      if (userHoldCount + seats.length > MAX_SEATS_PER_USER) {
        socket.emit('error', { message: `Bạn không thể giữ quá ${MAX_SEATS_PER_USER} ghế cùng lúc.` })
        return
      }

      const conflict = seats.find((s) => isHeldByOther(showtimeId, s, user.id))
      if (conflict) {
        socket.emit('error', { message: `Ghế ${conflict} đang được người khác giữ.` })
        return
      }

      holdSeats({ showtimeId, seats, userId: user.id, socketId: socket.id })
      broadcastHolds(showtimeId)
    })

    socket.on('seat:release', (payload) => {
      const user = getUser()
      const showtimeId = payload?.showtimeId ?? currentShowtimeId
      if (!showtimeId) return

      const seats = Array.isArray(payload?.seats) ? payload.seats : [payload?.seats].filter(Boolean)
      if (!seats.length) return

      releaseSeats({ showtimeId, seats, userId: user?.id, socketId: socket.id })
      broadcastHolds(showtimeId)
    })

    socket.on('disconnect', () => {
      const affected = releaseAllForSocket(socket.id)
      for (const sid of affected) {
        const holds = getHeldEntriesLive(sid)
        io.to(`showtime:${sid}`).emit('showtime:holds', {
          showtimeId: Number(sid),
          holds,
        })
      }
    })
  })

  setInterval(() => {
    const changed = cleanupAllExpired()
    for (const sid of changed) {
      const holds = getHeldEntriesLive(sid)
      io.to(`showtime:${sid}`).emit('showtime:holds', {
        showtimeId: Number(sid),
        holds,
      })
    }
  }, CLEANUP_INTERVAL_MS)
}
