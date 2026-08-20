import { Router } from 'express'
import { Campaign } from '../models/Campaign.js'
import { Subscriber } from '../models/Subscriber.js'
import { Customer } from '../models/Customer.js'
import { Settings } from '../models/Settings.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta } from '../utils/helpers.js'
import { sendMail, renderShell } from '../services/mailer.js'
import { logActivity } from '../models/ActivityLog.js'

const router = Router()

/* ----------------------------- public signup ----------------------------- */

router.post(
  '/subscribe',
  asyncHandler(async (req, res) => {
    const { email, name, source } = req.body ?? {}
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw ApiError.badRequest('Please enter a valid email address')
    }

    const subscriber = await Subscriber.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: { name, source: source ?? 'footer', status: 'subscribed' }, $unset: { unsubscribedAt: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    res.status(201).json({ ok: true, subscriber: { email: subscriber.email } })
  }),
)

router.get(
  '/unsubscribe/:token',
  asyncHandler(async (req, res) => {
    const subscriber = await Subscriber.findOne({ unsubscribeToken: req.params.token })
    if (!subscriber) return res.status(404).send('This unsubscribe link is not valid.')

    subscriber.status = 'unsubscribed'
    subscriber.unsubscribedAt = new Date()
    await subscriber.save()

    res.send(`<!doctype html><meta charset="utf-8"><title>Unsubscribed</title>
      <div style="font-family:system-ui;max-width:32rem;margin:15vh auto;text-align:center;padding:0 1rem">
        <h1 style="font-size:1.5rem">You have been unsubscribed</h1>
        <p style="color:#666;line-height:1.6">${subscriber.email} will no longer receive marketing emails from us. Order updates will still be sent.</p>
      </div>`)
  }),
)

/* --------------------------------- admin --------------------------------- */

router.use(requireAuth, requireAbility('campaigns'))

router.get(
  '/subscribers',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    const filter = req.query.status ? { status: req.query.status } : {}
    const [subscribers, total, active] = await Promise.all([
      Subscriber.find(filter).sort('-createdAt').skip(skip).limit(limit),
      Subscriber.countDocuments(filter),
      Subscriber.countDocuments({ status: 'subscribed' }),
    ])
    res.json({ subscribers, meta: meta(total, page, limit), activeCount: active })
  }),
)

router.delete(
  '/subscribers/:id',
  asyncHandler(async (req, res) => {
    await Subscriber.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  }),
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    const [campaigns, total] = await Promise.all([
      Campaign.find().sort('-createdAt').skip(skip).limit(limit),
      Campaign.countDocuments(),
    ])
    res.json({ campaigns, meta: meta(total, page, limit) })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id)
    if (!campaign) throw ApiError.notFound('Campaign not found')
    res.json({ campaign })
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.create({ ...req.body, _id: undefined, createdBy: req.user._id })
    res.status(201).json({ campaign })
  }),
)

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id)
    if (!campaign) throw ApiError.notFound('Campaign not found')
    if (campaign.status === 'sent') throw ApiError.badRequest('A sent campaign cannot be edited')

    Object.assign(campaign, { ...req.body, _id: undefined, status: campaign.status })
    await campaign.save()
    res.json({ campaign })
  }),
)

/** Resolves the audience into a deduplicated recipient list. */
async function resolveRecipients(audience) {
  if (audience.type === 'manual') {
    return [...new Set((audience.manualEmails ?? []).map((e) => e.toLowerCase().trim()).filter(Boolean))]
  }

  if (audience.type === 'customers' || audience.type === 'segment') {
    const customers = await Customer.find({
      email: { $exists: true, $ne: '' },
      acceptsMarketing: true,
    })
    const segment = audience.segment ?? 'all'
    const filtered = customers.filter((c) => {
      if (segment === 'all') return c.riskFlag !== 'blocked'
      if (segment === 'new') return c.orderCount <= 1
      if (segment === 'repeat') return c.orderCount >= 2 && c.orderCount < 5
      if (segment === 'vip') return c.orderCount >= 5
      return true
    })
    return [...new Set(filtered.map((c) => c.email.toLowerCase()))]
  }

  const subscribers = await Subscriber.find({ status: 'subscribed' })
  return [...new Set(subscribers.map((s) => s.email))]
}

