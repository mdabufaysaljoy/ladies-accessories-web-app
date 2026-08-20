import { decryptSecret } from '../../utils/crypto.js'
import { ApiError } from '../../utils/helpers.js'

/**
 * RedX (openapi.redx.com.bd). Single static access token, like Steadfast.
 */
const HOSTS = {
  sandbox: 'https://sandbox.redx.com.bd/v1.0.0-beta',
  live: 'https://openapi.redx.com.bd/v1.0.0-beta',
}

export const id = 'redx'
export const label = 'RedX'

const creds = (cfg) => ({
  token: decryptSecret(cfg?.accessToken),
  pickupStoreId: cfg?.pickupStoreId,
  host: cfg?.sandbox ? HOSTS.sandbox : HOSTS.live,
})

export function isConfigured(cfg) {
  const c = creds(cfg)
  return Boolean(cfg?.enabled && c.token && c.pickupStoreId)
}

async function call(cfg, path, { method = 'GET', body } = {}) {
  const c = creds(cfg)
  if (!c.token) throw ApiError.badRequest('RedX access token is not set')

  const res = await fetch(`${c.host}${path}`, {
    method,
    headers: {
      'API-ACCESS-TOKEN': `Bearer ${c.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(502, data?.message ?? `RedX error (HTTP ${res.status})`)
  return data
}

export async function createConsignment(cfg, order) {
  const c = creds(cfg)
  const codAmount =
    order.payment?.status === 'paid'
      ? 0
      : Math.max(0, order.totals.total - (order.payment?.amountPaid ?? 0))

  const data = await call(cfg, '/parcel', {
    method: 'POST',
    body: {
      customer_name: order.customer.name,
      customer_phone: String(order.customer.phone).replace(/^88/, ''),
      delivery_area: order.customer.area || order.customer.district,
      delivery_area_id: undefined,
      customer_address: [order.customer.address, order.customer.area, order.customer.district]
        .filter(Boolean)
        .join(', '),
      merchant_invoice_id: order.invoice?.number || order.orderNumber,
      cash_collection_amount: String(codAmount),
      parcel_weight: 500,
      instruction: order.customer.notes || '',
      value: String(order.totals.subtotal),
      pickup_store_id: Number(c.pickupStoreId),
      parcel_details_json: order.lines.map((l) => ({
        name: l.name,
        category: l.slug,
        value: l.price * l.qty,
      })),
    },
  })

  const trackingId = data?.tracking_id ?? data?.parcel?.tracking_id
  if (!trackingId) throw new ApiError(502, data?.message ?? 'RedX did not return a tracking id')

  return {
    provider: id,
    consignmentId: String(trackingId),
    trackingCode: String(trackingId),
    status: 'pickup-pending',
    trackingUrl: `https://redx.com.bd/track-parcel/?trackingId=${trackingId}`,
    raw: data,
  }
}

export async function getStatus(cfg, { consignmentId, trackingCode }) {
  const ref = trackingCode || consignmentId
  if (!ref) throw ApiError.badRequest('No tracking id to look up')
  const data = await call(cfg, `/parcel/track/${encodeURIComponent(ref)}`)
  const events = data?.tracking ?? data?.data ?? []
  const latest = Array.isArray(events) && events.length ? events[events.length - 1] : null
  return { status: latest?.message_en ?? latest?.status ?? data?.status ?? 'unknown', raw: data }
}

export function mapStatus(courierStatus) {
  const s = String(courierStatus ?? '').toLowerCase()
  if (s.includes('delivered')) return 'delivered'
  if (s.includes('return')) return 'returned'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('pending') && s.includes('pickup')) return null
  return 'shipped'
}
