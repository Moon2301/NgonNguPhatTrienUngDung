import express from 'express'
import { z } from 'zod'
import { col, nextId } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get(
  '/movie/:movieId',
  asyncHandler(async (req, res) => {
    const movieId = Number(req.params.movieId)
    const comments = await col('comments').find({ movie_id: movieId }).sort({ created_at: -1, id: -1 }).toArray()
    const userIds = [...new Set(comments.map((c) => c.user_id).filter((x) => x != null))]
    const users = userIds.length
      ? await col('users').find({ id: { $in: userIds } }, { projection: { id: 1, username: 1, fullName: 1 } }).toArray()
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))
    res.json({
      comments: comments.map((c) => {
        const u = userMap.get(c.user_id)
        return {
          id: c.id,
          content: c.content,
          rating: c.rating,
          createdAt: c.created_at,
          userId: c.user_id,
          fullName: u?.fullName ?? null,
          username: u?.username ?? null,
        }
      }),
    })
  }),
)

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      movieId: z.coerce.number(),
      content: z.string().min(1).max(5000),
      rating: z.coerce.number().int().min(1).max(5),
    })
    const input = schema.parse(req.body)
    const userId = req.session.user.id

    const id = await nextId('comments')
    await col('comments').insertOne({
      id,
      movie_id: input.movieId,
      user_id: userId,
      content: input.content.trim(),
      rating: input.rating,
      created_at: new Date(),
    })
    res.status(201).json({ id })
  }),
)

export default router

