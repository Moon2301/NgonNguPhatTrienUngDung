import express from 'express'
import { z } from 'zod'
import { col, nextId, toId } from '../db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

router.get('/showtimes/:id/comments', asyncHandler(async (req, res) => {
  const rows = await col('comments')
    .find({ showtimeId: Number(req.params.id) })
    .sort({ createdAt: -1 })
    .toArray()
  res.json({ comments: rows.map(toId) })
}))

router.post('/showtimes/:id/comments', requireAuth, asyncHandler(async (req, res) => {
  const schema = z.object({
    content: z.string().min(1).max(1000),
  })
  const input = schema.parse(req.body)
  const user = req.session.user

  const showtime = await col('showtimes').findOne(
    { id: Number(req.params.id) },
    { projection: { id: 1 } },
  )
  if (!showtime) return res.status(404).json({ error: 'Suất chiếu không tồn tại.' })

  const doc = {
    id: await nextId('comments'),
    showtimeId: Number(req.params.id),
    userId: user.id,
    username: user.username,
    content: input.content,
    createdAt: new Date(),
  }
  await col('comments').insertOne(doc)
  res.status(201).json({ comment: toId(doc) })
}))

router.delete('/comments/:id', requireAuth, asyncHandler(async (req, res) => {
  const comment = await col('comments').findOne(
    { id: Number(req.params.id) },
    { projection: { id: 1, userId: 1 } },
  )
  if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận.' })
  if (comment.userId !== req.session.user.id && req.session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Không có quyền xóa.' })
  }
  await col('comments').deleteOne({ id: Number(req.params.id) })
  res.json({ success: true })
}))

export default router
