/**
 * Payment layer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT — how SSLCommerz actually works
 * ─────────────────────────────────────────────────────────────────────────────
 * SSLCommerz session creation REQUIRES your `store_id` + `store_passwd`. Those
 * are secrets and must NEVER be shipped in front-end JavaScript. The correct
 * flow is:
 *
 *   1. Browser  →  POST /api/payment/sslcommerz/init   (this file)
 *   2. Server   →  POST https://securepay.sslcommerz.com/gwprocess/v4/api.php
 *                  with store_id, store_passwd, total_amount, tran_id, and the
 *                  success/fail/cancel/ipn URLs.
 *   3. Server   →  returns { GatewayPageURL }
 *   4. Browser  →  window.location.href = GatewayPageURL
 *   5. Customer pays (bKash / Nagad / Rocket / card / net banking)
 *   6. SSLCommerz → POSTs to your success_url and your ipn_url
 *   7. Server   →  MUST call the Validation API with `val_id` before marking
 *                  the order paid. Never trust the redirect payload alone.
 *
 * Sandbox host: https://sandbox.sslcommerz.com/gwprocess/v4/api.php
 * Live host:    https://securepay.sslcommerz.com/gwprocess/v4/api.php
 *
 * Until that backend exists, `MOCK_GATEWAY` below keeps the storefront fully
 * clickable by simulating the redirect with an in-app gateway screen.
 * Set VITE_PAYMENT_API to your real endpoint to switch over — no other change.
 */

const PAYMENT_API = import.meta.env.VITE_PAYMENT_API ?? ''
const MOCK_GATEWAY = !PAYMENT_API

export const PAYMENT_METHODS = [
  {
    id: 'cod',
    name: 'Cash on Delivery',
    tagline: 'Pay the courier when your parcel arrives',
    detail:
      'Available in all 64 districts. Please keep the exact amount ready — couriers often cannot give change.',
    badge: 'Most popular',
  },
  {
    id: 'sslcommerz',
    name: 'Pay Online — SSLCommerz',
    tagline: 'bKash · Nagad · Rocket · Upay · Visa · Mastercard · Net banking',
    detail:
      'You will be redirected to SSLCommerz’s secure gateway. Your card and wallet details are entered on their servers — we never see or store them.',
    badge: 'Secure',
  },
]

/** Wallets/cards shown on the gateway screen. */
export const SSL_CHANNELS = [
  { id: 'bkash', name: 'bKash', color: '#E2136E', kind: 'wallet' },
  { id: 'nagad', name: 'Nagad', color: '#EE1C25', kind: 'wallet' },
  { id: 'rocket', name: 'Rocket', color: '#8C3494', kind: 'wallet' },
  { id: 'upay', name: 'Upay', color: '#F58220', kind: 'wallet' },
  { id: 'visa', name: 'Visa', color: '#1A1F71', kind: 'card' },
  { id: 'mastercard', name: 'Mastercard', color: '#EB001B', kind: 'card' },
  { id: 'amex', name: 'American Express', color: '#006FCF', kind: 'card' },
  { id: 'nexus', name: 'DBBL Nexus', color: '#004C8C', kind: 'card' },
  { id: 'ibanking', name: 'Internet Banking', color: '#2F5D5E', kind: 'bank' },
]

/**
 * Ask the backend to open an SSLCommerz session.
 * @returns {Promise<{ gatewayUrl: string, sessionKey: string, mock: boolean }>}
 */
export async function initSslcommerzSession(order) {
  if (MOCK_GATEWAY) {
    // Simulated network latency so the loading state is real in the demo.
    await new Promise((r) => setTimeout(r, 900))
    return {
      gatewayUrl: `/payment/sslcommerz?tran_id=${order.id}`,
      sessionKey: `SANDBOX-${order.id}`,
      mock: true,
    }
  }

  const response = await fetch(`${PAYMENT_API}/sslcommerz/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tran_id: order.id,
      total_amount: order.totals.total,
      currency: 'BDT',
      cus_name: order.customer.name,
      cus_email: order.customer.email || 'noreply@goodsbysadia.com',
      cus_phone: order.customer.phone,
      cus_add1: order.customer.address,
      cus_city: order.customer.district,
      shipping_method: 'Courier',
      product_name: order.lines.map((l) => l.name).join(', ').slice(0, 250),
      product_category: 'Beauty & Apparel',
      product_profile: 'physical-goods',
    }),
  })

  if (!response.ok) throw new Error(`Gateway session failed (${response.status})`)

  const data = await response.json()
  if (!data.GatewayPageURL) throw new Error(data.failedreason || 'Gateway did not return a payment URL')

  return { gatewayUrl: data.GatewayPageURL, sessionKey: data.sessionkey, mock: false }
}

/**
 * Server-side validation of a completed transaction. The success redirect alone
 * is spoofable — this call (or the IPN) is what makes an order genuinely paid.
 */
export async function validateTransaction(valId) {
  if (MOCK_GATEWAY) {
    await new Promise((r) => setTimeout(r, 600))
    return { status: 'VALID', val_id: valId, mock: true }
  }
  const response = await fetch(`${PAYMENT_API}/sslcommerz/validate?val_id=${encodeURIComponent(valId)}`)
  if (!response.ok) throw new Error('Validation request failed')
  return response.json()
}

export const isMockGateway = MOCK_GATEWAY
