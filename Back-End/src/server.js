import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { closeMongo, connectMongo } from './db.js'

dotenv.config()

const app = express()

app.use(express.json())
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  }),
)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/', (_req, res) => {
  res.type('text').send('Back-End is running')
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

