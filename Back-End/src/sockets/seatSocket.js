/**
 * Map<showtimeId, Map<socketId, seatIds[]>>
 */
const heldSeatsMap = new Map()

export function registerSeatSocket(io) {
    io.on('connection', (socket) => {
        let currentShowtimeId = null

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
            if (!currentShowtimeId) return
            
            if (!heldSeatsMap.has(currentShowtimeId)) {
                heldSeatsMap.set(currentShowtimeId, new Map())
            }
            
            const showtimeHolds = heldSeatsMap.get(currentShowtimeId)
            const socketHolds = showtimeHolds.get(socket.id) || []
            
            if (!socketHolds.includes(seatId)) {
                socketHolds.push(seatId)
                showtimeHolds.set(socket.id, socketHolds)
                // eslint-disable-next-line no-console
                console.log(`Socket ${socket.id} holding seat ${seatId} for showtime ${currentShowtimeId}`)
                
                // Broadcast to others in the same showtime

                io.to(`showtime:${currentShowtimeId}`).emit('seat-status-updated', {
                    showtimeId: currentShowtimeId,
                    heldSeats: getHeldSeatsLive(currentShowtimeId)
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
            // eslint-disable-next-line no-console
            console.log(`Socket ${socket.id} disconnected`)
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
    return [...new Set(allHeld)] // Unique seats
}
