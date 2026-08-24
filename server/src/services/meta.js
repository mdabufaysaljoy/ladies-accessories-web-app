import { Settings } from '../models/Settings.js'
import { decryptSecret } from '../utils/crypto.js'
import { Conversation } from '../models/Conversation.js'

/**
 * One adapter for the three Meta messaging surfaces.
 *
 * Each surface has a different send endpoint but the same general webhook
 * handling pattern, so the inbox treats them uniformly.
 *
 * Without tokens the service runs in SIMULATED mode — outbound messages are
 * stored on the conversation and marked `simulated: true` so the admin inbox
 * remains usable before the shop completes Meta business verification.
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
      configured: Boolean(
        c.whatsapp.phoneNumberId && c.whatsapp.accessToken,
      ),
    },

    messenger: {
      enabled: c.messenger.enabled,
      configured: Boolean(
        c.messenger.pageId && c.messenger.pageAccessToken,
      ),
    },

    instagram: {
      enabled: c.instagram.enabled,
      configured: Boolean(
        c.instagram.accountId && c.instagram.accessToken,
      ),
    },
  }
}

/**
 * Subscribes this app to a Facebook Page's messaging events.
 *
 * Verifying the webhook only tells Meta the endpoint is real.
 * The Page itself must also be subscribed to the webhook.
 */
export async function subscribePageToWebhook() {
  const c = await metaConfig()
  const { pageId, pageAccessToken } = c.messenger

  if (!pageId) {
    return {
      ok: false,
      error: 'Add your Facebook Page ID first.',
    }
  }

  if (!pageAccessToken) {
    return {
      ok: false,
      error: 'Add a Page access token first.',
    }
  }

  const fields = [
    'messages',
    'messaging_postbacks',
    'messaging_optins',
    'message_deliveries',
    'message_reads',
    'messaging_referrals',
  ].join(',')

  try {
    const res = await fetch(
      `${GRAPH}/${encodeURIComponent(
        pageId,
      )}/subscribed_apps?subscribed_fields=${fields}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pageAccessToken}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    )

    const json = await res.json().catch(() => ({}))

    if (!res.ok || json.error) {
      return {
        ok: false,
        error:
          json.error?.message ??
          `Meta returned ${res.status}`,
      }
    }

    return {
      ok: true,
      fields: fields.split(','),
    }
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    }
  }
}

/**
 * What Meta thinks is currently subscribed.
 */
export async function pageSubscriptionStatus() {
  const c = await metaConfig()
  const { pageId, pageAccessToken } = c.messenger

  if (!pageId || !pageAccessToken) {
    return {
      subscribed: false,
      reason: 'not-configured',
    }
  }

  try {
    const res = await fetch(
      `${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`,
      {
        headers: {
          Authorization: `Bearer ${pageAccessToken}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    )

    const json = await res.json().catch(() => ({}))

    if (!res.ok || json.error) {
      return {
        subscribed: false,
        reason:
          json.error?.message ??
          `Meta returned ${res.status}`,
      }
    }

    const apps = json.data ?? []

    return {
      subscribed: apps.length > 0,
      fields: apps[0]?.subscribed_fields ?? [],
      pageName: apps[0]?.name ?? '',
    }
  } catch (error) {
    return {
      subscribed: false,
      reason: error.message,
    }
  }
}

/**
 * Generic POST helper for Meta Graph API.
 */
async function post(url, token, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(
      data?.error?.message ??
        `Meta API error (HTTP ${res.status})`,
    )
  }

  return data
}

/**
 * Fetches a Messenger user's profile using their Page-Scoped ID (PSID).
 *
 * Messenger webhook events normally provide:
 *
 * event.sender.id
 *
 * That ID is the PSID, not the customer's visible name.
 *
 * We use the Page Access Token to ask Meta for the customer's profile.
 */
