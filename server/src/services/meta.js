import { Settings } from '../models/Settings.js'
import { decryptSecret } from '../utils/crypto.js'
import { Conversation } from '../models/Conversation.js'

/**
 * One adapter for the three Meta messaging surfaces. Each has a different send
 * endpoint but the same shape of webhook payload, so the inbox treats them
 * uniformly.
 *
 * Without tokens the service runs in SIMULATED mode — outbound messages are
 * stored on the conversation and marked `simulated: true` so the admin inbox is
 * fully usable before the shop completes Meta business verification.
 */
const GRAPH = 'https://graph.facebook.com/v21.0'

export async function metaConfig() {
  const settings = await Settings.getSingleton()
  const meta = settings.integrations?.meta ?? {}
  return {
    appSecret: decryptSecret(meta.appSecret),
    verifyToken: meta.verifyToken,
    whatsapp: {
      enabled: Boolean(meta.whatsapp?.enabled),
      phoneNumberId: meta.whatsapp?.phoneNumberId,
      accessToken: decryptSecret(meta.whatsapp?.accessToken),
    },
    messenger: {
      enabled: Boolean(meta.messenger?.enabled),
      pageId: meta.messenger?.pageId,
      pageAccessToken: decryptSecret(meta.messenger?.pageAccessToken),
    },
    instagram: {
      enabled: Boolean(meta.instagram?.enabled),
      accountId: meta.instagram?.accountId,
      accessToken: decryptSecret(meta.instagram?.accessToken),
    },
  }
}

export async function channelStatus() {
  const c = await metaConfig()
  return {
    whatsapp: {
      enabled: c.whatsapp.enabled,
      configured: Boolean(c.whatsapp.phoneNumberId && c.whatsapp.accessToken),
    },
    messenger: {
      enabled: c.messenger.enabled,
      configured: Boolean(c.messenger.pageId && c.messenger.pageAccessToken),
    },
    instagram: {
      enabled: c.instagram.enabled,
      configured: Boolean(c.instagram.accountId && c.instagram.accessToken),
    },
  }
}

async function post(url, token, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Meta API error (HTTP ${res.status})`)
  }
  return data
}

/** Sends to whichever surface the conversation belongs to. */
export async function sendMessage({ channel, externalId, text }) {
  const c = await metaConfig()

  try {
    if (channel === 'whatsapp') {
      if (!c.whatsapp.enabled || !c.whatsapp.phoneNumberId || !c.whatsapp.accessToken) {
        return { simulated: true, reason: 'WhatsApp Cloud API not configured' }
      }
      const data = await post(
        `${GRAPH}/${c.whatsapp.phoneNumberId}/messages`,
        c.whatsapp.accessToken,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: externalId,
          type: 'text',
          text: { preview_url: false, body: text },
        },
      )
      return { simulated: false, externalId: data.messages?.[0]?.id }
    }

    if (channel === 'messenger') {
      if (!c.messenger.enabled || !c.messenger.pageAccessToken) {
        return { simulated: true, reason: 'Messenger not configured' }
      }
      const data = await post(`${GRAPH}/me/messages`, c.messenger.pageAccessToken, {
        recipient: { id: externalId },
        messaging_type: 'RESPONSE',
        message: { text },
      })
      return { simulated: false, externalId: data.message_id }
    }

    if (channel === 'instagram') {
      if (!c.instagram.enabled || !c.instagram.accessToken) {
        return { simulated: true, reason: 'Instagram messaging not configured' }
      }
      const data = await post(
        `${GRAPH}/${c.instagram.accountId}/messages`,
        c.instagram.accessToken,
        { recipient: { id: externalId }, message: { text } },
      )
      return { simulated: false, externalId: data.message_id }
    }

    return { simulated: true, reason: `Channel ${channel} has no send adapter` }
  } catch (error) {
    return { simulated: false, failed: true, reason: error.message }
  }
}

/**
 * Normalises a Meta webhook body into conversation updates. Handles the
 * WhatsApp Cloud shape (`entry[].changes[].value.messages`) and the
 * Messenger/Instagram shape (`entry[].messaging[]`).
 */
export async function ingestWebhook(body) {
  const created = []

  for (const entry of body?.entry ?? []) {
    // ---- WhatsApp Cloud API ----
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}
      const profileName = value.contacts?.[0]?.profile?.name
      for (const msg of value.messages ?? []) {
        created.push(
          await upsert({
            channel: 'whatsapp',
            externalId: msg.from,
            contact: { name: profileName, phone: msg.from },
            text: msg.text?.body ?? `[${msg.type}]`,
            externalMessageId: msg.id,
            at: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
          }),
        )
      }
    }

    // ---- Messenger + Instagram ----
    for (const event of entry.messaging ?? []) {
      if (!event.message || event.message.is_echo) continue
      const channel = entry.id && event.recipient?.id === entry.id && body.object === 'instagram'
        ? 'instagram'
        : body.object === 'instagram'
          ? 'instagram'
          : 'messenger'
      created.push(
        await upsert({
          channel,
          externalId: event.sender?.id,
          contact: { username: event.sender?.username },
          text: event.message.text ?? '[attachment]',
          externalMessageId: event.message.mid,
          at: event.timestamp ? new Date(event.timestamp) : new Date(),
        }),
      )
    }
  }

  return created.filter(Boolean)
}

async function upsert({ channel, externalId, contact, text, externalMessageId, at }) {
  if (!externalId) return null

  let convo = await Conversation.findOne({ channel, externalId })
  if (!convo) {
    convo = new Conversation({
      channel,
      externalId,
      contact: { name: contact?.name ?? contact?.username ?? externalId, ...contact },
    })
  } else if (contact?.name && !convo.contact?.name) {
    convo.contact.name = contact.name
  }

  // Meta retries webhooks; skip anything we have already stored.
  if (externalMessageId && convo.messages.some((m) => m.externalId === externalMessageId)) {
    return null
  }

  convo.appendMessage({
    direction: 'in',
    text,
    externalId: externalMessageId,
    status: 'delivered',
    at,
  })

  await convo.save()
  return convo
}
