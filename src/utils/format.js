const bdt = new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 })

/** ৳1,290 */
export const taka = (n) => `৳${bdt.format(Math.round(n || 0))}`

export const percentOff = (price, compareAt) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0

export const cx = (...parts) => parts.filter(Boolean).join(' ')

/** GBS-8F3K21 */
export const orderId = () =>
  `GBS-${Math.random().toString(36).slice(2, 8).toUpperCase()}${String(Date.now()).slice(-2)}`

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Bangladeshi mobile: 01XXXXXXXXX, optionally +88 prefixed. */
export const isValidBdPhone = (v) => /^(?:\+?88)?01[3-9]\d{8}$/.test(String(v).replace(/[\s-]/g, ''))

export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v))

/** Deterministic pseudo-random in [0,1) from a string — keeps generated art stable. */
export const hashUnit = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

/** Browser-side slug generator, mirroring the server's `slugify`. */
export const slugifyClient = (str) =>
  String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** 1536 → "1.5 KB", 5417216 → "5.2 MB" */
export const fileSize = (bytes) => {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * "5.2 MB → 103 KB · 98% smaller" — the sentence an admin actually wants after
 * uploading, rather than a bare "uploaded" with no idea what happened to it.
 */
export const optimisationSummary = (o) => {
  if (!o || !o.originalBytes) return ''
  const from = fileSize(o.originalBytes)
  const to = fileSize(o.storedBytes)
  if (!o.savedPercent || o.savedPercent <= 0) return `${to} stored`
  return `${from} → ${to} · ${o.savedPercent}% smaller`
}
