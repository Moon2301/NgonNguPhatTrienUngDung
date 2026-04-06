import express from 'express'
import { z } from 'zod'
import { col, toId } from '../db.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

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

export default router

