import express from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.post(
  '/avatar',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      filename: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(100),
      dataUrl: z.string().min(1),
    })
    const input = schema.parse(req.body)

    // Minimal implementation: accept data URL and return it as "url".
    // (Code-EX uploads to Google Drive; here we keep it local/test-friendly.)
    if (!input.dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Chỉ hỗ trợ data URL ảnh.' })
    }

    return res.json({ url: input.dataUrl })
  }),
)

export default router

