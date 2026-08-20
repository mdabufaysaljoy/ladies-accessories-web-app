import { decryptSecret } from '../../utils/crypto.js'
import { ApiError } from '../../utils/helpers.js'

/**
 * Pathao Courier (Hermes/Aladdin API).
 *
 * Unlike Steadfast this is OAuth2 — a short-lived bearer token issued from the
 * client credentials plus a merchant login. Tokens are cached per store so we
 * are not issuing one on every request.
 */
const HOSTS = {
  sandbox: 'https://courier-api-sandbox.pathao.com',
  live: 'https://api-hermes.pathao.com',
}

export const id = 'pathao'
export const label = 'Pathao Courier'

const tokenCache = new Map() // storeId → { token, expiresAt }

const creds = (cfg) => ({
  clientId: cfg?.clientId,
  clientSecret: decryptSecret(cfg?.clientSecret),
  username: cfg?.username,
  password: decryptSecret(cfg?.password),
  storeId: cfg?.storeId,
  host: cfg?.sandbox ? HOSTS.sandbox : HOSTS.live,
})

export function isConfigured(cfg) {
  const c = creds(cfg)
  return Boolean(cfg?.enabled && c.clientId && c.clientSecret && c.username && c.password && c.storeId)
}

async function getToken(c) {
  const key = `${c.host}:${c.clientId}:${c.username}`
  const cached = tokenCache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.token

  const res = await fetch(`${c.host}/aladdin/api/v1/issue-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      username: c.username,
      password: c.password,
      grant_type: 'password',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new ApiError(502, data?.message ?? 'Pathao authentication failed')
  }

  tokenCache.set(key, {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000,
  })
  return data.access_token
}

async function call(cfg, path, { method = 'GET', body } = {}) {
  const c = creds(cfg)
  if (!c.clientId || !c.clientSecret) throw ApiError.badRequest('Pathao credentials are not set')

  const token = await getToken(c)
  const res = await fetch(`${c.host}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(502, data?.message ?? `Pathao error (HTTP ${res.status})`, data?.errors)
  return data
}

export async function createConsignment(cfg, order) {
  const c = creds(cfg)
  const codAmount =
    order.payment?.status === 'paid'
      ? 0
      : Math.max(0, order.totals.total - (order.payment?.amountPaid ?? 0))

  const data = await call(cfg, '/aladdin/api/v1/orders', {
    method: 'POST',
    body: {
      store_id: Number(c.storeId),
      merchant_order_id: order.invoice?.number || order.orderNumber,
      recipient_name: order.customer.name,
      recipient_phone: String(order.customer.phone).replace(/^88/, ''),
      recipient_address: [order.customer.address, order.customer.area, order.customer.district]
        .filter(Boolean)
        .join(', '),
      delivery_type: 48, // 48 = normal, 12 = on-demand
      item_type: 2, // 2 = parcel
      item_quantity: order.lines.reduce((n, l) => n + l.qty, 0),
      item_weight: 0.5,
      amount_to_collect: codAmount,
      item_description: order.lines.map((l) => `${l.name} x${l.qty}`).join(', ').slice(0, 200),
      special_instruction: order.customer.notes || '',
    },
  })

  const d = data?.data ?? data
  if (!d?.consignment_id) throw new ApiError(502, data?.message ?? 'Pathao did not return a consignment')

  return {
    provider: id,
    consignmentId: String(d.consignment_id),
    trackingCode: String(d.consignment_id),
    status: d.order_status ?? 'Pending',
    trackingUrl: `https://merchant.pathao.com/tracking?consignment_id=${d.consignment_id}`,
    raw: data,
  }
}

export async function getStatus(cfg, { consignmentId }) {
  if (!consignmentId) throw ApiError.badRequest('No consignment id to look up')
  const data = await call(cfg, `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`)
  const d = data?.data ?? data
  return { status: d?.order_status ?? d?.delivery_status ?? 'unknown', raw: data }
}

/** Merchant stores, needed so the admin can pick the right pickup point. */
export async function listStores(cfg) {
  const data = await call(cfg, '/aladdin/api/v1/stores')
  return data?.data?.data ?? data?.data ?? []
}

export function mapStatus(courierStatus) {
  const s = String(courierStatus ?? '').toLowerCase()
  if (s.includes('delivered')) return 'delivered'
  if (s.includes('return')) return 'returned'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('pending')) return null
  return 'shipped'
}
