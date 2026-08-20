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

/**
 * Import files (CSV / JSON) are held in memory, not written to the uploads
 * directory: they are parsed once and discarded, and leaving a copy of a
 * catalogue on disk under a public static path serves no purpose.
 */
export const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    /**
     * The extension is the gate, not the browser-reported MIME type: Excel,
     * Windows and curl all label a .csv differently (text/csv,
     * application/vnd.ms-excel, application/octet-stream), and rejecting on
     * that would turn a valid export into a mystery error. The content is
     * parsed as text and never stored or served back, so a wrong label is not
     * a risk worth a false rejection.
     */
    const name = file.originalname.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.json')) {
      return cb(ApiError.badRequest('Please upload a .csv or .json file'))
    }
    cb(null, true)
  },
})
