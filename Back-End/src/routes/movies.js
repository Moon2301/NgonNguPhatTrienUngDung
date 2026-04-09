import express from 'express'
import { z } from 'zod'
import { col, toId } from '../db.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get(
  '/upcoming',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const rows = await col('movies')
      .find({ release_date: { $type: 'date', $gt: now } })
      .sort({ release_date: 1 })
      .toArray()
    res.json({ movies: rows.map(toId) })
  }),
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      genre: z.string().optional(),
      keyword: z.string().optional(),
    })
    const { genre, keyword } = schema.parse(req.query)

    if (keyword && keyword.trim()) {
      const q = String(keyword).trim()
      const rows = await col('movies')
        .find({ title: { $regex: q, $options: 'i' } })
        .sort({ id: -1 })
        .toArray()
      return res.json({ movies: rows.map(toId) })
    }

    if (genre && genre.trim()) {
      const g = String(genre).trim()
      const rows = await col('movies')
        .find({ genre: { $regex: g, $options: 'i' } })
        .sort({ id: -1 })
        .toArray()
      return res.json({ movies: rows.map(toId) })
    }

    const rows = await col('movies').find({}).sort({ id: -1 }).toArray()
    return res.json({ movies: rows.map(toId) })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const movie = await col('movies').findOne({ id })
    if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim.' })

    const showtimes = await col('showtimes').find({ movie_id: id }).sort({ start_time: 1 }).toArray()
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]
    const rooms = roomIds.length
      ? await col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray()
      : []
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]))
    const stOut = showtimes.map((s) => ({ ...toId(s), roomName: roomMap.get(s.room_id) || null }))

    return res.json({ movie: toId(movie), showtimes: stOut })
  }),
)

export default router

