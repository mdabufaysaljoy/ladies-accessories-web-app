import crypto from 'node:crypto'
import { env } from '../config/env.js'

/**
 * Payment credentials (SSLCommerz store password, bKash app secret, SMTP
 * password) are encrypted at rest so a database dump does not hand over live
 * keys. They are decrypted only inside the service that calls the provider,
 * and never serialised back to the admin UI — see `maskSecret`.
 */
const ALGO = 'aes-256-gcm'
const key = crypto.createHash('sha256').update(String(env.secretKey)).digest()

export function encryptSecret(plain) {
  if (!plain) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptSecret(payload) {
  if (!payload) return ''
  if (!payload.startsWith('v1:')) return payload // pre-encryption value
  try {
    const [, ivB64, tagB64, dataB64] = payload.split(':')
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return ''
  }
}

/** What the admin UI sees: proof a key is saved, without revealing it. */
export function maskSecret(payload) {
  const plain = decryptSecret(payload)
  if (!plain) return ''
  if (plain.length <= 4) return '••••'
  return `${'•'.repeat(Math.min(12, plain.length - 4))}${plain.slice(-4)}`
}

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('hex')

/** Timing-safe compare for webhook signatures / tokens. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader) return false
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return safeEqual(expected, signatureHeader)
}
