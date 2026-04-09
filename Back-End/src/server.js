import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import session from 'express-session'
import { Server as SocketIOServer } from 'socket.io'
import { closeMongo, connectMongo } from './db.js'
import { registerSeatSocket } from './socket/seatSocket.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import bookingsRoutes from './routes/bookings.js'
import commentsRoutes from './routes/comments.js'
import moviesRoutes from './routes/movies.js'
import newsRoutes from './routes/news.js'
import paymentsVnpayRoutes from './routes/paymentsVnpay.js'
import profileRoutes from './routes/profile.js'
import promotionsRoutes from './routes/promotions.js'
import showtimesRoutes from './routes/showtimes.js'
import ticketPassesRoutes from './routes/ticketPasses.js'
import ticketsRoutes from './routes/tickets.js'
import uploadsRoutes from './routes/uploads.js'

dotenv.config()

const app = express()
app.set('trust proxy', 1)

app.use(express.json())
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const raw = process.env.CLIENT_ORIGIN || 'http://localhost:5173,https://web.moon2301.space'
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

/** Session middleware (shared with Socket.IO) */
export const sessionMiddleware = session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
})

app.use(sessionMiddleware)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/bookings', bookingsRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/movies', moviesRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/payments/vnpay', paymentsVnpayRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/promotions', promotionsRoutes)
app.use('/api/showtimes', showtimesRoutes)
app.use('/api/ticket-passes', ticketPassesRoutes)
app.use('/api/tickets', ticketsRoutes)
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
let io

async function start() {
  await connectMongo()
  server = http.createServer(app)

  io = new SocketIOServer(server, {
    cors: {
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
    },
  })

  registerSeatSocket(io, sessionMiddleware)

  server.listen(port, () => {
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

