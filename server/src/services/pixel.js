import crypto from 'node:crypto'
import { Settings } from '../models/Settings.js'
import { decryptSecret } from '../utils/crypto.js'

/**
 * Meta Conversions API (server-side tracking).
 *
 * The browser pixel alone loses a large share of events to ad blockers, iOS
 * tracking prevention and people closing the tab before the script runs — the
 * gap is worst on exactly the events that matter for ad optimisation, Purchase
 * above all. So every event is sent twice: once from the browser (`fbq`) and
 * once from here. Both carry the same `event_id`, and Meta keeps only one.
 * That is the whole deduplication contract — if the ids ever stop matching,
 * conversions get counted twice, so `eventId` is required, never optional.
 *
 * Without a pixel ID and access token the service runs in SIMULATED mode: it
 * reports what it would have sent and returns `ok: true`, so the shop works
 * normally before the Meta business account is set up.
 */
const GRAPH_VERSION = 'v21.0'

/** Events the browser is allowed to forward. Purchase is deliberately absent —
 *  it is fired server-side from the saved order so the value cannot be faked. */
export const CLIENT_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'AddToWishlist',
  'InitiateCheckout',
  'Search',
  'Lead',
  'CompleteRegistration',
  'Contact',
])

export async function analyticsConfig() {
  const settings = await Settings.getSingleton()
  const a = settings.integrations?.analytics ?? {}
  return {
    pixelId: a.facebookPixelId ?? '',
    accessToken: decryptSecret(a.facebookAccessToken),
    capiEnabled: Boolean(a.facebookCapiEnabled),
    testEventCode: a.facebookTestEventCode ?? '',
    debug: Boolean(a.debug),
  }
}

/* ----------------------------- user data ----------------------------- */

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

/**
 * Meta requires customer data to be normalised *before* hashing — lowercase,
 * trimmed, punctuation stripped — otherwise the same person hashes to two
 * different values and never matches an account.
 */
const hashText = (value) => {
  const clean = String(value ?? '').trim().toLowerCase()
  return clean ? sha256(clean) : null
}

const hashEmail = (value) => {
  const clean = String(value ?? '').trim().toLowerCase()
  return /.+@.+\..+/.test(clean) ? sha256(clean) : null
}

/**
 * Phones must be E.164 digits with no `+`. Bangladeshi numbers arrive as
 * `01712345678`, `+8801712345678` or `8801712345678` depending on where in the
 * checkout they were typed, so normalise all three to `8801712345678`.
 */
const hashPhone = (value) => {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('01')) digits = `88${digits}`
  else if (digits.startsWith('1') && digits.length === 10) digits = `880${digits}`
  return digits.length >= 10 ? sha256(digits) : null
}

/** Splits "Sadia Rahman" into hashed first/last name fields. */
const hashName = (full) => {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return {}
  return {
    fn: hashText(parts[0]),
    ln: parts.length > 1 ? hashText(parts[parts.length - 1]) : null,
  }
}

/**
 * Builds the `user_data` block. `fbp`/`fbc` are the pixel's own browser cookies
 * and are by far the strongest match signal, so they are passed through raw —
 * Meta explicitly requires those two unhashed.
 */
export function buildUserData({ email, phone, name, city, district, externalId, fbp, fbc, ip, userAgent } = {}) {
  const { fn, ln } = hashName(name)
  const data = {
    em: hashEmail(email),
    ph: hashPhone(phone),
    fn,
    ln,
    ct: hashText(String(city ?? district ?? '').replace(/\s+/g, '')),
    country: hashText('bd'),
    external_id: externalId ? hashText(externalId) : null,
    fbp: fbp || null,
    fbc: fbc || null,
    client_ip_address: ip || null,
    client_user_agent: userAgent || null,
  }
  // Meta rejects nulls, and empty keys hurt the match rate score.
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v))
}

/** Pulls the request-side signals CAPI wants: real client IP and user agent. */
export function requestSignals(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get?.('user-agent') || null,
  }
}

/* ------------------------------ sending ------------------------------ */

/**
 * Posts one or more events. Never throws: tracking must not be able to break a
 * checkout, so every failure is captured and returned instead.
 */
