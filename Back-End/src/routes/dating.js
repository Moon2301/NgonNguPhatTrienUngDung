import express from 'express'
import { z } from 'zod'
import { col, nextId } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.user.id
    let prof = await col('dating_profiles').findOne({ user_id: userId })
    if (!prof) {
      const id = await nextId('dating_profiles')
      prof = { id, user_id: userId, is_active: false, created_at: new Date() }
      await col('dating_profiles').insertOne(prof)
    }
    res.json({ profile: prof })
  }),
)

router.post(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.user.id
    const schema = z.object({
      displayName: z.string().min(1).max(50),
      age: z.coerce.number().int().min(18).max(99),
      height: z.coerce.number().min(100).max(250),
      hometown: z.string().min(1).max(255),
      bio: z.string().optional().nullable(),
      maritalStatus: z.string().min(1).max(50),
      avatarUrl: z.string().min(1),
      photo1: z.string().optional().nullable(),
      photo2: z.string().optional().nullable(),
      photo3: z.string().optional().nullable(),
      photo4: z.string().optional().nullable(),
      isActive: z.coerce.boolean().optional(),
    })
    const input = schema.parse(req.body)

    const update = {
      display_name: input.displayName,
      age: input.age,
      height: input.height,
      hometown: input.hometown,
      bio: input.bio ?? null,
      marital_status: input.maritalStatus,
      avatar_url: input.avatarUrl,
      photo_1: input.photo1 ?? null,
      photo_2: input.photo2 ?? null,
      photo_3: input.photo3 ?? null,
      photo_4: input.photo4 ?? null,
      is_active: input.isActive ?? true,
      updated_at: new Date(),
    }

    const existing = await col('dating_profiles').findOne({ user_id: userId }, { projection: { id: 1 } })
    if (!existing) {
      const id = await nextId('dating_profiles')
      const doc = { id, user_id: userId, ...update, created_at: new Date() }
      await col('dating_profiles').insertOne(doc)
      return res.json({ profile: doc })
    }

    await col('dating_profiles').updateOne({ user_id: userId }, { $set: update })
    const prof = await col('dating_profiles').findOne({ user_id: userId })
    return res.json({ profile: prof })
  }),
)

export default router

