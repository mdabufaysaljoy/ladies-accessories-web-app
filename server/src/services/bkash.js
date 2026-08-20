import { Settings } from '../models/Settings.js'
import { decryptSecret } from '../utils/crypto.js'
import { ApiError } from '../utils/helpers.js'
import { env } from '../config/env.js'

const HOSTS = {
  sandbox: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
  live: 'https://tokenized.pay.bka.sh/v1.2.0-beta',
}

/** Grant tokens last ~1 hour; cache in-process and refresh a minute early. */
let tokenCache = { token: null, expiresAt: 0 }

const config = async () => {
  const settings = await Settings.getSingleton()
  const b = settings.payments?.bkash ?? {}
  return {
    enabled: Boolean(b.enabled),
    username: b.username,
    password: decryptSecret(b.password),
    appKey: b.appKey,
    appSecret: decryptSecret(b.appSecret),
    host: b.sandbox ? HOSTS.sandbox : HOSTS.live,
    sandbox: Boolean(b.sandbox),
  }
}

export const isConfigured = async () => {
  const c = await config()
  return c.enabled && Boolean(c.appKey) && Boolean(c.appSecret) && Boolean(c.username)
}

async function grantToken(c) {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token

  const res = await fetch(`${c.host}/tokenized/checkout/token/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username: c.username,
      password: c.password,
    },
    body: JSON.stringify({ app_key: c.appKey, app_secret: c.appSecret }),
  })

  const data = await res.json()
  if (!data.id_token) {
    throw new ApiError(502, data.statusMessage || 'bKash token grant failed')
  }

  tokenCache = {
    token: data.id_token,
    expiresAt: Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000,
  }
  return tokenCache.token
}

const headers = async (c) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: await grantToken(c),
  'X-APP-Key': c.appKey,
})

export async function createPayment(order) {
  const c = await config()
  if (!c.enabled) throw ApiError.badRequest('bKash is not enabled')
  if (!c.appKey || !c.appSecret) throw ApiError.badRequest('bKash credentials are not configured')

  const res = await fetch(`${c.host}/tokenized/checkout/create`, {
    method: 'POST',
    headers: await headers(c),
    body: JSON.stringify({
      mode: '0011',
      payerReference: order.customer.phone,
      callbackURL: `${env.publicUrl}/api/payments/bkash/callback`,
      amount: String(order.totals.total),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: order.orderNumber,
    }),
  })

  const data = await res.json()
  if (!data.bkashURL) {
    throw new ApiError(502, data.statusMessage || 'bKash did not return a checkout URL')
  }

  return { gatewayUrl: data.bkashURL, paymentId: data.paymentID, sandbox: c.sandbox }
}

/** Must be called before an order is marked paid — mirrors SSLCommerz validation. */
export async function executePayment(paymentId) {
  const c = await config()

  const res = await fetch(`${c.host}/tokenized/checkout/execute`, {
    method: 'POST',
    headers: await headers(c),
    body: JSON.stringify({ paymentID: paymentId }),
  })

  const data = await res.json()
  const valid = data.transactionStatus === 'Completed' && data.statusCode === '0000'

  return {
    valid,
    reason: valid ? null : data.statusMessage || data.transactionStatus,
    trxId: data.trxID,
    amount: Number(data.amount ?? 0),
    invoice: data.merchantInvoiceNumber,
    raw: data,
  }
}

export async function queryPayment(paymentId) {
  const c = await config()
  const res = await fetch(`${c.host}/tokenized/checkout/payment/status`, {
    method: 'POST',
    headers: await headers(c),
    body: JSON.stringify({ paymentID: paymentId }),
  })
  return res.json()
}
