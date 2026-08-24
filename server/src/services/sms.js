import { Settings } from '../models/Settings.js'
import { decryptSecret } from '../utils/crypto.js'
import { normalizeBdPhone } from '../utils/helpers.js'

/**
 * SMS sending, primarily for order updates.
 *
 * Alpha SMS (alphasms.com.bd) is the default because it is what this shop
 * uses; BulkSMSBD is kept because the settings already named it. Both take a
 * plain HTTP call, so one adapter per provider is enough.
 *
 * Without credentials the service runs in SIMULATED mode — it reports what it
 * would have sent and returns `ok: true`, so the admin panel is fully usable
 * before the shop has bought an SMS package.
 */

/**
 * A single GSM-7 SMS is 160 characters; anything longer is billed as multiple
 * parts, and any non-GSM character (Bangla, emoji, curly quotes) switches the
 * whole message to UCS-2 where the limit collapses to 70.
 */
export const SMS_SINGLE_GSM = 160
export const SMS_SINGLE_UNICODE = 70

/** The characters Alpha SMS can send as plain GSM-7 without going Unicode. */
const GSM_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
  '^{}\\[~]|€'

/**
 * Works out how the message will actually be billed.
 *
 * Bangladeshi shops write order updates in a mix of English and Bangla, and a
 * single Bangla character silently triples the cost of a message. The admin
 * sees this before pressing send rather than on the invoice.
 */
export function measureSms(text = '') {
  const body = String(text)
  const unicode = [...body].some((ch) => !GSM_CHARS.includes(ch))
  const perPart = unicode ? SMS_SINGLE_UNICODE : SMS_SINGLE_GSM
  // Concatenated parts carry a header, so they hold slightly less each.
  const perPartMulti = unicode ? 67 : 153
  const length = [...body].length
  const parts = length === 0 ? 0 : length <= perPart ? 1 : Math.ceil(length / perPartMulti)

  return {
    length,
    unicode,
    parts,
    limit: perPart,
    remaining: Math.max(0, perPart - length),
    // Over one part is legal but costs more — worth flagging, not blocking.
    overSingle: parts > 1,
  }
}

export async function smsConfig() {
  const settings = await Settings.getSingleton()
  const sms = settings.integrations?.sms ?? {}
  return {
    enabled: Boolean(sms.enabled),
    provider: sms.provider || 'alphasms',
    apiKey: decryptSecret(sms.apiKey),
    senderId: sms.senderId ?? '',
  }
}

/** Alpha SMS wants `8801XXXXXXXXX`, no plus. */
const toMsisdn = (phone) => {
  const digits = normalizeBdPhone(phone)
  return digits ? String(digits).replace(/^\+/, '') : ''
}

/**
 * Sends one message. Never throws — an SMS failure must not roll back an order
 * status change or break an admin screen; the caller gets a result to show.
 */
export async function sendSms(phone, text) {
  const cfg = await smsConfig()
  const to = toMsisdn(phone)
  const body = String(text ?? '').trim()

  if (!to) return { ok: false, error: 'That phone number is not valid' }
  if (!body) return { ok: false, error: 'Write a message first' }

  if (!cfg.enabled || !cfg.apiKey) {
    console.log(`[sms] simulated → ${to}: ${body.slice(0, 80)}`)
    return { ok: true, simulated: true, to, parts: measureSms(body).parts }
  }

  try {
    const result =
      cfg.provider === 'bulksmsbd'
        ? await sendViaBulkSmsBd(cfg, to, body)
        : await sendViaAlphaSms(cfg, to, body)
    return { ...result, to, parts: measureSms(body).parts }
  } catch (error) {
    console.error('[sms] send failed:', error.message)
    return { ok: false, error: error.message, to }
  }
}

/**
 * Alpha SMS v2 JSON API. Their success envelope is `{ error: 0, ... }`, so a
 * zero in `error` means success — worth stating, because reading it as truthy
 * would invert the result.
 */
async function sendViaAlphaSms(cfg, to, body) {
  const res = await fetch('https://api.sms.net.bd/sendsms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      api_key: cfg.apiKey,
      msg: body,
      to,
      ...(cfg.senderId ? { sender_id: cfg.senderId } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: `Alpha SMS returned ${res.status}` }
  if (Number(json.error) !== 0) {
    return { ok: false, error: json.msg || `Alpha SMS error ${json.error}` }
  }
  return { ok: true, reference: json.data?.request_id ?? null }
}

async function sendViaBulkSmsBd(cfg, to, body) {
  const url = new URL('http://bulksmsbd.net/api/smsapi')
  url.searchParams.set('api_key', cfg.apiKey)
  url.searchParams.set('type', 'text')
  url.searchParams.set('number', to)
  url.searchParams.set('senderid', cfg.senderId)
  url.searchParams.set('message', body)

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  const text = await res.text()
  // BulkSMSBD answers with a bare response code; 202 is "accepted".
  const ok = res.ok && /202/.test(text)
  return ok ? { ok: true, reference: null } : { ok: false, error: text.slice(0, 120) }
}

/**
 * Fills `{name}`, `{order}`, `{total}`, `{status}` and `{tracking}` from an
 * order, so the shop writes a template once instead of retyping every message.
 */
export function renderOrderSms(template, order) {
  const first = String(order.customer?.name ?? '').split(' ')[0]
  return String(template ?? '')
    .replace(/\{name\}/g, first)
    .replace(/\{order\}/g, order.orderNumber ?? '')
    /**
     * "Tk" rather than ৳ on purpose: the taka sign is not in the GSM-7
     * alphabet, so a single one flips the whole message to Unicode and cuts
     * the limit from 160 characters to 70 — doubling the cost of every order
     * SMS for one glyph.
     */
    .replace(/\{total\}/g, `Tk ${order.totals?.total ?? 0}`)
    .replace(/\{status\}/g, order.status ?? '')
    .replace(/\{tracking\}/g, order.delivery?.trackingNumber ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
