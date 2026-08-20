import { Router } from 'express'
import mongoose from 'mongoose'
import { Order, ORDER_STATUSES } from '../models/Order.js'
import { Product } from '../models/Product.js'
import { Customer } from '../models/Customer.js'
import { Coupon } from '../models/Coupon.js'
import { Settings } from '../models/Settings.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta, isValidBdPhone, normalizeBdPhone } from '../utils/helpers.js'
import { logActivity } from '../models/ActivityLog.js'
import { sendOrderEmail, sendOrderPlacedEmail, sendNewOrderAdminEmail } from '../services/mailer.js'
import { trackPurchase } from '../services/pixel.js'
import { ensureInvoice, renderInvoiceHtml } from '../services/invoice.js'
import * as couriers from '../services/couriers/index.js'
import { optionalCustomer } from '../middleware/customerAuth.js'

const router = Router()

/**
 * Recomputes every monetary figure from the database. The browser sends what it
 * *thinks* the total is; we ignore that entirely. Trusting client-side prices is
 * how storefronts get robbed.
 */
export async function buildOrderTotals({ lines, zoneId, couponCode }) {
  const settings = await Settings.getSingleton()

  const ids = lines.map((l) => l.productId ?? l.id).filter(Boolean)
  const slugs = lines.map((l) => l.slug).filter(Boolean)
  const products = await Product.find({
    $or: [
      { _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) } },
      { slug: { $in: slugs } },
    ],
  })

  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const byId = new Map(products.map((p) => [String(p._id), p]))

  const resolved = []
  for (const line of lines) {
    const product = byId.get(String(line.productId ?? line.id)) ?? bySlug.get(line.slug)
    if (!product) throw ApiError.badRequest(`A product in your bag is no longer available`)
    if (product.status !== 'active') throw ApiError.badRequest(`“${product.name}” is no longer available`)

    const qty = Math.max(1, Number(line.qty) || 1)
    if (product.trackInventory && product.stock < qty) {
      throw ApiError.badRequest(
        product.stock === 0
          ? `“${product.name}” has just sold out`
          : `Only ${product.stock} left of “${product.name}”`,
      )
    }

    const sizeOption = product.sizes?.find((s) => s.label === line.size)
    const unitPrice = product.price + (sizeOption?.priceDelta ?? 0)

    resolved.push({
      product: product._id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      price: unitPrice,
      compareAt: product.compareAt,
      qty,
      color: line.color ?? null,
      size: line.size ?? null,
      art: product.art,
      imageUrl: product.images?.[0]?.url ?? '',
    })
  }

  const subtotal = resolved.reduce((sum, l) => sum + l.price * l.qty, 0)

  let coupon = null
  let discount = 0
  if (couponCode) {
    const found = await Coupon.findOne({ code: String(couponCode).toUpperCase().trim() })
    if (found) {
      const check = found.isRedeemable(subtotal)
      if (check.ok) {
        coupon = found
        discount = found.discountFor(subtotal)
      }
    }
  }

  /**
   * The customer picks their delivery area. The charge still comes from the
   * stored zone rather than the request body, so the price is whatever the
   * admin has configured — a tampered charge in the payload is ignored.
   */
  const zones = settings.delivery.zones ?? []
  const zone =
    zones.find((z) => z.id === zoneId && z.enabled !== false) ??
    zones.find((z) => z.enabled !== false) ??
    zones[0] ?? { id: 'outside', label: 'Outside Dhaka', charge: 130, eta: '2–4 working days' }

  const freeShipping =
    subtotal >= settings.delivery.freeShippingThreshold ||
    (coupon?.type === 'shipping' && subtotal >= coupon.minSpend)

  const shipping = freeShipping ? 0 : zone.charge

  return {
    lines: resolved,
    zone,
    coupon,
    totals: {
      subtotal,
      discount,
      shipping,
      total: Math.max(0, subtotal - discount) + shipping,
    },
    settings,
  }
}

/* ------------------------------ public: place ---------------------------- */

