import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { ApiError } from '../utils/helpers.js'

fs.mkdirSync(env.uploadDir, { recursive: true })

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10)
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`))
    }
    cb(null, true)
  },
})
