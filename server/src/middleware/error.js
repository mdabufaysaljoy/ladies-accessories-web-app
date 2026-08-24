import { isProd } from '../config/env.js'
import { ApiError } from '../utils/helpers.js'

export const notFound = (req, _res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`))

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let status = err.status ?? 500
  let message = err.message ?? 'Something went wrong'
  let details = err.details

  if (err.name === 'ValidationError') {
    status = 400
    message = 'Validation failed'
    details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, e.message]),
    )
  }

  if (err.name === 'CastError') {
    status = 400
    message = `Invalid ${err.path}`
  }

  if (err.code === 11000) {
    status = 409
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'value'
    message = `That ${field} is already in use`
  }

  /**
   * Multer rejects an oversized or over-count upload with its own error class.
   * Left to the generic handler it surfaces as a bare 500 "File too large",
   * which tells the shop owner nothing about what to do next.
   */
  if (err.name === 'MulterError') {
    status = 413
    const messages = {
      LIMIT_FILE_SIZE: 'That file is too large. Please upload an image under 12 MB.',
      LIMIT_FILE_COUNT: 'Too many files at once — please upload 5 or fewer.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field in the upload.',
    }
    message = messages[err.code] ?? `Upload rejected (${err.code})`
  }

  if (err.name === 'ZodError') {
    status = 400
    message = 'Validation failed'
    details = Object.fromEntries(
      err.issues.map((i) => [i.path.join('.') || 'value', i.message]),
    )
  }

  if (status >= 500) console.error('[error]', err)

  res.status(status).json({
    error: message,
    ...(details ? { details } : {}),
    ...(isProd || status < 500 ? {} : { stack: err.stack }),
  })
}