router.post(
  '/',
  optionalCustomer,
  asyncHandler(async (req, res) => {
    const { customer = {}, lines = [], zoneId, couponCode, payment = {}, source = 'web', saveAddress, tracking = {} } = req.body ?? {}

    if (!Array.isArray(lines) || lines.length === 0) throw ApiError.badRequest('Your bag is empty')
    if (!customer.name || String(customer.name).trim().length < 3)
      throw ApiError.badRequest('Please enter your full name')
    if (!isValidBdPhone(customer.phone))
      throw ApiError.badRequest('Enter a valid Bangladeshi mobile number (01XXXXXXXXX)')
    if (!customer.address || String(customer.address).trim().length < 10)
      throw ApiError.badRequest('Please give a full address — house, road and area')

    const phone = normalizeBdPhone(customer.phone)

    // Repeat COD refusers get blocked at the door.
    const existing = await Customer.findOne({ phone })
    if (existing?.riskFlag === 'blocked') {
      throw ApiError.forbidden('We cannot accept orders from this number. Please contact us on WhatsApp.')
    }

    const { lines: resolvedLines, zone, coupon, totals, settings } = await buildOrderTotals({
      lines, zoneId, couponCode,
    })

    const method = payment.method ?? 'cod'
    const allowed = {
      cod: settings.payments.cod.enabled,
      sslcommerz: settings.payments.sslcommerz.enabled,
      bkash: settings.payments.bkash.enabled,
      'bkash-manual': settings.payments.bkashManual.enabled,
      'nagad-manual': settings.payments.nagadManual.enabled,
    }
    if (!allowed[method]) throw ApiError.badRequest('That payment method is not available right now')

    const advance =
      method === 'cod' && totals.total > settings.delivery.codAdvanceThreshold
        ? settings.delivery.codAdvanceAmount
        : 0

    const order = await Order.create({
      account: req.customer?._id,
      /**
       * Meta pixel cookies, captured client-side. `_fbp`/`_fbc` are first-party
       * to the storefront domain, so on the split api.domain.com deploy this
       * request never carries them itself — the browser has to hand them over
       * in the body. IP and user agent come from the request, not the client.
       */
      tracking: {
        fbp: String(tracking.fbp ?? '').slice(0, 128),
        fbc: String(tracking.fbc ?? '').slice(0, 256),
        sourceUrl: String(tracking.sourceUrl ?? req.headers.origin ?? '').slice(0, 500),
        userAgent: String(req.get('user-agent') ?? '').slice(0, 500),
        ip: req.ip ?? '',
      },
      customer: {
        name: String(customer.name).trim(),
        phone,
        altPhone: customer.altPhone ? normalizeBdPhone(customer.altPhone) : '',
        email: customer.email?.trim() ?? '',
        district: customer.district ?? '',
        area: customer.area ?? '',
        address: String(customer.address).trim(),
        notes: customer.notes ?? '',
        isGift: Boolean(customer.isGift),
        giftNote: customer.giftNote ?? '',
      },
      lines: resolvedLines,
      delivery: { zoneId: zone.id, zoneLabel: zone.label, eta: zone.eta, charge: totals.shipping },
      coupon: coupon ? { code: coupon.code, label: coupon.label } : undefined,
      totals,
      payment: {
        method,
        // Manual wallet payments arrive with a TrxID the admin still verifies.
        status: 'unpaid',
        transactionId: payment.transactionId ?? '',
        channel: method === 'bkash-manual' ? 'bKash (manual)' : method === 'nagad-manual' ? 'Nagad (manual)' : '',
        advanceAmount: advance,
      },
      status: 'pending',
      source,
    })

    // Reserve stock immediately so two shoppers cannot buy the same last unit.
    await Promise.all(
      resolvedLines.map((l) =>
        Product.updateOne(
          { _id: l.product, trackInventory: true },
          { $inc: { stock: -l.qty, soldCount: l.qty } },
        ),
      ),
    )

    if (coupon) await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } })

    const customerRecord = await Customer.findOneAndUpdate(
      { phone },
      {
        $setOnInsert: { phone },
        $set: {
          name: order.customer.name,
          email: order.customer.email || undefined,
          district: order.customer.district,
          area: order.customer.area,
          address: order.customer.address,
          lastOrderAt: new Date(),
        },
        $inc: { orderCount: 1, totalSpent: totals.total },
      },
      { upsert: true, new: true },
    )

    /**
     * Signed-in shoppers get this address remembered for next time.
     *
     * Saved onto `req.customer` — the actual signed-in account — not the
     * phone-matched `customerRecord`, because those can differ (ordering to a
     * different contact number, e.g. a gift). The checkbox choice is honoured
     * normally, but a customer's very first order saves regardless of it: an
     * account should never come out of its first purchase with zero addresses
     * saved, which is also what makes checkout autofill work from the second
     * order onward.
     */
    if (req.customer) {
      const shouldSave = saveAddress || req.customer.addresses.length === 0
      const already = req.customer.addresses.some(
        (a) => a.address === order.customer.address && a.area === order.customer.area,
      )
      if (shouldSave && !already) {
        req.customer.addresses.push({
          label: 'Home',
          name: order.customer.name,
          phone: order.customer.phone,
          district: order.customer.district,
          area: order.customer.area,
          address: order.customer.address,
          zoneId: zone.id,
        })
        if (req.customer.addresses.length === 1) req.customer.normaliseAddresses()
        await req.customer.save()
      }
    }

    // Every order gets an invoice number immediately, so the customer can print
    // one straight from the confirmation page.
    await ensureInvoice(order)

    res.status(201).json({ order })

    // --- post-response work: nothing below may delay or fail the order ---
    const brand = {
      ...(settings.brand.toObject?.() ?? settings.brand),
      address: settings.contact.address,
      phone: settings.contact.phone,
    }
    const storefrontUrl = req.headers.origin ?? process.env.STOREFRONT_URL ?? 'http://localhost:5173'
    const notify = settings.notifications ?? {}

    Promise.allSettled([
      notify.emailCustomerOnNewOrder !== false
        ? sendOrderPlacedEmail(order, { brand, storefrontUrl })
        : null,
      notify.emailAdminOnNewOrder !== false
        ? sendNewOrderAdminEmail(order, { brand, settings, adminUrl: storefrontUrl })
        : null,
      couriers.tryAutoCreate(order, { by: 'automation' }),
      // Server-side Purchase. Deduplicated against the browser pixel by
      // `event_id === orderNumber`, and still counted when the shopper never
      // reaches the confirmation page or runs an ad blocker.
      trackPurchase(order, { sourceUrl: storefrontUrl }).then((result) =>
        Order.updateOne(
          { _id: order._id },
          {
            $set: {
              'tracking.capi.sent': Boolean(result?.ok && !result?.skipped),
              'tracking.capi.at': new Date(),
              'tracking.capi.error': result?.error ?? '',
            },
          },
        ),
      ),
    ]).catch((error) => console.error('[order] post-placement tasks failed:', error))
  }),
)

