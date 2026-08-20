import { Settings } from '../models/Settings.js'
import { decryptSecret } from '../utils/crypto.js'
import { ApiError } from '../utils/helpers.js'
import { env } from '../config/env.js'

const HOSTS = {
  sandbox: 'https://sandbox.sslcommerz.com',
  live: 'https://securepay.sslcommerz.com',
}

const config = async () => {
  const settings = await Settings.getSingleton()
  const ssl = settings.payments?.sslcommerz ?? {}
  return {
    enabled: Boolean(ssl.enabled),
    storeId: ssl.storeId,
    storePassword: decryptSecret(ssl.storePassword),
    host: ssl.sandbox ? HOSTS.sandbox : HOSTS.live,
    sandbox: Boolean(ssl.sandbox),
  }
}

export const isConfigured = async () => {
  const c = await config()
  return c.enabled && Boolean(c.storeId) && Boolean(c.storePassword)
}

/**
 * Opens a hosted-checkout session. Credentials never leave this process —
 * the browser only ever receives the returned GatewayPageURL.
 */
export async function initSession(order) {
  const c = await config()
  if (!c.enabled) throw ApiError.badRequest('SSLCommerz is not enabled')
  if (!c.storeId || !c.storePassword) {
    throw ApiError.badRequest('SSLCommerz store ID and password are not configured')
  }

  const body = new URLSearchParams({
    store_id: c.storeId,
    store_passwd: c.storePassword,
    total_amount: String(order.totals.total),
    currency: 'BDT',
    tran_id: order.orderNumber,
    success_url: `${env.publicUrl}/api/payments/sslcommerz/success`,
    fail_url: `${env.publicUrl}/api/payments/sslcommerz/fail`,
    cancel_url: `${env.publicUrl}/api/payments/sslcommerz/cancel`,
    ipn_url: `${env.publicUrl}/api/payments/sslcommerz/ipn`,
    cus_name: order.customer.name,
    cus_email: order.customer.email || 'noreply@goodsbysadia.com',
    cus_phone: order.customer.phone,
    cus_add1: order.customer.address ?? '',
    cus_city: order.customer.district ?? 'Dhaka',
    cus_country: 'Bangladesh',
    shipping_method: 'Courier',
    num_of_item: String(order.lines.length),
    product_name: order.lines.map((l) => l.name).join(', ').slice(0, 250),
    product_category: 'Beauty & Apparel',
    product_profile: 'physical-goods',
  })

  const res = await fetch(`${c.host}/gwprocess/v4/api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) throw new ApiError(502, `SSLCommerz session failed (HTTP ${res.status})`)

  const data = await res.json()
  if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
    throw new ApiError(502, data.failedreason || 'SSLCommerz did not return a gateway URL')
  }

  return { gatewayUrl: data.GatewayPageURL, sessionKey: data.sessionkey, sandbox: c.sandbox }
}

/**
 * The ONLY trustworthy proof of payment. The browser redirect and even the IPN
 * body are spoofable; this server-to-server call is not. Never mark an order
 * paid without it.
 */
export async function validatePayment(valId) {
  const c = await config()
  if (!valId) return { valid: false, reason: 'Missing val_id' }

  const url = new URL(`${c.host}/validator/api/validationserverAPI.php`)
  url.searchParams.set('val_id', valId)
  url.searchParams.set('store_id', c.storeId)
  url.searchParams.set('store_passwd', c.storePassword)
  url.searchParams.set('format', 'json')

  const res = await fetch(url)
  if (!res.ok) return { valid: false, reason: `Validator HTTP ${res.status}` }

  const data = await res.json()
  const valid = data.status === 'VALID' || data.status === 'VALIDATED'

  return {
    valid,
    reason: valid ? null : data.error || data.status,
    amount: Number(data.amount ?? 0),
    currency: data.currency,
    tranId: data.tran_id,
    channel: data.card_issuer || data.card_type || data.card_brand,
    raw: data,
  }
}
