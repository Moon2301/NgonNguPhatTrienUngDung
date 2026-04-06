import dotenv from 'dotenv'
import { col, connectMongo } from '../src/db.js'

dotenv.config()

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pelecinema'
  // eslint-disable-next-line no-console
  console.log(`Connecting MongoDB: ${uri}`)
  await connectMongo()

  await Promise.all([
    col('users').createIndex({ username: 1 }, { unique: true }),
    col('users').createIndex({ email: 1 }, { unique: true }),
    col('movies').createIndex({ id: 1 }, { unique: true }),
    col('showtimes').createIndex({ id: 1 }, { unique: true }),
    col('showtimes').createIndex({ movie_id: 1, start_time: 1 }),
    col('rooms').createIndex({ id: 1 }, { unique: true }),
    col('promotions').createIndex({ code: 1 }, { unique: true }),
    col('bookings').createIndex({ user_id: 1, booking_time: -1 }),
    col('bookings').createIndex({ showtime_id: 1 }),
    col('group_bookings').createIndex({ room_code: 1 }, { unique: true }),
    col('group_bookings').createIndex({ creator_id: 1, created_at: -1 }),
    col('group_members').createIndex({ group_booking_id: 1 }),
    col('group_payments').createIndex({ group_booking_id: 1 }),
    col('ticket_passes').createIndex({ booking_id: 1 }),
    col('ticket_passes').createIndex({ seller_id: 1, created_at: -1 }),
    col('comments').createIndex({ movie_id: 1, created_at: -1 }),
    col('dating_profiles').createIndex({ user_id: 1 }, { unique: true }),
    col('dating_matches').createIndex({ user1_id: 1, created_at: -1 }),
    col('dating_matches').createIndex({ user2_id: 1, created_at: -1 }),
    col('dating_messages').createIndex({ match_id: 1, created_at: 1 }),
    col('dating_requests').createIndex({ from_user_id: 1, to_user_id: 1, status: 1 }),
    col('dating_notifications').createIndex({ to_user_id: 1, is_shown: 1, created_at: -1 }),
  ])

  // eslint-disable-next-line no-console
  console.log('Indexes OK')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

