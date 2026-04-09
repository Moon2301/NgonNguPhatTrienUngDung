import express from 'express'
import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { col, nextId, toId } from '../db.js'
import { requireAdmin } from '../middleware/requireAuth.js'

const router = express.Router()
// Lấy danh sách phim sắp chiếu - Diễm
router.get(
  '/upcoming',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const rows = await col('movies')
      .find({ release_date: { $type: 'date', $gt: now } })
      .sort({ release_date: 1 })
      .toArray();
    res.json({ movies: rows.map(toId) });
  })
);
// Lấy danh sách phim, tìm theo thể loại hoặc từ khóa - Diễm
router.get(
  '/upcoming',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const rows = await col('movies')
      .find({ release_date: { $type: 'date', $gt: now } })
      .sort({ release_date: 1 })
      .toArray()
    res.json({ movies: rows.map(toId) })
  }),
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      genre: z.string().optional(),
      keyword: z.string().optional(),
    });
    const { genre, keyword } = schema.parse(req.query);

    if (keyword && keyword.trim()) {
      const q = String(keyword).trim();
      const rows = await col('movies')
        .find({ title: { $regex: q, $options: 'i' } })
        .sort({ id: -1 })
        .toArray();
      return res.json({ movies: rows.map(toId) });
    }

    if (genre && genre.trim()) {
      const g = String(genre).trim();
      const rows = await col('movies')
        .find({ genre: { $regex: g, $options: 'i' } })
        .sort({ id: -1 })
        .toArray();
      return res.json({ movies: rows.map(toId) });
    }

    const rows = await col('movies').find({}).sort({ id: -1 }).toArray();
    res.json({ movies: rows.map(toId) });
  })
);
// Lấy chi tiết phim và lịch chiếu - Diễm
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const movie = await col('movies').findOne({ id });
    if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim.' });

    const showtimes = await col('showtimes').find({ movie_id: id }).sort({ start_time: 1 }).toArray();
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))];
    const rooms = roomIds.length
      ? await col('rooms')
          .find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } })
          .toArray()
      : [];
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
    const stOut = showtimes.map((s) => ({ ...toId(s), roomName: roomMap.get(s.room_id) || null }));

    res.json({ movie: toId(movie), showtimes: stOut });
  })
);
// Thêm phim mới - Diễm
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional().nullable(),
      director: z.string().optional().nullable(),
      cast: z.string().optional().nullable(),
      duration: z.number().int().min(1).max(1000),
      releaseDate: z.string().optional().nullable(),
      posterUrl: z.string().optional().nullable(),
      genre: z.string().optional().nullable(),
      trailerUrl: z.string().optional().nullable(),
    });
    const input = schema.parse(req.body);

    const doc = {
      id: await nextId('movies'),
      title: input.title,
      description: input.description ?? null,
      director: input.director ?? null,
      cast: input.cast ?? null,
      duration: input.duration,
      release_date: input.releaseDate ? new Date(String(input.releaseDate)) : null,
      poster_url: input.posterUrl ?? null,
      genre: input.genre ?? null,
      trailer_url: input.trailerUrl ?? null,
      created_at: new Date(),
    };
    await col('movies').insertOne(doc);
    res.status(201).json({ id: doc.id });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const movie = await col('movies').findOne({ id })
    if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim.' })

    const showtimes = await col('showtimes').find({ movie_id: id }).sort({ start_time: 1 }).toArray()
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]
    const rooms = roomIds.length
      ? await col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray()
      : []
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]))
    const stOut = showtimes.map((s) => ({ ...toId(s), roomName: roomMap.get(s.room_id) || null }))

    return res.json({ movie: toId(movie), showtimes: stOut })
  }),
)

export default router
