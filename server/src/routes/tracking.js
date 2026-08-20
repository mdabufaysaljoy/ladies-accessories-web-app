import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../utils/helpers.js'
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
