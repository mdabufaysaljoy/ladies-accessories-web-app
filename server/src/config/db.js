import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDb() {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 })
  console.log(`[db] connected → ${mongoose.connection.name}`)

  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'))
  mongoose.connection.on('error', (err) => console.error('[db] error', err.message))

  return mongoose.connection
}
