import { MongoClient, ObjectId } from 'mongodb'

let client
let db

function getMongoUri() {
  return process.env.MONGO_URI || 'mongodb://localhost:27017/pelecinema'
}

function getMongoDbNameFromEnvOrUri() {
  if (process.env.MONGO_DB_NAME) return process.env.MONGO_DB_NAME
  try {
    const uri = getMongoUri()
    const u = new URL(uri)
    const p = (u.pathname || '/').replace(/^\//, '')
    return p || 'pelecinema'
  } catch {
    return 'pelecinema'
  }
}

export async function connectMongo() {
  if (db) return db
  const uri = getMongoUri()
  client = new MongoClient(uri)
  await client.connect()
  db = client.db(getMongoDbNameFromEnvOrUri())
  return db
}

export function getDb() {
  if (!db) throw Object.assign(new Error('MongoDB chưa kết nối.'), { status: 500 })
  return db
}

export function col(name) {
  return getDb().collection(name)
}

export async function nextId(seqName) {
  const res = await col('counters').findOneAndUpdate(
    { _id: String(seqName) },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  const doc = res?.value ?? res
  if (!doc || typeof doc.seq !== 'number') {
    throw Object.assign(new Error(`Không lấy được counter cho ${seqName}.`), { status: 500 })
  }
  return Number(doc.seq)
}

export function toObjectId(id) {
  if (!id) return null
  if (id instanceof ObjectId) return id
  if (ObjectId.isValid(id)) return new ObjectId(String(id))
  return null
}

export function toId(doc) {
  if (!doc) return doc
  // prefer numeric id (SQL-compatible) if present; else fallback to _id string
  const { _id, id, ...rest } = doc
  return { id: id ?? (_id ? String(_id) : undefined), ...rest }
}

export async function closeMongo() {
  if (!client) return
  const c = client
  client = undefined
  db = undefined
  await c.close()
}

export { ObjectId }

