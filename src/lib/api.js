/**
 * Thin fetch wrapper. Vite proxies /api → the Express server in dev; in
 * production set VITE_API_URL to the deployed API origin.
 */
const BASE = import.meta.env.VITE_API_URL ?? ''

/** Absolute API root, for callers that cannot go through `request` — e.g. the
 *  tracking beacon, which must hand `navigator.sendBeacon` a plain URL. */
export const API_BASE = `${BASE}/api`

const TOKEN_KEY = 'gbs.admin.token'
export const ACCOUNT_TOKEN_KEY = 'gbs.account.token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode — session lasts until reload */
  }
}

const getAccountToken = () => {
  try {
    return localStorage.getItem(ACCOUNT_TOKEN_KEY)
  } catch {
    return null
  }
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request(
  path,
  { method = 'GET', body, auth = false, asCustomer = false, isForm = false, signal } = {},
) {
  const headers = {}
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  } else if (asCustomer) {
    /**
     * Public endpoints that behave differently for a signed-in shopper (placing
     * an order, so it links to their account). The cookie alone is not enough
     * to rely on: on a split-domain deploy (domain.com → api.domain.com) it is
     * cross-site, so Safari/Brave block it by default. The bearer token works
     * on every browser and deployment shape.
     */
    const token = getAccountToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    credentials: 'include',
    signal,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  if (res.status === 204) return null

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // An expired admin session should bounce to the login screen, not loop.
    if (res.status === 401 && auth) {
      setToken(null)
      if (location.pathname.startsWith('/admin') && !location.pathname.endsWith('/login')) {
        location.assign('/admin/login')
      }
    }
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.details)
  }

  return data
}

const verbs = (auth) => ({
  get: (path, opts) => request(path, { ...opts, auth }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body, auth }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body, auth }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE', auth }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData, isForm: true, auth }),
})

/** Public storefront calls. */
export const api = verbs(false)
/** Authenticated admin calls. */
export const adminApi = verbs(true)

/**
 * Public calls that should carry the shopper's session if there is one —
 * placing an order, so the server can link it to their account. Falls back to
 * an anonymous request when signed out, so guest checkout is unaffected.
 */
export const customerApi = {
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body, asCustomer: true }),
  get: (path, opts) => request(path, { ...opts, asCustomer: true }),
}

export const qs = (params) => {
  const search = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') search.set(k, v)
  })
  const str = search.toString()
  return str ? `?${str}` : ''
}

/**
 * Downloads an admin file (an export) and hands it to the browser.
 *
 * This deliberately mirrors how `request` authenticates rather than rolling
 * its own headers. The server accepts either a bearer token or the
 * `gbs_admin_token` cookie, but the header takes precedence — so sending
 * `Bearer null` when localStorage happens to be empty actively blocks the
 * cookie fallback and turns a working session into a 401. Set the header only
 * when there is a token, and send credentials so the cookie can do its job.
 */
export async function downloadAdminFile(path, fallbackName) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}/api${path}`, { headers, credentials: 'include' })

  if (!res.ok) {
    // Surface the server's own wording — "Session expired" is actionable in a
    // way that a flat "Export failed" is not.
    let message = `Export failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* not JSON — keep the status-based message */
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    (res.headers.get('content-disposition') ?? '').match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
