import express from 'express'
import { col, toId } from '../db.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await col('promotions').find({ active: { $ne: false } }).sort({ id: -1 }).toArray()
    res.json({ promotions: rows.map(toId) })
  }),
)

export default router

// update