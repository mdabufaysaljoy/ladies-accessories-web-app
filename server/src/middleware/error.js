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