async function getMessengerProfile(psid, pageAccessToken) {
  if (!psid || !pageAccessToken) {
    return null
  }

  try {
    const url = new URL(
      `${GRAPH}/${encodeURIComponent(psid)}`,
    )

    url.searchParams.set(
      'fields',
      'name,first_name,last_name,profile_pic',
    )

    url.searchParams.set(
      'access_token',
      pageAccessToken,
    )

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || data.error) {
      console.error(
        'Failed to fetch Messenger profile:',
        data.error ?? `Meta returned ${res.status}`,
      )

      return null
    }

    return data
  } catch (error) {
    console.error(
      'Messenger profile fetch failed:',
      error.message,
    )

    return null
  }
}

/**
 * Sends a message to whichever surface the conversation belongs to.
 */
export async function sendMessage({
  channel,
  externalId,
  text,
}) {
  const c = await metaConfig()

  try {
    // --------------------------------------------------
    // WhatsApp
    // --------------------------------------------------

    if (channel === 'whatsapp') {
      if (
        !c.whatsapp.enabled ||
        !c.whatsapp.phoneNumberId ||
        !c.whatsapp.accessToken
      ) {
        return {
          simulated: true,
          reason: 'WhatsApp Cloud API not configured',
        }
      }

      const data = await post(
        `${GRAPH}/${c.whatsapp.phoneNumberId}/messages`,
        c.whatsapp.accessToken,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: externalId,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        },
      )

      return {
        simulated: false,
        externalId: data.messages?.[0]?.id,
      }
    }

    // --------------------------------------------------
    // Messenger
    // --------------------------------------------------

    if (channel === 'messenger') {
      if (
        !c.messenger.enabled ||
        !c.messenger.pageAccessToken
      ) {
        return {
          simulated: true,
          reason: 'Messenger not configured',
        }
      }

      const data = await post(
        `${GRAPH}/me/messages`,
        c.messenger.pageAccessToken,
        {
          recipient: {
            id: externalId,
          },
          messaging_type: 'RESPONSE',
          message: {
            text,
          },
        },
      )

      return {
        simulated: false,
        externalId: data.message_id,
      }
    }

    // --------------------------------------------------
    // Instagram
    // --------------------------------------------------

    if (channel === 'instagram') {
      if (
        !c.instagram.enabled ||
        !c.instagram.accessToken
      ) {
        return {
          simulated: true,
          reason: 'Instagram messaging not configured',
        }
      }

      const data = await post(
        `${GRAPH}/${c.instagram.accountId}/messages`,
        c.instagram.accessToken,
        {
          recipient: {
            id: externalId,
          },
          message: {
            text,
          },
        },
      )

      return {
        simulated: false,
        externalId: data.message_id,
      }
    }

    return {
      simulated: true,
      reason: `Channel ${channel} has no send adapter`,
    }
  } catch (error) {
    return {
      simulated: false,
      failed: true,
      reason: error.message,
    }
  }
}

/**
 * Normalises a Meta webhook body into conversation updates.
 *
 * Handles:
 *
 * WhatsApp:
 * entry[].changes[].value.messages
 *
 * Messenger / Instagram:
 * entry[].messaging[]
 */
