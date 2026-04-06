import cors from "cors";
import express from "express";
import { pool } from "./db/pool.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";

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

  app.use("/auth", authRouter);

  app.get("/me", requireAuth, async (req, res, next) => {
    try {
      const userId = Number(req.user?.sub);
      if (!Number.isFinite(userId)) return res.status(401).json({ error: "invalid_token" });

      const { rows } = await pool.query(
        "select id, email, created_at from users where id = $1",
        [userId],
      );
      const user = rows[0];
      if (!user) return res.status(404).json({ error: "not_found" });
      return res.json({ user });
    } catch (err) {
      return next(err);
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

