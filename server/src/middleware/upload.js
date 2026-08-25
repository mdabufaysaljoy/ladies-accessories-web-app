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

/** The same list as file extensions, for when the reported MIME type is junk. */
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif|heic|heif|tiff?|svg)$/i

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
  /**
   * Ten files at 10 MB each. memoryStorage holds a whole batch in RAM at once,
   * so the worst case here is ~100 MB on a 1 GB VPS — which is why the ceiling
   * came down from 12 MB per file as the count went up, rather than both
   * rising together. 10 MB still covers any phone photo (they arrive at 2-5 MB
   * and leave under 200 KB after re-encoding).
   *
   * This must stay in step with `client_max_body_size` in
   * deploy/nginx-api.conf. If Nginx's limit is the lower of the two it rejects
   * the request before Express ever sees it, and the browser reports the
   * failure as a CORS error rather than as "file too large".
   */
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true)

    /**
     * Fall back to the extension. Browsers and phones disagree about image
     * MIME types — HEIC from an iPhone often arrives as application/octet-stream,
     * and some Android galleries send an empty type — so trusting the label
     * alone rejects perfectly good photos. Every non-SVG upload is re-encoded
     * by sharp downstream, which fails loudly if the bytes are not an image,
     * so the extension is a safe enough gate here.
     */
    if (ALLOWED_EXTENSIONS.test(file.originalname ?? '')) return cb(null, true)

    cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype || 'unknown'}`))
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
    if (!/\.(csv|json|xlsx)$/.test(name)) {
      return cb(ApiError.badRequest('Please upload a .csv, .xlsx or .json file'))
    }
    cb(null, true)
  },
})
