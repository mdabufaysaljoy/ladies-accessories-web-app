import multer from 'multer'
import fs from 'node:fs'
import { env } from '../config/env.js'
import { ApiError } from '../utils/helpers.js'

fs.mkdirSync(env.uploadDir, { recursive: true })

/**
 * What a phone or laptop might hand us. Everything except SVG is re-encoded,
 * so the list can be permissive about the input format — HEIC is what an
 * iPhone produces by default and used to be rejected outright.
 */
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
  'image/gif', 'image/heic', 'image/heif', 'image/tiff',
  'image/svg+xml',
])

/**
 * Images are held in memory rather than written straight to disk: every one is
 * re-encoded by `services/imageOptimiser` before it is stored, so the original
 * camera file should never land in the uploads directory at all.
 *
 * The size limit is generous because it applies to what the phone sends, not
 * to what is kept — a 9 MB photo routinely comes out under 200 KB.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 10 },
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