router.post(
  '/:id/preview-audience',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id)
    if (!campaign) throw ApiError.notFound('Campaign not found')
    const recipients = await resolveRecipients(campaign.audience)
    res.json({ count: recipients.length, sample: recipients.slice(0, 8) })
  }),
)

router.post(
  '/:id/test',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id)
    if (!campaign) throw ApiError.notFound('Campaign not found')

    const settings = await Settings.getSingleton()
    const to = req.body?.to || settings.contact.email
    const result = await sendMail({
      to,
      subject: `[TEST] ${campaign.subject}`,
      html: buildHtml(campaign, settings, 'preview-token'),
    })
    res.json({ result, to })
  }),
)

function buildHtml(campaign, settings, unsubscribeToken) {
  const brand = {
    ...(settings.brand.toObject?.() ?? settings.brand),
    address: settings.contact.address,
    phone: settings.contact.phone,
  }
  const unsubUrl = `${process.env.PUBLIC_URL ?? 'http://localhost:4000'}/api/campaigns/unsubscribe/${unsubscribeToken}`

  return renderShell({
    brand,
    heading: campaign.subject,
    intro: campaign.preheader,
    bodyHtml: `${campaign.bodyHtml ?? ''}
      <p style="margin:28px 0 0;font-size:11px;color:#9c9298">
        You are receiving this because you subscribed to ${brand.name}.
        <a href="${unsubUrl}" style="color:#9c9298">Unsubscribe</a>
      </p>`,
  })
}

/**
 * Sends in small batches with a pause between them. Shared SMTP hosts throttle
 * hard, and a rejected burst can get the whole domain flagged as spam.
 */
router.post(
  '/:id/send',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id)
    if (!campaign) throw ApiError.notFound('Campaign not found')
    if (campaign.status === 'sending') throw ApiError.badRequest('This campaign is already sending')
    if (campaign.status === 'sent') throw ApiError.badRequest('This campaign has already been sent')

    const settings = await Settings.getSingleton()
    const emails = await resolveRecipients(campaign.audience)
    if (!emails.length) throw ApiError.badRequest('This audience has no recipients')

    campaign.status = 'sending'
    campaign.stats.recipients = emails.length
    campaign.stats.sent = 0
    campaign.stats.failed = 0
    await campaign.save()

    res.json({ ok: true, queued: emails.length, campaign })

    // Continue in the background — the admin UI polls for progress.
    ;(async () => {
      const tokens = Object.fromEntries(
        (await Subscriber.find({ email: { $in: emails } }).select('email unsubscribeToken')).map((s) => [
          s.email,
          s.unsubscribeToken,
        ]),
      )

      let sent = 0
      let failed = 0
      let simulated = false
      const BATCH = 20

      for (let i = 0; i < emails.length; i += BATCH) {
        const batch = emails.slice(i, i + BATCH)
        const results = await Promise.all(
          batch.map((to) =>
            sendMail({
              to,
              subject: campaign.subject,
              html: buildHtml(campaign, settings, tokens[to] ?? 'unknown'),
            }),
          ),
        )
        results.forEach((r) => {
          if (r.ok) sent += 1
          else failed += 1
          if (r.simulated) simulated = true
        })

        await Campaign.updateOne(
          { _id: campaign._id },
          { $set: { 'stats.sent': sent, 'stats.failed': failed, 'stats.simulated': simulated } },
        )

        if (i + BATCH < emails.length) await new Promise((r) => setTimeout(r, 1200))
      }

      await Campaign.updateOne(
        { _id: campaign._id },
        {
          $set: {
            status: failed === emails.length ? 'failed' : 'sent',
            sentAt: new Date(),
            'stats.sent': sent,
            'stats.failed': failed,
            'stats.simulated': simulated,
          },
        },
      )

      await logActivity({
        actor: req.user._id,
        actorName: req.user.name,
        action: 'campaign.send',
        entity: 'Campaign',
        entityId: String(campaign._id),
        summary: `Sent “${campaign.name}” to ${sent} recipients${simulated ? ' (simulated)' : ''}`,
      })
    })().catch(async (error) => {
      console.error('[campaign] send failed:', error)
      await Campaign.updateOne({ _id: campaign._id }, { $set: { status: 'failed', lastError: error.message } })
    })
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await Campaign.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  }),
)

export default router
