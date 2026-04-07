import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import session from 'express-session'
import { closeMongo, connectMongo } from './db.js'
import authRoutes from './routes/auth.js'
import datingRoutes from './routes/dating.js'
import moviesRoutes from './routes/movies.js'
import promotionsRoutes from './routes/promotions.js'
import uploadsRoutes from './routes/uploads.js'

dotenv.config()

const app = express()

app.use(express.json())
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const raw = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
      const allowList = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const isLocalDev = /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
      if (allowList.includes(origin) || isLocalDev) return cb(null, true)
      return cb(new Error(`CORS blocked origin: ${origin}`))
    },
    credentials: true,
  }),
)

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/dating', datingRoutes)
app.use('/api/movies', moviesRoutes)
app.use('/api/promotions', promotionsRoutes)
app.use('/api/uploads', uploadsRoutes)

app.use((err, _req, res, _next) => {
  const message = err?.message || 'Server error'
  const status = err?.status || 500
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err)
  }
  res.status(status).json({ error: message })
})

const port = Number(process.env.PORT) || 4000
let server

async function start() {
  await connectMongo()
  server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${port}`)
  })
  server.on('close', () => {
    // eslint-disable-next-line no-console
    console.log('API server closed.')
  })
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

process.on('SIGINT', async () => {
  try {
    if (server) server.close()
    await closeMongo()
  } finally {
    process.exit(0)
  }
})

