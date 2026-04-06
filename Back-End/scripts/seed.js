import dotenv from 'dotenv'
import { runSeed } from '../src/services/seedService.js'

dotenv.config()

async function main() {
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pelecinema'
  const result = await runSeed()
  // eslint-disable-next-line no-console
  console.log(result.message)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result.summary, null, 2))
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