/** Public: look an order up by number + phone (no account needed). */
router.get(
  '/track/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber.toUpperCase() })
    if (!order) throw ApiError.notFound('We could not find that order number')

    // Order numbers are guessable, so a matching phone is required to view one.
    const phone = normalizeBdPhone(req.query.phone ?? '')
    if (!phone || order.customer.phone !== phone) {
      throw ApiError.forbidden('Enter the mobile number used to place this order')
    }

    res.json({ order })
  }),
)


/* -------------------------------- invoice -------------------------------- */

/**
 * Serves the printable invoice as standalone HTML.
 *
 * Two ways in: an admin session, or the order's own phone number. That keeps
 * guests able to print their own invoice without an account, while stopping
 * anyone from enumerating order numbers to read other people's details.
 */
router.get(
  '/:orderNumber/invoice',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderNumber: String(req.params.orderNumber).toUpperCase() })
    if (!order) throw ApiError.notFound('Order not found')

    let authorised = false

    const phone = req.query.phone ? normalizeBdPhone(req.query.phone) : null
    if (phone && order.customer.phone === phone) authorised = true

    if (!authorised) {
      // Fall back to an admin session if one is present.
      try {
        const { default: jwt } = await import('jsonwebtoken')
        const { env } = await import('../config/env.js')
        const header = req.headers.authorization ?? ''
        const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.gbs_admin_token
        if (token) {
          jwt.verify(token, env.jwtSecret)
          authorised = true
        }
      } catch {
        authorised = false
      }
    }

    if (!authorised) {
      throw ApiError.forbidden('Add ?phone= the number used to place this order to view its invoice')
    }

    await ensureInvoice(order)
    const settings = await Settings.getSingleton()
    const html = renderInvoiceHtml(order, settings, { autoPrint: req.query.print === '1' })

    res.set('Content-Type', 'text/html; charset=utf-8')
    res.set('Content-Security-Policy', "default-src 'none'; img-src * data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'")
    res.send(html)
  }),
)

