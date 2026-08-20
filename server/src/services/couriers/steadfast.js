import { decryptSecret } from '../../utils/crypto.js'
import { ApiError } from '../../utils/helpers.js'

/**
 * Steadfast Courier (portal.packzy.com).
 *
 * Auth is two static headers, so there is no token dance. The API keys the
 * admin saves are encrypted at rest and only decrypted here, inside the call.
 */
const BASE = 'https://portal.packzy.com/api/v1'

export const id = 'steadfast'
export const label = 'Steadfast Courier'

const creds = (cfg) => ({
  apiKey: decryptSecret(cfg?.apiKey),
  secretKey: decryptSecret(cfg?.secretKey),
})

export function isConfigured(cfg) {
  const { apiKey, secretKey } = creds(cfg)
  return Boolean(cfg?.enabled && apiKey && secretKey)
}

async function call(cfg, path, { method = 'GET', body } = {}) {
  const { apiKey, secretKey } = creds(cfg)
  if (!apiKey || !secretKey) throw ApiError.badRequest('Steadfast API key and secret are not set')

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Api-Key': apiKey,
      'Secret-Key': secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new ApiError(502, `Steadfast returned a non-JSON response (HTTP ${res.status})`)
  }

  if (!res.ok) {
    throw new ApiError(502, data?.message ?? `Steadfast error (HTTP ${res.status})`, data?.errors)
  }
  return data
}

/**
 * COD amount must be what the courier still needs to collect — zero for orders
 * already paid online, otherwise the customer would be charged twice.
 */
export async function createConsignment(cfg, order) {
  const codAmount =
    order.payment?.status === 'paid'
      ? 0
      : Math.max(0, order.totals.total - (order.payment?.amountPaid ?? 0))

  const data = await call(cfg, '/create_order', {
    method: 'POST',
    body: {
      invoice: order.invoice?.number || order.orderNumber,
      recipient_name: order.customer.name,
      recipient_phone: String(order.customer.phone).replace(/^88/, ''),
      recipient_address: [order.customer.address, order.customer.area, order.customer.district]
        .filter(Boolean)
        .join(', '),
      cod_amount: codAmount,
      note: order.customer.notes || '',
    },
  })

  const c = data?.consignment
  if (!c) throw new ApiError(502, data?.message ?? 'Steadfast did not return a consignment')

  return {
    provider: id,
    consignmentId: String(c.consignment_id),
    trackingCode: c.tracking_code,
    status: c.status,
    trackingUrl: c.tracking_code ? `https://steadfast.com.bd/t/${c.tracking_code}` : '',
    raw: data,
  }
}

export async function getStatus(cfg, { consignmentId, trackingCode, invoice }) {
  let path
  if (consignmentId) path = `/status_by_cid/${encodeURIComponent(consignmentId)}`
  else if (trackingCode) path = `/status_by_trackingcode/${encodeURIComponent(trackingCode)}`
  else if (invoice) path = `/status_by_invoice/${encodeURIComponent(invoice)}`
  else throw ApiError.badRequest('No consignment reference to look up')

  const data = await call(cfg, path)
  return { status: data?.delivery_status ?? data?.status ?? 'unknown', raw: data }
}

export async function getBalance(cfg) {
  const data = await call(cfg, '/get_balance')
  return { balance: data?.current_balance ?? null, raw: data }
}

/** Steadfast's vocabulary → our internal order statuses. */
export function mapStatus(courierStatus) {
  const s = String(courierStatus ?? '').toLowerCase()
  if (['delivered', 'partial_delivered'].includes(s)) return 'delivered'
  if (['cancelled', 'return', 'returned'].includes(s)) return 'returned'
  if (['in_review', 'pending'].includes(s)) return null // still with us
  return 'shipped'
}
