const express = require('express')
const { z } = require('zod')
const { google } = require('googleapis')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

function getDriveClient() {
  // Preferred: OAuth refresh token (user account)
  const clientId = process.env.GDRIVE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GDRIVE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GDRIVE_OAUTH_REFRESH_TOKEN

  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return google.drive({ version: 'v3', auth: oauth2 })
  }

  // Fallback: Service Account
  const credsB64 = process.env.GDRIVE_SERVICE_ACCOUNT_B64
  if (!credsB64) {
    throw Object.assign(
      new Error('Thiếu cấu hình Google Drive. Cần GDRIVE_OAUTH_* hoặc GDRIVE_SERVICE_ACCOUNT_B64.'),
      { status: 500 }
    )
  }
  let creds
  try {
    creds = JSON.parse(Buffer.from(credsB64, 'base64').toString('utf8'))
  } catch {
    throw Object.assign(new Error('GDRIVE_SERVICE_ACCOUNT_B64 không hợp lệ (không parse được JSON).'), { status: 500 })
  }

  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive'] })
  return google.drive({ version: 'v3', auth })
}

function extFromMime(mime) {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return null
}

router.post(
  '/avatar',
  requireAuth,
  async (req, res, next) => {
    try {
      const schema = z.object({
        filename: z.string().min(1).max(200).optional(),
        mimeType: z.string().min(1).max(200),
        dataUrl: z.string().min(10),
      })
      const input = schema.parse(req.body)

      const folderId = process.env.GDRIVE_AVATAR_FOLDER_ID
      if (!folderId) {
        return res.status(500).json({ error: 'Thiếu GDRIVE_AVATAR_FOLDER_ID.' })
      }

      const ext = extFromMime(input.mimeType)
      if (!ext) return res.status(400).json({ error: 'Chỉ hỗ trợ ảnh JPG/PNG/WebP.' })

      const m = String(input.dataUrl).match(/^data:([^;]+);base64,(.+)$/)
      if (!m) return res.status(400).json({ error: 'Dữ liệu ảnh không hợp lệ.' })
      const mime = m[1]
      const b64 = m[2]
      if (mime !== input.mimeType) return res.status(400).json({ error: 'MIME không khớp.' })

      const buf = Buffer.from(b64, 'base64')
      const maxBytes = 3 * 1024 * 1024
      if (buf.length > maxBytes) return res.status(413).json({ error: 'Ảnh quá lớn (tối đa 3MB).' })

      const userId = req.session.user.id
      const safeName = (input.filename || 'avatar')
        .replace(/[^\w.\-]+/g, '_')
        .slice(0, 80)
      const driveName = `avatar_u${userId}_${Date.now()}_${safeName}.${ext}`

      const drive = getDriveClient()

      const createRes = await drive.files.create({
        requestBody: {
          name: driveName,
          parents: [folderId],
        },
        media: {
          mimeType: input.mimeType,
          body: require('stream').Readable.from(buf),
        },
        fields: 'id',
      })

      const fileId = createRes.data.id
      if (!fileId) throw new Error('Upload Drive thất bại.')

      // Anyone with link can view
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      })

      const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`
      res.json({ url: directUrl, fileId })
    } catch (e) {
      next(e)
    }
  }
)

module.exports = router

