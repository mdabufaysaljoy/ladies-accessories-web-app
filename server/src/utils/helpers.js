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

/**
 * Pulls the video id out of any YouTube URL a shop owner is likely to paste:
 * a watch link, a share link, an embed, a Short, or a bare 11-character id.
 * Extra query parameters (`?t=`, `&list=`, tracking junk) are discarded.
 *
 * Returns null for anything that is not YouTube — the caller treats that as a
 * validation failure rather than storing a URL that will not embed.
 */
export function parseYouTubeId(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  // A bare id, pasted straight from the address bar's `v=` value.
  if (/^[\w-]{11}$/.test(raw)) return raw

  let url
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const isYouTube =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be'
  if (!isYouTube) return null

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return /^[\w-]{11}$/.test(id) ? id : null
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get('v')
  if (v && /^[\w-]{11}$/.test(v)) return v

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const match = url.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/)
  return match ? match[2] : null
}
