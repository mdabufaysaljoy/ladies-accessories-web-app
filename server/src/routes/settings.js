import { Router } from 'express'
import { Settings } from '../models/Settings.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { asyncHandler } from '../utils/helpers.js'
import { logActivity } from '../models/ActivityLog.js'
import { verifyTransport } from '../services/mailer.js'
import { channelStatus } from '../services/meta.js'
import * as sslcommerz from '../services/sslcommerz.js'
import * as bkash from '../services/bkash.js'

const router = Router()

/** Public: everything the storefront needs to render, with no secrets. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await Settings.getSingleton()
    res.json({ settings: settings.toClientJSON({ includeAdminFields: false }) })
  }),
)

/** Admin: same document plus masked credential placeholders. */
router.get(
  '/admin',
  requireAuth,
  requireAbility('settings'),
  asyncHandler(async (_req, res) => {
    const settings = await Settings.getSingleton()
    res.json({ settings: settings.toClientJSON({ includeAdminFields: true }) })
  }),
)

/**
 * Deep-merges the patch so the admin UI can save one tab without wiping the
 * rest. Masked secret placeholders (•••• or empty) are dropped rather than
 * written back over the real value.
 */
const MASK = /^[•*]+/

function mergeDeep(target, patch, path = '') {
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key.endsWith('Set') || key === '_id' || key === 'key' || key === '__v') continue
    const fullPath = path ? `${path}.${key}` : key

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      mergeDeep(target[key], value, fullPath)
      continue
    }

    // Never overwrite a stored secret with its own mask.
    if (typeof value === 'string' && MASK.test(value)) continue
    if (isSecretPath(fullPath) && value === '') continue

    target[key] = value
  }
  return target
}

const SECRET_PATHS = new Set([
  'payments.sslcommerz.storePassword',
  'payments.bkash.password',
  'payments.bkash.appSecret',
  'integrations.meta.appSecret',
  'integrations.meta.whatsapp.accessToken',
  'integrations.meta.messenger.pageAccessToken',
  'integrations.meta.instagram.accessToken',
  'integrations.email.smtpPassword',
  'integrations.sms.apiKey',
  'integrations.analytics.facebookAccessToken',
])
const isSecretPath = (p) => SECRET_PATHS.has(p)

router.patch(
  '/',
  requireAuth,
  requireAbility('settings'),
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton()
    const patch = req.body ?? {}

    for (const [section, value] of Object.entries(patch)) {
      if (['_id', 'key', '__v', 'createdAt', 'updatedAt', 'id'].includes(section)) continue

      if (Array.isArray(value)) {
        settings.set(section, value)
      } else if (value && typeof value === 'object') {
        const current = settings[section]?.toObject?.() ?? settings[section] ?? {}
        settings.set(section, mergeDeep({ ...current }, value, section))
      } else {
        settings.set(section, value)
      }
    }

    await settings.save()

    await logActivity({
      actor: req.user._id,
      actorName: req.user.name,
      action: 'settings.update',
      entity: 'Settings',
      summary: `Updated settings: ${Object.keys(patch).join(', ')}`,
    })

    res.json({ settings: settings.toClientJSON({ includeAdminFields: true }) })
  }),
)

/** Live status of every external integration, for the settings dashboard. */
router.get(
  '/integration-status',
  requireAuth,
  requireAbility('settings'),
  asyncHandler(async (_req, res) => {
    const [email, chat, ssl, bk] = await Promise.all([
      verifyTransport(),
      channelStatus(),
      sslcommerz.isConfigured(),
      bkash.isConfigured(),
    ])
    const settings = await Settings.getSingleton()

    res.json({
      email,
      chat,
      payments: {
        cod: { enabled: settings.payments.cod.enabled, configured: true },
        sslcommerz: { enabled: settings.payments.sslcommerz.enabled, configured: ssl },
        bkash: { enabled: settings.payments.bkash.enabled, configured: bk },
        bkashManual: {
          enabled: settings.payments.bkashManual.enabled,
          configured: Boolean(settings.payments.bkashManual.number),
        },
      },
    })
  }),
)

router.post(
  '/test-email',
  requireAuth,
  requireAbility('settings'),
  asyncHandler(async (req, res) => {
    const { sendMail, renderShell } = await import('../services/mailer.js')
    const settings = await Settings.getSingleton()
    const to = req.body?.to || settings.contact.email

    const result = await sendMail({
      to,
      subject: 'Test email from your admin panel',
      html: renderShell({
        brand: { ...settings.brand, address: settings.contact.address, phone: settings.contact.phone },
        heading: 'Your email settings work',
        intro: 'If you are reading this in your inbox, order updates and campaigns will send correctly.',
      }),
    })

    res.json({ ...result, to })
  }),
)

export default router
