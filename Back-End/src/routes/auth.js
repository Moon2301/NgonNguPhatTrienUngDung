import bcrypt from 'bcryptjs'
import express from 'express'
import { z } from 'zod'
import { col, nextId, toId } from '../db.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

router.get('/me', (req, res) => {
  res.json({ user: req.session?.user || null })
})

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      username: z.string().min(3).max(50),
      password: z.string().min(4).max(100),
      email: z.string().email().max(255),
      fullName: z.string().min(1).max(255),
      phone: z.string().min(3).max(30).optional().or(z.literal('')),
    })
    const input = schema.parse(req.body)

    const existing = await col('users').findOne(
      { $or: [{ username: input.username }, { email: input.email }] },
      { projection: { _id: 1 } },
    )
    if (existing) {
      return res.status(409).json({ error: 'Tên đăng nhập hoặc Email đã được sử dụng!' })
    }

    const passwordHash = await bcrypt.hash(input.password, 10)
    const role = 'USER'

    const doc = {
      id: await nextId('users'),
      username: input.username,
      passwordHash,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone || null,
      age: null,
      role,
      wallet: 0,
      createdAt: new Date(),
    }

    await col('users').insertOne(doc)

    req.session.user = {
      id: doc.id,
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      phone: doc.phone,
      age: doc.age ?? null,
      role,
      wallet: doc.wallet,
    }

    return res.status(201).json({ user: req.session.user })
  }),
)

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    })
    const input = schema.parse(req.body)

    const user = await col('users').findOne(
      { username: input.username },
      { projection: { id: 1, username: 1, passwordHash: 1, email: 1, fullName: 1, phone: 1, age: 1, role: 1, is_blocked: 1, wallet: 1 } },
    )
    if (!user) return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu!' })
    if (user.is_blocked) return res.status(403).json({ error: 'Tài khoản đã bị khóa.' })

    const ok = await bcrypt.compare(input.password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu!' })

    const u = toId(user)
    req.session.user = {
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone ?? null,
      age: u.age ?? null,
      role: u.role,
      wallet: u.wallet ?? 0,
    }
    return res.json({ user: req.session.user })
  }),
)

router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ success: true })
  req.session.destroy(() => res.json({ success: true }))
})

export default router

