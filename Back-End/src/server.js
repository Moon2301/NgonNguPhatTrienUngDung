import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import session from 'express-session'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { registerSeatSocket } from './sockets/seatSocket.js'
import { closeMongo, connectMongo } from './db.js'
import authRoutes from './routes/auth.js'
import moviesRoutes from './routes/movies.js'
import promotionsRoutes from './routes/promotions.js'
import bookingsRoutes from './routes/bookings.js'

dotenv.config()

const app = express()

app.use(express.json())
const rawOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const allowList = rawOrigin.split(',').map((s) => s.trim()).filter(Boolean)

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const isLocalDev = /^http:\/\/localhost:\d+$/.test(origin) || 
                         /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
                         /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)
      if (allowList.includes(origin) || isLocalDev) return cb(null, true)
      return cb(new Error(`CORS blocked origin: ${origin}`))
    },
    credentials: true,
  }),
)


const sessionMiddleware = session({
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
})

app.use(sessionMiddleware)


app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/movies', moviesRoutes)
app.use('/api/promotions', promotionsRoutes)
app.use('/api/bookings', bookingsRoutes)



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
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowList,
    credentials: true,
  },
})

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next)
})


registerSeatSocket(io)

let server

async function start() {
  await connectMongo()
  server = httpServer.listen(port, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`API + Socket listening on http://0.0.0.0:${port}`)
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

