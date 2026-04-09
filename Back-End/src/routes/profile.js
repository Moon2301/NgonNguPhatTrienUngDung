import express from 'express'
import { z } from 'zod'
import { col } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.user.id
    const u = await col('users').findOne(
      { id: userId },
      { projection: { _id: 0, passwordHash: 0 } },
    )
    if (!u) return res.status(404).json({ error: 'Không tìm thấy user.' })
    return res.json({ profile: u })
  }),
)

router.put(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.user.id

    const schema = z.object({
      fullName: z.string().min(1).max(255),
      age: z.coerce.number().int().min(1).max(120).optional().nullable(),
      phone: z.string().min(3).max(30).optional().nullable(),
      email: z.string().email().max(255),
    })
    const input = schema.parse(req.body)

    const $set = {
      fullName: input.fullName,
      age: input.age ?? null,
      phone: input.phone ?? null,
      email: input.email,
      updatedAt: new Date(),
    }

    // check unique email (allow self)
    const existingEmail = await col('users').findOne(
      { email: input.email, id: { $ne: userId } },
      { projection: { id: 1 } },
    )
    if (existingEmail) return res.status(409).json({ error: 'Email đã được sử dụng!' })

    await col('users').updateOne({ id: userId }, { $set })
    const u = await col('users').findOne({ id: userId }, { projection: { _id: 0, passwordHash: 0 } })
    if (!u) return res.status(404).json({ error: 'Không tìm thấy user.' })

    // sync session
    req.session.user = {
      ...req.session.user,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone ?? null,
      age: u.age ?? null,
      wallet: u.wallet ?? 0,
    }

    return res.json({ profile: u, user: req.session.user })
  }),
)

export default router

