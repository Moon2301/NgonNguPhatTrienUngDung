import bcrypt from "bcrypt";
import express from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { signAccessToken } from "../auth/jwt.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

export const authRouter = express.Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      "insert into users (email, password_hash) values ($1, $2) returning id, email, created_at",
      [email.toLowerCase(), passwordHash],
    );

    const user = rows[0];
    const token = signAccessToken({ sub: String(user.id), email: user.email });
    res.status(201).json({ token, user });
  } catch (err) {
    // unique violation in Postgres
    if (err?.code === "23505") {
      return res.status(409).json({ error: "email_exists" });
    }
    return next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { rows } = await pool.query(
      "select id, email, password_hash, created_at from users where email = $1",
      [email.toLowerCase()],
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const token = signAccessToken({ sub: String(user.id), email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, created_at: user.created_at },
    });
  } catch (err) {
    next(err);
  }
});

