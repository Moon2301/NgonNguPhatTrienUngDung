import express from 'express'
import { col } from '../db.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await col('news')
      .find({ active: true }, { projection: { _id: 0 } })
      .sort({ published_at: -1, id: -1 })
      .toArray()
    res.json({
      news: rows.map((n) => ({
        ...n,
        imageUrl: n.image_url ?? n.imageUrl ?? null,
        publishedAt: n.published_at ?? n.publishedAt ?? null,
      })),
    })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const article = await col('news').findOne({ id, active: true }, { projection: { _id: 0 } })
    if (!article) return res.status(404).json({ error: 'Không tìm thấy tin.' })
    res.json({
      article: {
        ...article,
        imageUrl: article.image_url ?? article.imageUrl ?? null,
        publishedAt: article.published_at ?? article.publishedAt ?? null,
      },
    })
  }),
)

export default router

