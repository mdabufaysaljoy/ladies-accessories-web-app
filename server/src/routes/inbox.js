import { Router } from 'express'
import { Conversation } from '../models/Conversation.js'
import { Order } from '../models/Order.js'
import { Customer } from '../models/Customer.js'
import { Settings } from '../models/Settings.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta, normalizeBdPhone } from '../utils/helpers.js'
import { sendMessage, channelStatus, ingestWebhook, metaConfig } from '../services/meta.js'
import { verifyMetaSignature, safeEqual } from '../utils/crypto.js'
import { env } from '../config/env.js'

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

    if (cfg.appSecret) {
      const signature = req.get('x-hub-signature-256')
      if (!verifyMetaSignature(req.rawBody ?? Buffer.from(''), signature, cfg.appSecret)) {
        return res.sendStatus(401)
      }
    }

    // Always 200 quickly — Meta retries aggressively on anything else.
    res.sendStatus(200)
    try {
      await ingestWebhook(req.body)
    } catch (error) {
      console.error('[inbox] webhook ingest failed:', error.message)
    }
  }),
)

/* --------------------------------- admin --------------------------------- */

router.use(requireAuth, requireAbility('inbox'))

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

    res.json({ conversation: convo, orders })
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
