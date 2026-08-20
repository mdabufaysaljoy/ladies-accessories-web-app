import { Router } from 'express'
import mongoose from 'mongoose'
import { Order } from '../models/Order.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, normalizeBdPhone } from '../utils/helpers.js'
import { logActivity } from '../models/ActivityLog.js'
import * as couriers from '../services/couriers/index.js'

const router = Router()

/* --------------------------- public: tracking ---------------------------- */

/**
 * Live courier tracking for a shopper. Requires the phone number on the order
 * because order numbers are guessable, and returns only what a customer needs
 * to see — never the raw courier payload.
 */
router.get(
  '/track/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderNumber: String(req.params.orderNumber).toUpperCase() })
    if (!order) throw ApiError.notFound('We could not find that order number')

    const phone = normalizeBdPhone(req.query.phone ?? '')
    if (!phone || order.customer.phone !== phone) {
      throw ApiError.forbidden('Enter the mobile number used to place this order')
    }

    let synced = null
    // Refresh from the courier at most once a minute, and never for a finished parcel.
    const stale =
      !order.delivery?.lastSyncedAt || Date.now() - new Date(order.delivery.lastSyncedAt) > 60_000
    const finished = ['delivered', 'returned', 'cancelled'].includes(order.status)

    if (order.delivery?.consignmentId && stale && !finished) {
      try {
        const result = await couriers.syncStatus(order, { by: 'tracking-page' })
        synced = result.courierStatus
      } catch (error) {
        // Courier downtime must not break the tracking page.
        console.warn('[courier] tracking sync failed:', error.message)
      }
    }

    res.json({
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        totals: order.totals,
        invoice: order.invoice,
        payment: { method: order.payment.method, status: order.payment.status },
        lines: order.lines.map((l) => ({
          name: l.name, slug: l.slug, qty: l.qty, price: l.price, color: l.color, size: l.size, art: l.art,
        })),
        delivery: {
          zoneLabel: order.delivery.zoneLabel,
          eta: order.delivery.eta,
          courier: order.delivery.courier,
          trackingNumber: order.delivery.trackingNumber,
          trackingUrl: order.delivery.trackingUrl,
          courierStatus: order.delivery.courierStatus ?? synced,
          dispatchedAt: order.delivery.dispatchedAt,
          deliveredAt: order.delivery.deliveredAt,
          lastSyncedAt: order.delivery.lastSyncedAt,
        },
        timeline: order.timeline.map((t) => ({ status: t.status, note: t.note, at: t.at })),
      },
    })
  }),
)

/* -------------------------------- admin ---------------------------------- */

router.use(requireAuth, requireAbility('orders'))

router.get(
  '/',
  asyncHandler(async (_req, res) => res.json({ couriers: await couriers.statusAll() })),
)

router.get(
  '/:provider/balance',
  asyncHandler(async (req, res) => res.json(await couriers.getBalance(req.params.provider))),
)

/** Pathao requires a numeric store id — let the admin pick from their stores. */
router.get(
  '/:provider/stores',
  asyncHandler(async (req, res) => res.json({ stores: await couriers.listStores(req.params.provider) })),
)

const findOrder = async (id) => {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { orderNumber: String(id).toUpperCase() }
  const order = await Order.findOne(query)
  if (!order) throw ApiError.notFound('Order not found')
  return order
}

router.post(
  '/orders/:id/consignment',
  asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id)
    const { order: updated, result } = await couriers.createConsignment(order, req.body?.provider, {
      by: req.user.name,
    })

    await logActivity({
      actor: req.user._id,
      actorName: req.user.name,
      action: 'courier.consignment',
      entity: 'Order',
      entityId: String(order._id),
      summary: `${order.orderNumber} sent to ${updated.delivery.courier} (${result.consignmentId})`,
    })

    res.status(201).json({ order: updated, consignment: result })
  }),
)

router.post(
  '/orders/:id/sync',
  asyncHandler(async (req, res) => {
    const order = await findOrder(req.params.id)
    const result = await couriers.syncStatus(order, { by: req.user.name })
    res.json({
      order: result.order,
      courierStatus: result.courierStatus,
      advancedTo: result.advancedTo,
      changed: result.changed,
    })
  }),
)

/** Refresh every in-flight parcel in one go. */
router.post(
  '/sync-all',
  asyncHandler(async (req, res) => {
    const orders = await Order.find({
      'delivery.consignmentId': { $exists: true, $ne: '' },
      status: { $nin: ['delivered', 'returned', 'cancelled'] },
    }).limit(100)

    const results = []
    for (const order of orders) {
      try {
        const r = await couriers.syncStatus(order, { by: req.user.name })
        results.push({
          orderNumber: order.orderNumber,
          courierStatus: r.courierStatus,
          advancedTo: r.advancedTo,
        })
      } catch (error) {
        results.push({ orderNumber: order.orderNumber, error: error.message })
      }
    }

    res.json({ checked: orders.length, results })
  }),
)

export default router