/** Emails the invoice to the customer on demand. */
router.post(
  '/:id/send-invoice',
  requireAuth,
  requireAbility('orders'),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
    if (!order) throw ApiError.notFound('Order not found')
    if (!order.customer.email) throw ApiError.badRequest('This order has no email address')

    await ensureInvoice(order)
    const settings = await Settings.getSingleton()
    const result = await sendOrderPlacedEmail(order, {
      brand: {
        ...(settings.brand.toObject?.() ?? settings.brand),
        address: settings.contact.address,
        phone: settings.contact.phone,
      },
      storefrontUrl: req.headers.origin ?? 'http://localhost:5173',
    })

    res.json({ result, invoice: order.invoice })
  }),
)

/* -------------------------------- admin ---------------------------------- */

router.get(
  '/',
  requireAuth,
  requireAbility('orders'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    const { status, paymentStatus, method, q, from, to, sort = '-createdAt' } = req.query

    const filter = {}
    if (status && status !== 'all') filter.status = status
    if (paymentStatus) filter['payment.status'] = paymentStatus
    if (method) filter['payment.method'] = method
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(from)
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`)
    }
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ orderNumber: rx }, { 'customer.name': rx }, { 'customer.phone': rx }]
    }

    const [orders, total, counts] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit),
      Order.countDocuments(filter),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ])

    res.json({
      orders,
      meta: meta(total, page, limit),
      statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    })
  }),
)

router.get(
  '/:id',
  requireAuth,
  requireAbility('orders'),
  asyncHandler(async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
      ? { _id: req.params.id }
      : { orderNumber: req.params.id.toUpperCase() }

    const order = await Order.findOne(query)
    if (!order) throw ApiError.notFound('Order not found')

    const customer = await Customer.findOne({ phone: order.customer.phone })
    const history = await Order.find({ 'customer.phone': order.customer.phone, _id: { $ne: order._id } })
      .select('orderNumber status totals createdAt')
      .sort('-createdAt')
      .limit(5)

    res.json({ order, customer, history })
  }),
)

router.patch(
  '/:id/status',
  requireAuth,
  requireAbility('orders'),
  asyncHandler(async (req, res) => {
    const { status, note, notifyEmail = true } = req.body ?? {}
    if (!ORDER_STATUSES.includes(status)) throw ApiError.badRequest('Unknown order status')

    const order = await Order.findById(req.params.id)
    if (!order) throw ApiError.notFound('Order not found')

    const previous = order.status
    if (previous === status) return res.json({ order })

    // Cancelling or returning puts stock back on the shelf.
    const returnsStock = ['cancelled', 'returned'].includes(status) && !['cancelled', 'returned'].includes(previous)
    if (returnsStock) {
      await Promise.all(
        order.lines.map((l) =>
          Product.updateOne(
            { _id: l.product, trackInventory: true },
            { $inc: { stock: l.qty, soldCount: -l.qty } },
          ),
        ),
      )
      await Customer.updateOne({ phone: order.customer.phone }, { $inc: { cancelledCount: 1 } })
    }

    order.pushStatus(status, note, req.user.name)
    await order.save()

    const settings = await Settings.getSingleton()
    let emailResult = null
    const template = {
      confirmed: 'order-confirmed',
      packed: 'order-packed',
      shipped: 'order-shipped',
      delivered: 'order-delivered',
      cancelled: 'order-cancelled',
    }[status]

    const notifyEnabled =
      notifyEmail && settings.notifications?.emailCustomerOnStatusChange !== false

    // Book the parcel automatically the moment an order is marked shipped.
    let courierResult = null
    if (status === 'shipped') {
      courierResult = await couriers.tryAutoCreate(order, { by: req.user.name })
      if (courierResult?.ok) await order.save()
    }

    if (notifyEnabled && template && order.customer.email) {
      emailResult = await sendOrderEmail(order, template, {
        brand: { ...settings.brand.toObject?.() ?? settings.brand, address: settings.contact.address, phone: settings.contact.phone },
        storefrontUrl: req.headers.origin ?? 'http://localhost:5173',
      })
      if (emailResult?.ok) {
        order.emailsSent.push({ template, at: new Date(), to: order.customer.email })
        await order.save()
      }
    }

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'order.status', entity: 'Order', entityId: String(order._id),
      summary: `${order.orderNumber}: ${previous} → ${status}`,
    })

    res.json({ order, email: emailResult, courier: courierResult })
  }),
)

router.patch(
  '/:id',
  requireAuth,
  requireAbility('orders'),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
    if (!order) throw ApiError.notFound('Order not found')

    const { customer, delivery, internalNotes, riskFlag, payment } = req.body ?? {}
    if (customer) Object.assign(order.customer, customer)
    if (delivery) Object.assign(order.delivery, delivery)
    if (payment) Object.assign(order.payment, payment)
    if (internalNotes != null) order.internalNotes = internalNotes
    if (riskFlag) {
      order.riskFlag = riskFlag
      await Customer.updateOne({ phone: order.customer.phone }, { $set: { riskFlag } })
    }

    await order.save()
    res.json({ order })
  }),
)

/** Manually confirm a bKash/Nagad "send money" payment after checking the TrxID. */
router.post(
  '/:id/confirm-payment',
  requireAuth,
  requireAbility('orders'),
  asyncHandler(async (req, res) => {
    const { transactionId, amount, channel } = req.body ?? {}
    const order = await Order.findById(req.params.id)
    if (!order) throw ApiError.notFound('Order not found')

    const paid = Number(amount ?? order.totals.total)
    order.payment.transactionId = transactionId ?? order.payment.transactionId
    order.payment.amountPaid = paid
    order.payment.channel = channel ?? order.payment.channel
    order.payment.status = paid >= order.totals.total ? 'paid' : 'advance-paid'
    order.payment.paidAt = new Date()
    order.timeline.push({
      status: order.status,
      note: `Payment marked ${order.payment.status} (৳${paid}${transactionId ? ` · ${transactionId}` : ''})`,
      by: req.user.name,
    })
    await order.save()

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'order.payment', entity: 'Order', entityId: String(order._id),
      summary: `${order.orderNumber}: payment ${order.payment.status}`,
    })

    res.json({ order })
  }),
)

router.post(
  '/:id/resend-email',
  requireAuth,
  requireAbility('orders'),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id)
    if (!order) throw ApiError.notFound('Order not found')
    if (!order.customer.email) throw ApiError.badRequest('This order has no email address')

    const settings = await Settings.getSingleton()
    const result = await sendOrderEmail(order, req.body?.template ?? 'order-confirmed', {
      brand: { ...settings.brand.toObject?.() ?? settings.brand, address: settings.contact.address, phone: settings.contact.phone },
      storefrontUrl: req.headers.origin ?? 'http://localhost:5173',
    })

    if (result?.ok) {
      order.emailsSent.push({ template: req.body?.template ?? 'order-confirmed', at: new Date(), to: order.customer.email })
      await order.save()
    }

    res.json({ result })
  }),
)

export default router