export async function sendEvents(events, { config } = {}) {
  const cfg = config ?? (await analyticsConfig())
  const list = (Array.isArray(events) ? events : [events]).filter(Boolean)
  if (!list.length) return { ok: true, sent: 0 }

  if (!cfg.pixelId || !cfg.accessToken || !cfg.capiEnabled) {
    if (cfg.debug) {
      console.log('[capi] simulated:', list.map((e) => `${e.event_name}#${e.event_id}`).join(', '))
    }
    return { ok: true, simulated: true, sent: list.length, reason: !cfg.capiEnabled ? 'disabled' : 'not-configured' }
  }

  const body = {
    data: list,
    ...(cfg.testEventCode ? { test_event_code: cfg.testEventCode } : {}),
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      },
    )
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = json?.error?.message ?? `Meta returned ${res.status}`
      console.error('[capi] rejected:', message)
      return { ok: false, error: message, sent: 0 }
    }
    if (cfg.debug) console.log('[capi] sent:', JSON.stringify(json))
    return { ok: true, sent: json.events_received ?? list.length, fbTraceId: json.fbtrace_id }
  } catch (error) {
    console.error('[capi] request failed:', error.message)
    return { ok: false, error: error.message, sent: 0 }
  }
}

/** Assembles a single event in the shape the Conversions API expects. */
export function buildEvent({
  eventName,
  eventId,
  eventTime,
  sourceUrl,
  actionSource = 'website',
  userData = {},
  customData = {},
}) {
  return {
    event_name: eventName,
    event_time: Math.floor((eventTime ? new Date(eventTime).getTime() : Date.now()) / 1000),
    event_id: eventId,
    action_source: actionSource,
    ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
    user_data: userData,
    custom_data: customData,
  }
}

/* --------------------------- order purchase --------------------------- */

/**
 * The Purchase event, fired from the order itself rather than the browser.
 *
 * `event_id` is the order number: it is stable, unique, and the browser uses
 * the same value on the confirmation page, so a shopper who reaches that page
 * is deduplicated and one who closes the tab still gets counted here.
 */
export async function trackPurchase(order, { sourceUrl } = {}) {
  const cfg = await analyticsConfig()
  if (!cfg.capiEnabled && !cfg.debug) return { ok: true, skipped: true }

  const t = order.tracking ?? {}
  const userData = buildUserData({
    email: order.customer?.email,
    phone: order.customer?.phone,
    name: order.customer?.name,
    district: order.customer?.district,
    externalId: order.account ? String(order.account) : order.customer?.phone,
    fbp: t.fbp,
    fbc: t.fbc,
    ip: t.ip,
    userAgent: t.userAgent,
  })

  const event = buildEvent({
    eventName: 'Purchase',
    eventId: order.orderNumber,
    eventTime: order.createdAt,
    sourceUrl: t.sourceUrl || sourceUrl,
    userData,
    customData: {
      currency: 'BDT',
      value: Number(order.totals?.total ?? 0),
      order_id: order.orderNumber,
      content_type: 'product',
      contents: (order.lines ?? []).map((l) => ({
        id: String(l.slug ?? l.product ?? ''),
        quantity: l.qty,
        item_price: Number(l.price ?? 0),
      })),
      content_ids: (order.lines ?? []).map((l) => String(l.slug ?? l.product ?? '')),
      num_items: (order.lines ?? []).reduce((sum, l) => sum + (l.qty ?? 0), 0),
      // Lets Meta optimise for the payment methods that actually convert here.
      payment_method: order.payment?.method,
    },
  })

  return sendEvents(event, { config: cfg })
}

/** Fires a synthetic event so the admin can confirm the token works. */
export async function sendTestEvent() {
  const cfg = await analyticsConfig()
  if (!cfg.pixelId) return { ok: false, error: 'Add your Facebook Pixel ID first.' }
  if (!cfg.accessToken) return { ok: false, error: 'Add a Conversions API access token first.' }

  const event = buildEvent({
    eventName: 'PageView',
    eventId: `test-${Date.now()}`,
    userData: buildUserData({ email: 'test@goodsbysadia.com', phone: '01712345678' }),
    customData: { test: true },
  })

  // Ignore the enabled flag — the point of the button is to verify credentials
  // before switching tracking on.
  return sendEvents(event, { config: { ...cfg, capiEnabled: true } })
}
