import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '../../.env') })

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback
  if (value === undefined) throw new Error(`Missing required env var: ${key}`)
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/goods-by-sadia'),

  // Signs admin sessions. MUST be overridden in production.
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiry: process.env.JWT_EXPIRY ?? '7d',

  // Encrypts payment/API secrets at rest in the settings document.
  secretKey: required('SECRET_ENCRYPTION_KEY', 'dev-only-insecure-encryption-key'),

  clientOrigin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim()),

  uploadDir: path.resolve(here, '../../uploads'),
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,

  // Meta webhook handshake token (WhatsApp / Messenger / Instagram).
  metaVerifyToken: process.env.META_VERIFY_TOKEN ?? 'goods-by-sadia-verify',
}

export const isProd = env.nodeEnv === 'production'

if (isProd) {
  const insecure = [
    ['JWT_SECRET', env.jwtSecret, 'dev-only-insecure-secret-change-me'],
    ['SECRET_ENCRYPTION_KEY', env.secretKey, 'dev-only-insecure-encryption-key'],
  ].filter(([, value, dev]) => value === dev)

  if (insecure.length) {
    throw new Error(
      `Refusing to start in production with default secrets: ${insecure.map(([k]) => k).join(', ')}`,
    )
  }
}