export async function ingestWebhook(body) {
  const created = []

  // --------------------------------------------------
  // Get Meta config once for this webhook
  // --------------------------------------------------

  const config = await metaConfig()

  for (const entry of body?.entry ?? []) {
    // ==================================================
    // WhatsApp Cloud API
    // ==================================================

    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}

      const profileName =
        value.contacts?.[0]?.profile?.name

      for (const msg of value.messages ?? []) {
        created.push(
          await upsert({
            channel: 'whatsapp',

            externalId: msg.from,

            contact: {
              name: profileName,
              phone: msg.from,
            },

            text:
              msg.text?.body ??
              `[${msg.type}]`,

            externalMessageId: msg.id,

            at: msg.timestamp
              ? new Date(
                  Number(msg.timestamp) * 1000,
                )
              : new Date(),
          }),
        )
      }
    }

    // ==================================================
    // Messenger + Instagram
    // ==================================================

    for (const event of entry.messaging ?? []) {
      // Ignore events that don't contain messages.
      //
      // Also ignore our own sent messages (echoes).
      if (
        !event.message ||
        event.message.is_echo
      ) {
        continue
      }

      const channel =
        body.object === 'instagram'
          ? 'instagram'
          : 'messenger'

      const externalId =
        event.sender?.id

      if (!externalId) {
        continue
      }

      // ------------------------------------------------
      // Contact information
      // ------------------------------------------------

      let contact = {}

      // Messenger gives us the PSID.
      // Fetch the customer's profile from Meta.
      if (
        channel === 'messenger' &&
        config.messenger.pageAccessToken
      ) {
        const profile =
          await getMessengerProfile(
            externalId,
            config.messenger.pageAccessToken,
          )

        if (profile) {
          /**
           * Map onto the fields the Conversation schema actually has.
           * `profilePic`, `firstName` and `lastName` are not schema paths, so
           * Mongoose silently dropped them — the profile was fetched on every
           * message and thrown away, which is why the inbox only ever showed a
           * raw PSID.
           *
           * Messenger frequently returns first/last name with no combined
           * `name`, so compose one rather than letting it fall through to the
           * numeric ID.
           */
          const fullName =
            profile.name ||
            [profile.first_name, profile.last_name]
              .filter(Boolean)
              .join(' ')
              .trim()

          contact = {
            ...(fullName ? { name: fullName } : {}),
            ...(profile.profile_pic ? { avatarUrl: profile.profile_pic } : {}),
          }
        }
      }

      // Instagram can sometimes provide username
      // depending on the webhook payload/API version.
      if (
        channel === 'instagram' &&
        event.sender?.username
      ) {
        contact = {
          username: event.sender.username,
        }
      }

      // ------------------------------------------------
      // Save the message
      // ------------------------------------------------

      created.push(
        await upsert({
          channel,

          externalId,

          contact,

          text:
            event.message.text ??
            '[attachment]',

          externalMessageId:
            event.message.mid,

          at: event.timestamp
            ? new Date(event.timestamp)
            : new Date(),
        }),
      )
    }
  }

  return created.filter(Boolean)
}

/**
 * Creates or updates a conversation.
 */
async function upsert({
  channel,
  externalId,
  contact,
  text,
  externalMessageId,
  at,
}) {
  if (!externalId) {
    return null
  }

  // --------------------------------------------------
  // Find existing conversation
  // --------------------------------------------------

  let convo = await Conversation.findOne({
    channel,
    externalId,
  })

  // --------------------------------------------------
  // Create new conversation
  // --------------------------------------------------

  if (!convo) {
    convo = new Conversation({
      channel,
      externalId,

      contact: {
        name:
          contact?.name ??
          contact?.username ??
          externalId,

        ...contact,
      },
    })
  }

  // --------------------------------------------------
  // Update contact information
  // --------------------------------------------------

  else {
    if (contact?.name) {
      convo.contact.name = contact.name
    }

    /**
     * Refresh the picture on every message. Facebook's profile_pic is a signed
     * URL that expires after a while, so a stored one goes stale and starts
     * 404-ing; re-writing it each time keeps the inbox self-healing.
     *
     * `firstName`/`lastName`/`profilePic` are not paths on this schema —
     * assigning them was a silent no-op, which is why pictures never appeared.
     */
    if (contact?.avatarUrl) {
      convo.contact.avatarUrl = contact.avatarUrl
    }

    if (contact?.username) {
      convo.contact.username =
        contact.username
    }

    if (contact?.phone) {
      convo.contact.phone =
        contact.phone
    }
  }

  // --------------------------------------------------
  // Prevent duplicate webhook messages
  // --------------------------------------------------

  if (
    externalMessageId &&
    convo.messages.some(
      (m) =>
        m.externalId ===
        externalMessageId,
    )
  ) {
    return null
  }

  // --------------------------------------------------
  // Append incoming message
  // --------------------------------------------------

  convo.appendMessage({
    direction: 'in',

    text,

    externalId:
      externalMessageId,

    status: 'delivered',

    at,
  })

  await convo.save()

  return convo
}