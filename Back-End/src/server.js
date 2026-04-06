import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

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
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`)
})

