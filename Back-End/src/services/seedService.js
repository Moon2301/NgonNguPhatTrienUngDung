import bcrypt from 'bcryptjs'
import { col, connectMongo } from '../db.js'
import { seedData } from './seedData.js'

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Datetime string YYYY-MM-DD HH:mm:00 (frontend slice-friendly) */
function mysqlDateTimeFromOffset(offsetDays, hour, minute) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, minute, 0, 0)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )}:00`
}

function futureDateString(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function expiresAtFromNow(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

export async function runSeed() {
  await connectMongo()

  const collectionsToReset = [
    'users',
    'rooms',
    'movies',
    'showtimes',
    'products',
    'promotions',
    'news',
    'comments',
    'bookings',
    'ticket_passes',
    'group_bookings',
    'group_members',
    'group_payments',
    'dating_profiles',
    'dating_matches',
    'dating_messages',
    'dating_requests',
    'dating_notifications',
  ]

  await Promise.all(collectionsToReset.map((c) => col(c).deleteMany({})))
  await col('counters').deleteMany({})

  const users = []
  for (const u of seedData.users) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    users.push({
      id: u.username === 'admin' ? 1 : undefined,
      username: u.username,
      passwordHash,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      role: u.role,
      createdAt: new Date(),
    })
  }
  let userIdSeq = 0
  for (const u of users) {
    if (!u.id) u.id = ++userIdSeq + 1
    userIdSeq = Math.max(userIdSeq, u.id)
  }

  const rooms = seedData.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    total_rows: r.totalRows,
    total_cols: r.totalCols,
  }))

  const movies = seedData.movies.map((m) => {
    const releaseDate = m.id === 3 && !m.releaseDate ? futureDateString(60) : m.releaseDate
    return {
      id: m.id,
      title: m.title,
      description: m.description ?? null,
      director: m.director ?? null,
      cast: m.cast ?? null,
      duration: m.duration,
      release_date: releaseDate ? new Date(`${releaseDate}T00:00:00.000Z`) : null,
      poster_url: m.posterUrl ?? null,
      genre: m.genre ?? null,
      trailer_url: m.trailerUrl ?? null,
      created_at: new Date(),
    }
  })

  const showtimes = seedData.showtimes.map((s) => ({
    id: s.id,
    movie_id: s.movieId,
    room_id: s.roomId,
    start_time: mysqlDateTimeFromOffset(s.offsetDays, s.hour, s.minute),
    price: s.price,
  }))

  const products = seedData.products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image_url: p.imageUrl ?? null,
  }))

  const promotions = seedData.promotions.map((pr) => ({
    id: pr.id,
    code: pr.code,
    title: pr.title,
    description: pr.description ?? null,
    discount_amount: pr.discountAmount || 0,
    discount_percent: pr.discountPercent || 0,
    expires_at: expiresAtFromNow(pr.expiresOffsetDays),
    active: !!pr.active,
    showtime_id: pr.showtimeId ?? null,
    created_at: new Date(),
  }))

  const news = seedData.news.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    excerpt: n.excerpt,
    image_url: n.imageUrl ?? null,
    category: n.category ?? null,
    published_at: new Date(),
    author: n.author ?? null,
    active: !!n.active,
    created_at: new Date(),
  }))

  await Promise.all([
    users.length ? col('users').insertMany(users) : null,
    rooms.length ? col('rooms').insertMany(rooms) : null,
    movies.length ? col('movies').insertMany(movies) : null,
    showtimes.length ? col('showtimes').insertMany(showtimes) : null,
    products.length ? col('products').insertMany(products) : null,
    promotions.length ? col('promotions').insertMany(promotions) : null,
    news.length ? col('news').insertMany(news) : null,
  ])

  const counters = [
    { _id: 'users', seq: Math.max(...users.map((u) => u.id)) },
    { _id: 'rooms', seq: Math.max(...rooms.map((r) => r.id)) },
    { _id: 'movies', seq: Math.max(...movies.map((m) => m.id)) },
    { _id: 'showtimes', seq: Math.max(...showtimes.map((s) => s.id)) },
    { _id: 'products', seq: Math.max(...products.map((p) => p.id)) },
    { _id: 'promotions', seq: Math.max(...promotions.map((p) => p.id)) },
    { _id: 'news', seq: Math.max(...news.map((n) => n.id)) },
    { _id: 'comments', seq: 0 },
    { _id: 'bookings', seq: 0 },
    { _id: 'ticket_passes', seq: 0 },
    { _id: 'group_bookings', seq: 0 },
    { _id: 'group_members', seq: 0 },
    { _id: 'group_payments', seq: 0 },
    { _id: 'dating_profiles', seq: 0 },
    { _id: 'dating_matches', seq: 0 },
    { _id: 'dating_messages', seq: 0 },
    { _id: 'dating_requests', seq: 0 },
    { _id: 'dating_notifications', seq: 0 },
  ]
  await col('counters').insertMany(counters)

  return {
    ok: true,
    message: 'Seeding MongoDB hoàn tất.',
    summary: {
      users: users.length,
      rooms: rooms.length,
      movies: movies.length,
      showtimes: showtimes.length,
      products: products.length,
      promotions: promotions.length,
      news: news.length,
    },
  }
}

