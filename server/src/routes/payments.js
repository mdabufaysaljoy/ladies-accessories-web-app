import { Router } from 'express'
import { Order } from '../models/Order.js'
import { Settings } from '../models/Settings.js'
import * as sslcommerz from '../services/sslcommerz.js'
import * as bkash from '../services/bkash.js'
import { ApiError, asyncHandler } from '../utils/helpers.js'
import { sendOrderEmail } from '../services/mailer.js'

const router = Router()

const storefront = (req) => req.headers.origin || process.env.STOREFRONT_URL || 'http://localhost:5173'

/** Marks an order paid — only ever called after server-side validation. */
async function markPaid(order, { channel, transactionId, validationId, amount, raw, req }) {
  order.payment.status = 'paid'
  order.payment.channel = channel
  order.payment.transactionId = transactionId
  order.payment.validationId = validationId
  order.payment.amountPaid = amount
  order.payment.paidAt = new Date()
  order.payment.gatewayResponse = raw
  if (order.status === 'pending') order.pushStatus('confirmed', 'Payment received', 'system')
  await order.save()

  const settings = await Settings.getSingleton()
  if (order.customer.email) {
    await sendOrderEmail(order, 'payment-received', {
      brand: { ...(settings.brand.toObject?.() ?? settings.brand), address: settings.contact.address, phone: settings.contact.phone },
      storefrontUrl: storefront(req),
    })
  }
}

/* ------------------------------ SSLCommerz ------------------------------- */

router.post(
  '/sslcommerz/init',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderNumber: String(req.body?.orderNumber ?? '').toUpperCase() })
    if (!order) throw ApiError.notFound('Order not found')
    if (order.payment.status === 'paid') throw ApiError.badRequest('This order is already paid')

    const session = await sslcommerz.initSession(order)
    order.payment.gatewayResponse = { sessionKey: session.sessionKey }
    await order.save()

    res.json(session)
  }),
)

/**
 * SSLCommerz posts here after payment. The body is NOT trusted — we re-validate
 * `val_id` server-to-server before touching the order, then redirect the
 * customer to the storefront.
 */
router.post(
  '/sslcommerz/success',
  asyncHandler(async (req, res) => {
    const { tran_id: tranId, val_id: valId } = req.body ?? {}
    const order = await Order.findOne({ orderNumber: String(tranId ?? '').toUpperCase() })
    if (!order) return res.redirect(`${storefront(req)}/payment/failed?reason=order-not-found`)

    const result = await sslcommerz.validatePayment(valId)

    if (!result.valid) {
      order.payment.status = 'failed'
      order.payment.gatewayResponse = result.raw
      await order.save()
      return res.redirect(`${storefront(req)}/payment/failed?order=${order.orderNumber}`)
    }

    // Guard against an under-payment slipping through a tampered redirect.
    if (result.amount < order.totals.total) {
      order.payment.status = 'failed'
      order.timeline.push({ status: order.status, note: `Amount mismatch: paid ৳${result.amount} of ৳${order.totals.total}`, by: 'system' })
      await order.save()
      return res.redirect(`${storefront(req)}/payment/failed?order=${order.orderNumber}&reason=amount`)
    }

    await markPaid(order, {
      channel: result.channel ?? 'SSLCommerz',
      transactionId: result.tranId,
      validationId: valId,
      amount: result.amount,
      raw: result.raw,
      req,
    })

    res.redirect(`${storefront(req)}/order/${order.orderNumber}?paid=1`)
  }),
)

router.post('/sslcommerz/fail', asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderNumber: String(req.body?.tran_id ?? '').toUpperCase() })
  if (order) { order.payment.status = 'failed'; await order.save() }
  res.redirect(`${storefront(req)}/payment/failed?order=${order?.orderNumber ?? ''}`)
}))

router.post('/sslcommerz/cancel', asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderNumber: String(req.body?.tran_id ?? '').toUpperCase() })
  res.redirect(`${storefront(req)}/checkout?cancelled=1&order=${order?.orderNumber ?? ''}`)
}))

