import express from 'express'
import { z } from 'zod'
import { col, toId } from '../db.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      movieId: z.coerce.number().optional(),
    })
    const { movieId } = schema.parse(req.query)

    const match = movieId != null ? { movie_id: movieId } : {}
    const showtimes = await col('showtimes').find(match).sort({ start_time: 1 }).toArray()

    const movieIds = [...new Set(showtimes.map((s) => s.movie_id).filter((x) => x != null))]
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]

    const [movies, rooms] = await Promise.all([
      movieIds.length ? col('movies').find({ id: { $in: movieIds } }, { projection: { id: 1, title: 1 } }).toArray() : [],
      roomIds.length ? col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray() : [],
    ])

    const movieMap = new Map(movies.map((m) => [m.id, m.title]))
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]))

    const rows = showtimes.map((s) => ({
      ...toId(s),
      movieTitle: movieMap.get(s.movie_id) || null,
      roomName: roomMap.get(s.room_id) || null,
    }))

    res.json({ showtimes: rows })
  }),
)

export default router

