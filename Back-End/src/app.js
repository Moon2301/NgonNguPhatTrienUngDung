import cors from "cors";
import express from "express";
import { pool } from "./db/pool.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.WEB_ORIGIN ?? true,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/health/db", async (_req, res, next) => {
    try {
      const { rows } = await pool.query("select 1 as ok");
      res.json({ ok: true, db: rows[0]?.ok === 1 });
    } catch (err) {
      next(err);
    }
  });

  // Error handler (basic)
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