/** Server-to-server notification — the authoritative signal if the user closes the tab. */
router.post(
  '/sslcommerz/ipn',
  asyncHandler(async (req, res) => {
    const { tran_id: tranId, val_id: valId } = req.body ?? {}
    const order = await Order.findOne({ orderNumber: String(tranId ?? '').toUpperCase() })
    if (!order) return res.json({ ok: false })

    const result = await sslcommerz.validatePayment(valId)
    if (result.valid && order.payment.status !== 'paid' && result.amount >= order.totals.total) {
      await markPaid(order, {
        channel: result.channel ?? 'SSLCommerz',
        transactionId: result.tranId,
        validationId: valId,
        amount: result.amount,
        raw: result.raw,
        req,
      })
    }
    res.json({ ok: true })
  }),
)

/* --------------------------------- bKash --------------------------------- */

router.post(
  '/bkash/create',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderNumber: String(req.body?.orderNumber ?? '').toUpperCase() })
    if (!order) throw ApiError.notFound('Order not found')
    if (order.payment.status === 'paid') throw ApiError.badRequest('This order is already paid')

    const session = await bkash.createPayment(order)
    order.payment.paymentId = session.paymentId
    await order.save()

    res.json(session)
  }),
)

router.get(
  '/bkash/callback',
  asyncHandler(async (req, res) => {
    const { paymentID, status } = req.query
    const order = await Order.findOne({ 'payment.paymentId': paymentID })
    if (!order) return res.redirect(`${storefront(req)}/payment/failed?reason=order-not-found`)

    if (status === 'cancel' || status === 'failure') {
      order.payment.status = 'failed'
      await order.save()
      return res.redirect(`${storefront(req)}/payment/failed?order=${order.orderNumber}`)
    }

    // "success" from the redirect only means the user finished the bKash UI.
    // Execute is what actually captures the money and proves it.
    const result = await bkash.executePayment(paymentID)
    if (!result.valid || result.amount < order.totals.total) {
      order.payment.status = 'failed'
      order.payment.gatewayResponse = result.raw
      await order.save()
      return res.redirect(`${storefront(req)}/payment/failed?order=${order.orderNumber}`)
    }

    await markPaid(order, {
      channel: 'bKash',
      transactionId: result.trxId,
      validationId: paymentID,
      amount: result.amount,
      raw: result.raw,
      req,
    })

    res.redirect(`${storefront(req)}/order/${order.orderNumber}?paid=1`)
  }),
)

/* --------------------------- available methods --------------------------- */

router.get(
  '/methods',
  asyncHandler(async (_req, res) => {
    const settings = await Settings.getSingleton()
    const p = settings.payments

    res.json({
      methods: [
        p.cod.enabled && {
          id: 'cod', name: 'Cash on Delivery', nameBn: 'ক্যাশ অন ডেলিভারি',
          tagline: 'Pay the courier when your parcel arrives',
          taglineBn: 'পার্সেল হাতে পেয়ে কুরিয়ারকে টাকা দিন',
          detail: p.cod.instructions, badge: 'Most popular',
        },
        p.bkashManual.enabled && {
          id: 'bkash-manual', name: 'bKash — Send Money', nameBn: 'বিকাশ — সেন্ড মানি',
          tagline: `Send to ${p.bkashManual.number}, then enter your TrxID`,
          taglineBn: `${p.bkashManual.number} নম্বরে সেন্ড মানি করে TrxID দিন`,
          detail: p.bkashManual.instructions,
          number: p.bkashManual.number, accountType: p.bkashManual.accountType,
          requiresTransactionId: true, badge: 'Instant',
        },
        p.nagadManual.enabled && {
          id: 'nagad-manual', name: 'Nagad — Send Money', nameBn: 'নগদ — সেন্ড মানি',
          tagline: `Send to ${p.nagadManual.number}, then enter your TrxID`,
          detail: p.nagadManual.instructions,
          number: p.nagadManual.number, requiresTransactionId: true,
        },
        p.bkash.enabled && {
          id: 'bkash', name: 'bKash Checkout', nameBn: 'বিকাশ চেকআউট',
          tagline: 'Pay securely inside the bKash app', badge: 'Secure',
        },
        p.sslcommerz.enabled && {
          id: 'sslcommerz', name: 'Pay Online — SSLCommerz', nameBn: 'অনলাইন পেমেন্ট',
          tagline: 'bKash · Nagad · Rocket · Upay · Visa · Mastercard · Net banking',
          taglineBn: 'বিকাশ · নগদ · রকেট · উপায় · কার্ড · নেট ব্যাংকিং',
          badge: 'Secure',
        },
      ].filter(Boolean),
    })
  }),
)

export default router
