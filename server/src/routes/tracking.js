import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../utils/helpers.js'
import { Visit } from '../models/Visit.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { optionalCustomer } from '../middleware/customerAuth.js'
import {
  CLIENT_EVENTS,
  analyticsConfig,
  buildEvent,
  buildUserData,
  requestSignals,
  sendEvents,
  sendTestEvent,
} from '../services/pixel.js'

const router = Router()

/**
 * The browser calls this on every tracked interaction, so it gets its own
 * generous limit — well above what a real shopper produces, low enough that
 * the endpoint cannot be used to hammer Meta on our access token.
 */
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * POST /api/track/event — mirror of a browser pixel event.
 *
 * The client fires `fbq(...)` and calls this with the *same* `eventId`; Meta
 * deduplicates on that pair. Anything the client sends is untrusted, so the
 * event name is checked against an allowlist and the monetary fields are
 * coerced to numbers. Purchase is not accepted here at all — it is fired from
 * the order record in `routes/orders.js`, where the value is the real one.
 */
router.post(
  '/event',
  trackLimiter,
  optionalCustomer,
  asyncHandler(async (req, res) => {
    const { eventName, eventId, sourceUrl, customData = {}, userData = {} } = req.body ?? {}

    if (!eventName || !CLIENT_EVENTS.has(eventName)) {
      return res.status(400).json({ message: 'Unsupported event' })
    }
    if (!eventId || typeof eventId !== 'string' || eventId.length > 128) {
      // No id means no deduplication, which would double-count the event.
      return res.status(400).json({ message: 'A deduplication eventId is required' })
    }

    const cfg = await analyticsConfig()
    if (!cfg.capiEnabled) return res.json({ ok: true, skipped: true })

    const signals = requestSignals(req)
    const event = buildEvent({
      eventName,
      eventId,
      sourceUrl,
      userData: buildUserData({
        // Prefer the signed-in account over anything the page claims.
        email: req.customer?.email ?? userData.email,
        phone: req.customer?.phone ?? userData.phone,
        name: req.customer?.name ?? userData.name,
        district: userData.district,
        externalId: req.customer ? String(req.customer._id) : userData.externalId,
        fbp: userData.fbp,
        fbc: userData.fbc,
        ...signals,
      }),
      customData: {
        ...(customData.currency ? { currency: String(customData.currency).slice(0, 8) } : { currency: 'BDT' }),
        ...(customData.value != null ? { value: Number(customData.value) || 0 } : {}),
        ...(customData.contentName ? { content_name: String(customData.contentName).slice(0, 200) } : {}),
        ...(customData.contentCategory ? { content_category: String(customData.contentCategory).slice(0, 100) } : {}),
        ...(Array.isArray(customData.contentIds)
          ? { content_ids: customData.contentIds.slice(0, 50).map((v) => String(v).slice(0, 100)) }
          : {}),
        ...(Array.isArray(customData.contents)
          ? {
              contents: customData.contents.slice(0, 50).map((c) => ({
                id: String(c.id ?? '').slice(0, 100),
                quantity: Number(c.quantity) || 1,
                item_price: Number(c.item_price) || 0,
              })),
            }
          : {}),
        ...(customData.contentType ? { content_type: String(customData.contentType).slice(0, 40) } : {}),
        ...(customData.searchString ? { search_string: String(customData.searchString).slice(0, 200) } : {}),
        ...(customData.numItems != null ? { num_items: Number(customData.numItems) || 0 } : {}),
      },
    })

    const result = await sendEvents(event, { config: cfg })
    res.json({ ok: result.ok, simulated: result.simulated ?? false })
  }),
)

/**
 * POST /api/track/visit — first-party page view.
 *
 * Separate from `/event` on purpose: this one always records, whether or not
 * the shop has configured a Meta or Google pixel, because the dashboard's
 * visitor count should not depend on a third-party marketing tool being set up.
 *
 * Everything stored is derived here rather than trusted: the referrer is
 * reduced to a host, the device is read from the user agent, and the session id
 * is length-capped. No IP address is written.
 */
const visitLimiter = rateLimit({
  windowMs: 60 * 1000,
  // A fast browser can legitimately produce a burst of route changes.
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  // Counting is best-effort; never fail a shopper's page for it.
  handler: (_req, res) => res.status(204).end(),
})

/** `https://m.facebook.com/foo?x=1` → `facebook.com`. Never the full URL. */
function referrerSource(referrer, selfHost) {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.replace(/^(www|m|l)\./, '').toLowerCase()
    if (!host || host === selfHost) return 'direct'
    if (host.includes('facebook') || host.includes('fb.')) return 'facebook'
    if (host.includes('instagram')) return 'instagram'
    if (host.includes('google')) return 'google'
    if (host.includes('tiktok')) return 'tiktok'
    if (host.includes('youtube')) return 'youtube'
    if (host.includes('whatsapp')) return 'whatsapp'
    return host.slice(0, 60)
  } catch {
    return 'direct'
  }
}

const deviceFrom = (ua = '') => {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile'
  return 'desktop'
}

router.post(
  '/visit',
  visitLimiter,
  asyncHandler(async (req, res) => {
    const { sessionId, path, referrer, isEntry } = req.body ?? {}

    // Respond first: the browser has nothing to wait for, and a slow write
    // must never hold up a page transition.
    res.status(204).end()

    if (!sessionId || typeof sessionId !== 'string' || !path || typeof path !== 'string') return
    // Staff traffic would drown out real customers in the numbers.
    if (path.startsWith('/admin')) return

    try {
      const selfHost = (req.headers.origin ? new URL(req.headers.origin).hostname : '')
        .replace(/^(www|m)\./, '')
        .toLowerCase()

      await Visit.create({
        sessionId: sessionId.slice(0, 64),
        path: path.split('?')[0].slice(0, 200),
        isEntry: Boolean(isEntry),
        source: referrerSource(referrer, selfHost),
        device: deviceFrom(req.get('user-agent')),
      })
    } catch (error) {
      console.error('[visit] could not record:', error.message)
    }
  }),
)

/** Admin: verify the pixel ID and access token actually work. */
router.post(
  '/test',
  requireAuth,
  requireAbility('settings'),
  asyncHandler(async (_req, res) => {
    const result = await sendTestEvent()
    res.status(result.ok ? 200 : 400).json(result)
  }),
)

/** Admin: what is configured right now, without exposing the token. */
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const cfg = await analyticsConfig()
    res.json({
      pixelId: cfg.pixelId,
      capiEnabled: cfg.capiEnabled,
      tokenSet: Boolean(cfg.accessToken),
      testEventCode: cfg.testEventCode,
      ready: Boolean(cfg.pixelId && cfg.accessToken && cfg.capiEnabled),
    })
  }),
)

export default router
