import { Router } from 'express'
import { Conversation } from '../models/Conversation.js'
import { Order } from '../models/Order.js'
import { Customer } from '../models/Customer.js'
import { Settings } from '../models/Settings.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta, normalizeBdPhone } from '../utils/helpers.js'
import { sendMessage, channelStatus, ingestWebhook, metaConfig, subscribePageToWebhook, pageSubscriptionStatus } from '../services/meta.js'
import { verifyMetaSignature, safeEqual } from '../utils/crypto.js'
import { env } from '../config/env.js'
import { WebhookEvent } from '../models/WebhookEvent.js'

const router = Router()

/* ------------------------------- webhooks -------------------------------- */

/** Meta's subscription handshake. */
router.get(
  '/webhook/meta',
  asyncHandler(async (req, res) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    const cfg = await metaConfig()
    const expected = cfg.verifyToken || env.metaVerifyToken

    if (mode === 'subscribe' && token && safeEqual(token, expected)) {
      return res.status(200).send(challenge)
    }
    res.sendStatus(403)
  }),
)

/**
 * Inbound messages from WhatsApp / Messenger / Instagram.
 * The X-Hub-Signature-256 check is what stops anyone POSTing fake customer
 * messages into the shop's inbox.
 */
router.post(
  '/webhook/meta',
  asyncHandler(async (req, res) => {
    const cfg = await metaConfig()
    const preview = JSON.stringify(req.body ?? {})
    const object = req.body?.object ?? ''

    if (cfg.appSecret) {
      const signature = req.get('x-hub-signature-256')
      if (!verifyMetaSignature(req.rawBody ?? Buffer.from(''), signature, cfg.appSecret)) {
        /**
         * The commonest real cause of "the webhook is connected but nothing
         * arrives": the App Secret saved here is not the one the Facebook app
         * signs with. Returning a bare 401 leaves the shop owner with an empty
         * inbox and nothing to go on, so say it loudly and keep a record they
         * can read in the admin panel.
         */
        const reason = signature
          ? 'Signature did not match the saved App Secret — check Settings → Integrations → Meta app.'
          : 'No X-Hub-Signature-256 header on the request.'
        console.error('[inbox] webhook REJECTED:', reason)
        await WebhookEvent.record({ object, status: 'rejected', reason, preview })
        return res.sendStatus(401)
      }
    }

    // Always 200 quickly — Meta retries aggressively on anything else.
    res.sendStatus(200)
    try {
      const created = await ingestWebhook(req.body)
      const ingested = created.length
      await WebhookEvent.record({
        object,
        status: 'accepted',
        ingested,
        // A delivery that produces nothing is worth flagging: usually a read
        // receipt or an echo of the shop's own reply, not a customer message.
        reason: ingested === 0 ? 'Accepted, but contained no new inbound message.' : '',
        preview,
      })
    } catch (error) {
      console.error('[inbox] webhook ingest failed:', error.message)
      await WebhookEvent.record({ object, status: 'rejected', reason: `Ingest failed: ${error.message}`, preview })
    }
  }),
)

/* --------------------------------- admin --------------------------------- */

router.use(requireAuth, requireAbility('inbox'))

/**
 * Connect the Facebook Page to this app's webhook.
 *
 * Kept as an explicit button rather than something done silently on save: it
 * changes configuration inside the shop's own Meta account, and the result
 * (including Meta's own error text) is what tells them why Messenger is or is
 * not working.
 */
/** Recent inbound webhook deliveries, so a silent failure becomes visible. */
router.get(
  '/webhook/log',
  asyncHandler(async (_req, res) => {
    const events = await WebhookEvent.find().sort('-createdAt').limit(25)
    res.json({ events, everReceived: events.length > 0 })
  }),
)

router.post(
  '/messenger/subscribe',
  asyncHandler(async (_req, res) => {
    const result = await subscribePageToWebhook()
    res.status(result.ok ? 200 : 400).json(result)
  }),
)

router.get(
  '/messenger/subscription',
  asyncHandler(async (_req, res) => {
    res.json(await pageSubscriptionStatus())
  }),
)


router.get(
  '/status',
  asyncHandler(async (_req, res) => res.json({ channels: await channelStatus() })),
)

router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate({ ...req.query, limit: req.query.limit ?? 30 })
    const { channel, status, q, assigned } = req.query

    const filter = {}
    if (channel && channel !== 'all') filter.channel = channel
    if (status && status !== 'all') filter.status = status
    if (assigned === 'me') filter.assignedTo = req.user._id
    if (assigned === 'unassigned') filter.assignedTo = { $exists: false }
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ 'contact.name': rx }, { 'contact.phone': rx }, { 'contact.username': rx }, { lastMessagePreview: rx }]
    }

    const [conversations, total, unread] = await Promise.all([
      Conversation.find(filter)
        .select('-messages')
        .populate('assignedTo', 'name')
        .sort('-lastMessageAt')
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(filter),
      Conversation.aggregate([
        { $match: { unreadCount: { $gt: 0 } } },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
      ]),
    ])

    res.json({
      conversations,
      meta: meta(total, page, limit),
      unreadByChannel: Object.fromEntries(unread.map((u) => [u._id, u.count])),
    })
  }),
)

