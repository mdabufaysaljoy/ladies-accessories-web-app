/**
 * Static payment-brand data for the storefront (footer badges, method lists).
 *
 * The live checkout does NOT use this file — it calls the API, which talks to
 * SSLCommerz and bKash server-side and validates every transaction there. The
 * simulated gateway that used to live here was removed before launch: it could
 * render a "paid" confirmation from the browser alone, which is exactly the
 * screen someone would want to show a delivery rider.
 */


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
