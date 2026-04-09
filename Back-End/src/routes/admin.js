const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const { col, nextId } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/movies',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = await col('movies').find({}).sort({ id: -1 }).toArray();
    res.json({ movies: rows });
  })
);

router.post(
  '/movies',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      id: z.coerce.number().optional(),
      title: z.string().min(1).max(255),
      description: z.string().optional().nullable(),
      director: z.string().optional().nullable(),
      cast: z.string().optional().nullable(),
      duration: z.coerce.number().int().min(1).max(1000),
      releaseDate: z.string().optional().nullable(),
      posterUrl: z.string().optional().nullable(),
      genre: z.string().optional().nullable(),
      trailerUrl: z.string().optional().nullable(),
    });
    const input = schema.parse(req.body);

    if (input.id) {
      await col('movies').updateOne(
        { id: input.id },
        {
          $set: {
            title: input.title,
            description: input.description ?? null,
            director: input.director ?? null,
            cast: input.cast ?? null,
            duration: input.duration,
            release_date: input.releaseDate ? new Date(String(input.releaseDate)) : null,
            poster_url: input.posterUrl ?? null,
            genre: input.genre ?? null,
            trailer_url: input.trailerUrl ?? null,
            updated_at: new Date(),
          },
        }
      );
      return res.json({ id: input.id });
    }

    const id = await nextId('movies');
    await col('movies').insertOne({
      id,
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
    });
    res.status(201).json({ id });
  })
);

router.delete(
  '/movies/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await col('movies').deleteOne({ id });
    res.json({ success: true });
  })
);

module.exports = router;