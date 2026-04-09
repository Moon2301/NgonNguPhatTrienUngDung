import { getSeatHoldMs } from './showtimeSeatmap.js'
import { uniqueSeats } from '../utils/seats.js'

/**
 * In-memory seat holds keyed by showtime.
 *
 * Map<showtimeId, Map<seatId, { userId: number, socketId: string, expiresAt: number }>>
 */
const holdsByShowtime = new Map()

function nowMs() {
  return Date.now()
}

function getShowtimeMap(showtimeId) {
  const key = Number(showtimeId)
  let m = holdsByShowtime.get(key)
  if (!m) {
    m = new Map()
    holdsByShowtime.set(key, m)
  }
  return m
}

export function cleanupExpired(showtimeId) {
  const m = holdsByShowtime.get(Number(showtimeId))
  if (!m) return
  const now = nowMs()
  for (const [seat, v] of m.entries()) {
    if (!v || v.expiresAt <= now) m.delete(seat)
  }
  if (!m.size) holdsByShowtime.delete(Number(showtimeId))
}

export function cleanupAllExpired() {
  for (const key of holdsByShowtime.keys()) cleanupExpired(key)
}

export function getHeldSeatsLive(showtimeId) {
  cleanupExpired(showtimeId)
  const m = holdsByShowtime.get(Number(showtimeId))
  if (!m) return []
  return uniqueSeats([...m.keys()])
}

export function getHeldEntriesLive(showtimeId) {
  cleanupExpired(showtimeId)
  const m = holdsByShowtime.get(Number(showtimeId))
  if (!m) return []
  return [...m.entries()].map(([seat, v]) => ({ seat, ...v }))
}

export function holdSeats({ showtimeId, seats, userId, socketId }) {
  const sid = Number(showtimeId)
  const m = getShowtimeMap(sid)
  const exp = nowMs() + getSeatHoldMs()
  const seatList = uniqueSeats(seats || [])
  for (const s of seatList) {
    m.set(String(s), { userId: Number(userId), socketId: String(socketId), expiresAt: exp })
  }
  return getHeldSeatsLive(sid)
}

export function releaseSeats({ showtimeId, seats, userId, socketId }) {
  cleanupExpired(showtimeId)
  const sid = Number(showtimeId)
  const m = holdsByShowtime.get(sid)
  if (!m) return []
  const seatList = uniqueSeats(seats || [])
  for (const s of seatList) {
    const k = String(s)
    const v = m.get(k)
    if (!v) continue
    const sameSocket = socketId && v.socketId === String(socketId)
    const sameUser = userId != null && Number(v.userId) === Number(userId)
    if (sameSocket || sameUser) m.delete(k)
  }
  if (!m.size) holdsByShowtime.delete(sid)
  return getHeldSeatsLive(sid)
}

export function releaseAllForSocket(socketId) {
  const sid = String(socketId)
  for (const [showtimeId, m] of holdsByShowtime.entries()) {
    let changed = false
    for (const [seat, v] of m.entries()) {
      if (v?.socketId === sid) {
        m.delete(seat)
        changed = true
      }
    }
    if (!m.size) holdsByShowtime.delete(showtimeId)
    if (changed) cleanupExpired(showtimeId)
  }
}

