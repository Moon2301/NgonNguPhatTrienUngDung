import express from 'express'
import { z } from 'zod'
import { col, nextId, toId } from '../db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireAdmin } from '../middleware/requireAuth.js'

const router = express.Router()

// ============ CINEMA ============

router.get('/cinemas', asyncHandler(async (req, res) => {
  const rows = await col('cinemas').find({}).sort({ id: 1 }).toArray()
  res.json({ cinemas: rows.map(toId) })
}))

router.post('/cinemas', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
    city: z.string().min(1).max(100),
    phone: z.string().max(30).optional(),
    active: z.boolean().default(true),
  })
  const doc = { id: await nextId('cinemas'), ...schema.parse(req.body) }
  await col('cinemas').insertOne(doc)
  res.status(201).json({ cinema: toId(doc) })
}))

router.put('/cinemas/:id', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
    city: z.string().min(1).max(100),
    phone: z.string().max(30).optional(),
    active: z.boolean(),
  })
  const result = await col('cinemas').findOneAndUpdate(
    { id: Number(req.params.id) },
    { $set: schema.parse(req.body) },
    { returnDocument: 'after' },
  )
  if (!result) return res.status(404).json({ error: 'Không tìm thấy rạp.' })
  res.json({ cinema: toId(result) })
}))

router.delete('/cinemas/:id', requireAdmin, asyncHandler(async (req, res) => {
  const r = await col('cinemas').findOneAndDelete({ id: Number(req.params.id) }, { projection: { id: 1 } })
  if (!r) return res.status(404).json({ error: 'Không tìm thấy rạp.' })
  res.json({ success: true })
}))

// ============ ROOM ============

router.get('/cinemas/:cinemaId/rooms', asyncHandler(async (req, res) => {
  const rows = await col('rooms').find({ cinemaId: Number(req.params.cinemaId) }).sort({ id: 1 }).toArray()
  res.json({ rooms: rows.map(toId) })
}))

router.post('/rooms', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    cinemaId: z.number().int().positive(),
    name: z.string().min(1).max(100),
    totalRows: z.number().int().min(1).max(30),
    totalCols: z.number().int().min(1).max(30),
  })
  const doc = { id: await nextId('rooms'), ...schema.parse(req.body) }
  await col('rooms').insertOne(doc)
  res.status(201).json({ room: toId(doc) })
}))

router.put('/rooms/:id', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    totalRows: z.number().int().min(1).max(30),
    totalCols: z.number().int().min(1).max(30),
  })
  const result = await col('rooms').findOneAndUpdate(
    { id: Number(req.params.id) },
    { $set: schema.parse(req.body) },
    { returnDocument: 'after' },
  )
  if (!result) return res.status(404).json({ error: 'Không tìm thấy phòng.' })
  res.json({ room: toId(result) })
}))

router.delete('/rooms/:id', requireAdmin, asyncHandler(async (req, res) => {
  const r = await col('rooms').findOneAndDelete({ id: Number(req.params.id) }, { projection: { id: 1 } })
  if (!r) return res.status(404).json({ error: 'Không tìm thấy phòng.' })
  res.json({ success: true })
}))

// ============ SHOWTIME ============

// ⚠️ để trước GET /showtimes/:id để /showtimes/:id/comments không bị nuốt
router.get('/showtimes/:showtimeId/comments', asyncHandler(async (req, res) => {
  const rows = await col('comments')
    .find({ showtimeId: Number(req.params.showtimeId) })
    .sort({ createdAt: -1 })
    .toArray()
  res.json({ comments: rows.map(toId) })
}))

router.get('/showtimes', asyncHandler(async (req, res) => {
  const { cinemaId, movieId, date } = req.query
  const filter = {}
  if (cinemaId) filter.cinemaId = Number(cinemaId)
  if (movieId) filter.movieId = Number(movieId)
  if (date) {
    const d = new Date(date)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    filter.date = { $gte: d, $lt: next }
  }
  const rows = await col('showtimes').find(filter).sort({ date: 1 }).toArray()
  res.json({ showtimes: rows.map(toId) })
}))

router.get('/showtimes/:id', asyncHandler(async (req, res) => {
  const s = await col('showtimes').findOne({ id: Number(req.params.id) })
  if (!s) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' })
  res.json({ showtime: toId(s) })
}))

router.post('/showtimes', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    cinemaId: z.number().int().positive(),
    movieId: z.number().int().positive(),
    roomId: z.number().int().positive(),
    date: z.string(),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    price: z.number().int().min(0),
  })
  const input = schema.parse(req.body)
  const doc = {
    id: await nextId('showtimes'),
    ...input,
    date: new Date(input.date),
  }
  await col('showtimes').insertOne(doc)
  res.status(201).json({ showtime: toId(doc) })
}))

router.put('/showtimes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const schema = z.object({
    cinemaId: z.number().int().positive(),
    movieId: z.number().int().positive(),
    roomId: z.number().int().positive(),
    date: z.string(),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    price: z.number().int().min(0),
  })
  const input = schema.parse(req.body)
  const result = await col('showtimes').findOneAndUpdate(
    { id: Number(req.params.id) },
    { $set: { ...input, date: new Date(input.date) } },
    { returnDocument: 'after' },
  )
  if (!result) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' })
  res.json({ showtime: toId(result) })
}))

router.delete('/showtimes/:id', requireAdmin, asyncHandler(async (req, res) => {
  const r = await col('showtimes').findOneAndDelete({ id: Number(req.params.id) }, { projection: { id: 1 } })
  if (!r) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' })
  res.json({ success: true })
}))

export default router
