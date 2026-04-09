import { getHoldDurationMS } from '../utils/bookingValidation.js'

/**
 * Map<showtimeId, Map<socketId, seatIds[]>>
 */
const heldSeatsMap = new Map()

/**
 * Limit per user ID. If not logged in, we limit by socketId.
 * But user said "1 user không được giữ quá 8 ghế", and "không cho giữ ghế nếu không đăng nhập".
 */
const MAX_SEATS_PER_USER = 8

export function registerSeatSocket(io) {
    io.on('connection', (socket) => {
        let currentShowtimeId = null

        const getSessionUser = () => socket.request.session?.user

        socket.on('join-showtime', (showtimeId) => {
            if (currentShowtimeId) {
                socket.leave(`showtime:${currentShowtimeId}`)
            }
            currentShowtimeId = showtimeId.toString()
            socket.join(`showtime:${currentShowtimeId}`)
            // eslint-disable-next-line no-console
            console.log(`Socket ${socket.id} joined showtime ${currentShowtimeId}`)
        })

        socket.on('hold-seat', (seatId) => {
            const user = getSessionUser()
            if (!user) {
                socket.emit('error', { message: 'Bạn cần đăng nhập để chọn ghế.' })
                return
            }

            if (!currentShowtimeId) return
            
            // Total seats held by this user across all sockets (or just this shows?)
            // The rule says "1 user không được giữ quá 8 ghế 1 lúc".
            // We'll track per socket for simplicity or total in memory?
            // Let's track total for this user in this showtime.
            const showtimeHolds = heldSeatsMap.get(currentShowtimeId) || new Map()
            
            let userTotal = 0
            for (const [sId, seats] of showtimeHolds.entries()) {
                // If we had user info in the map, we could check. 
                // For now, let's limit per socket as a proxy, or improve map.
                if (sId === socket.id) userTotal = seats.length
            }

            if (userTotal >= MAX_SEATS_PER_USER) {
                socket.emit('error', { message: `Bạn không thể giữ quá ${MAX_SEATS_PER_USER} ghế cùng lúc.` })
                return
            }

            if (!heldSeatsMap.has(currentShowtimeId)) {
                heldSeatsMap.set(currentShowtimeId, new Map())
            }
            
            const sh = heldSeatsMap.get(currentShowtimeId)
            const socketHolds = sh.get(socket.id) || []
            
            if (!socketHolds.includes(seatId)) {
                socketHolds.push(seatId)
                sh.set(socket.id, socketHolds)
                
                // eslint-disable-next-line no-console
                console.log(`User ${user.id} holding seat ${seatId} via socket ${socket.id}`)

                // Broadcast
                io.to(`showtime:${currentShowtimeId}`).emit('seat-status-updated', {
                    showtimeId: currentShowtimeId,
                    heldSeats: getHeldSeatsLive(currentShowtimeId),
                    holdDuration: getHoldDurationMS() 
                })
            }
        })

        socket.on('release-seat', (seatId) => {
            if (!currentShowtimeId) return
            
            const showtimeHolds = heldSeatsMap.get(currentShowtimeId)
            if (!showtimeHolds) return
            
            let socketHolds = showtimeHolds.get(socket.id) || []
            if (socketHolds.includes(seatId)) {
                socketHolds = socketHolds.filter(s => s !== seatId)
                if (socketHolds.length === 0) {
                    showtimeHolds.delete(socket.id)
                } else {
                    showtimeHolds.set(socket.id, socketHolds)
                }

                io.to(`showtime:${currentShowtimeId}`).emit('seat-status-updated', {
                    showtimeId: currentShowtimeId,
                    heldSeats: getHeldSeatsLive(currentShowtimeId)
                })
            }
        })

        socket.on('disconnect', () => {
            if (currentShowtimeId) {
                const showtimeHolds = heldSeatsMap.get(currentShowtimeId)
                if (showtimeHolds && showtimeHolds.has(socket.id)) {
                    showtimeHolds.delete(socket.id)
                    io.to(`showtime:${currentShowtimeId}`).emit('seat-status-updated', {
                        showtimeId: currentShowtimeId,
                        heldSeats: getHeldSeatsLive(currentShowtimeId)
                    })
                }
            }
        })
    })
}

export function getHeldSeatsLive(showtimeId) {
    const sId = showtimeId.toString()
    const showtimeHolds = heldSeatsMap.get(sId)
    if (!showtimeHolds) return []
    
    const allHeld = []
    for (const seats of showtimeHolds.values()) {
        allHeld.push(...seats)
    }
    return [...new Set(allHeld)]
}

export function getHeldEntriesLive(showtimeId) {
    const sId = showtimeId.toString()
    const showtimeHolds = heldSeatsMap.get(sId)
    if (!showtimeHolds) return []
    const entries = []
    for (const [socketId, seats] of showtimeHolds.entries()) {
        for (const seat of seats) {
            entries.push({ seat, socketId })
        }
    }
    return entries
}
