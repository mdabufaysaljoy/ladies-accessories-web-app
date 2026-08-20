export const slugify = (str) =>
  String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Wraps async route handlers so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
  static badRequest(msg, details) { return new ApiError(400, msg, details) }
  static unauthorized(msg = 'Not authenticated') { return new ApiError(401, msg) }
  static forbidden(msg = 'Not allowed') { return new ApiError(403, msg) }
  static notFound(msg = 'Not found') { return new ApiError(404, msg) }
  static conflict(msg) { return new ApiError(409, msg) }
}

/** GBS-8F3K21 */
export const generateOrderNumber = () =>
  `GBS-${Math.random().toString(36).slice(2, 8).toUpperCase()}${String(Date.now()).slice(-2)}`

export const paginate = (query) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

export const meta = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
})

/** 01712345678 / +8801712345678 → 8801712345678 */
export const normalizeBdPhone = (raw) => {
  const digits = String(raw ?? '').replace(/[^\d]/g, '')
  if (digits.startsWith('880')) return digits
  if (digits.startsWith('0')) return `88${digits}`
  if (digits.length === 10) return `880${digits}`
  return digits
}

export const isValidBdPhone = (raw) =>
  /^8801[3-9]\d{8}$/.test(normalizeBdPhone(raw))