router.get(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const convo = await Conversation.findById(req.params.id)
      .populate('assignedTo', 'name')
      .populate('linkedOrder', 'orderNumber status totals createdAt')
    if (!convo) throw ApiError.notFound('Conversation not found')

    convo.unreadCount = 0
    await convo.save()

    // Surface this contact's order history beside the thread.
    let orders = []
    const phone = convo.contact?.phone ? normalizeBdPhone(convo.contact.phone) : null
    if (phone) {
      orders = await Order.find({ 'customer.phone': phone })
        .select('orderNumber status totals createdAt payment.method')
        .sort('-createdAt')
        .limit(5)
    }

    /**
     * Where an admin can actually see this person.
     *
     * Facebook does not expose a public profile URL for a page-scoped ID, so
     * there is nothing to link a Messenger PSID to on facebook.com. What does
     * work is opening the thread in Meta's own inbox, which is computed here
     * because it needs the Page ID from settings. Instagram is different — a
     * username is a real public handle.
     */
    const cfg = await metaConfig()
    let threadUrl = null
    if (convo.channel === 'instagram' && convo.contact?.username) {
      threadUrl = `https://www.instagram.com/${encodeURIComponent(convo.contact.username)}/`
    } else if (convo.channel === 'messenger' && cfg.messenger.pageId) {
      threadUrl =
        `https://business.facebook.com/latest/inbox/all?asset_id=${encodeURIComponent(cfg.messenger.pageId)}` +
        `&thread_id=${encodeURIComponent(convo.externalId)}`
    }

    res.json({ conversation: { ...convo.toObject(), threadUrl }, orders })
  }),
)

router.post(
  '/conversations/:id/reply',
  asyncHandler(async (req, res) => {
    const { text } = req.body ?? {}
    if (!text?.trim()) throw ApiError.badRequest('Write a message first')

    const convo = await Conversation.findById(req.params.id)
    if (!convo) throw ApiError.notFound('Conversation not found')

    const result = await sendMessage({
      channel: convo.channel,
      externalId: convo.externalId,
      text: text.trim(),
    })

    if (result.failed) throw new ApiError(502, `Could not send: ${result.reason}`)

    convo.appendMessage({
      direction: 'out',
      text: text.trim(),
      externalId: result.externalId,
      status: result.simulated ? 'queued' : 'sent',
      simulated: Boolean(result.simulated),
      sentBy: req.user.name,
    })
    convo.unreadCount = 0
    if (convo.status === 'open') convo.status = 'pending'
    await convo.save()

    res.json({
      conversation: convo,
      simulated: Boolean(result.simulated),
      note: result.simulated ? result.reason : undefined,
    })
  }),
)

router.patch(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const { status, assignedTo, tags, linkedOrder } = req.body ?? {}
    const convo = await Conversation.findById(req.params.id)
    if (!convo) throw ApiError.notFound('Conversation not found')

    if (status) convo.status = status
    if (assignedTo !== undefined) convo.assignedTo = assignedTo || undefined
    if (tags) convo.tags = tags
    if (linkedOrder !== undefined) convo.linkedOrder = linkedOrder || undefined
    await convo.save()

    res.json({ conversation: convo })
  }),
)

/** Seeds a thread from the admin side — e.g. after a phone call. */
router.post(
  '/conversations',
  asyncHandler(async (req, res) => {
    const { channel, externalId, name, phone } = req.body ?? {}
    if (!channel || !externalId) throw ApiError.badRequest('Channel and contact ID are required')

    let convo = await Conversation.findOne({ channel, externalId })
    if (!convo) {
      convo = await Conversation.create({
        channel,
        externalId,
        contact: { name: name ?? externalId, phone: phone ? normalizeBdPhone(phone) : undefined },
      })
    }
    res.status(201).json({ conversation: convo })
  }),
)

/** Canned replies, editable from settings. */
router.get(
  '/quick-replies',
  asyncHandler(async (_req, res) => {
    const settings = await Settings.getSingleton()
    const zone = settings.delivery.zones?.[0]
    res.json({
      replies: [
        { label: 'Greeting', text: `Assalamu alaikum! Welcome to ${settings.brand.name}. How can I help you today?` },
        { label: 'Delivery time', text: `${zone?.label ?? 'Inside Dhaka'}: ${zone?.eta ?? '1–2 working days'}. Outside Dhaka: 2–4 working days. We dispatch same day if you order before 4 PM.` },
        { label: 'COD available', text: 'Yes, cash on delivery is available in all 64 districts. You pay the courier when the parcel reaches you.' },
        { label: 'Payment options', text: `You can pay cash on delivery, or send money to bKash ${settings.payments.bkashManual.number} and share the TrxID.` },
        { label: 'In stock', text: 'Yes, this is in stock and ready to dispatch. Would you like me to place the order for you?' },
        { label: 'Ask for address', text: 'Please send your full name, mobile number and complete address (house, road, area) so I can place the order.' },
        { label: 'Order confirmed', text: 'Your order is confirmed. We will call you before dispatch and send the tracking number by SMS.' },
        { label: 'Return policy', text: `You can return any unopened item within ${settings.delivery.returnWindowDays} days. Please record a video while opening the parcel.` },
      ],
    })
  }),
)

export default router
