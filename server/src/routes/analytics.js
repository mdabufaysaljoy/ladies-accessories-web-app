import { Router } from 'express'
import { Order } from '../models/Order.js'
import { Product } from '../models/Product.js'
import { Customer } from '../models/Customer.js'
import { Conversation } from '../models/Conversation.js'
import { ActivityLog } from '../models/ActivityLog.js'
import { Visit } from '../models/Visit.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { asyncHandler } from '../utils/helpers.js'

const router = Router()
router.use(requireAuth, requireAbility('analytics'))

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

/** Revenue counts delivered + paid orders only — pending COD is not money yet. */
const REVENUE_MATCH = {
  status: { $nin: ['cancelled', 'returned'] },
}

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const range = Number(req.query.days ?? 30)
    const since = daysAgo(range)
    const prevSince = daysAgo(range * 2)

    const [current, previous, statusCounts, paymentSplit, topProducts, lowStock, recentOrders, newCustomers, unreadChats, series, traffic] =
      await Promise.all([
        Order.aggregate([
          { $match: { ...REVENUE_MATCH, createdAt: { $gte: since } } },
          { $group: { _id: null, revenue: { $sum: '$totals.total' }, orders: { $sum: 1 }, items: { $sum: { $sum: '$lines.qty' } } } },
        ]),
        Order.aggregate([
          { $match: { ...REVENUE_MATCH, createdAt: { $gte: prevSince, $lt: since } } },
          { $group: { _id: null, revenue: { $sum: '$totals.total' }, orders: { $sum: 1 } } },
        ]),
        Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Order.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$payment.method', count: { $sum: 1 }, revenue: { $sum: '$totals.total' } } },
        ]),
        Order.aggregate([
          { $match: { ...REVENUE_MATCH, createdAt: { $gte: since } } },
          { $unwind: '$lines' },
          { $group: { _id: { slug: '$lines.slug', name: '$lines.name' }, qty: { $sum: '$lines.qty' }, revenue: { $sum: { $multiply: ['$lines.price', '$lines.qty'] } } } },
          { $sort: { qty: -1 } },
          { $limit: 8 },
        ]),
        Product.find({ status: 'active', trackInventory: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } })
          .select('name slug stock lowStockThreshold')
          .sort('stock')
          .limit(10),
        Order.find().select('orderNumber customer.name customer.phone totals status payment.method createdAt').sort('-createdAt').limit(8),
        Customer.countDocuments({ createdAt: { $gte: since } }),
        Conversation.countDocuments({ unreadCount: { $gt: 0 } }),
        Order.aggregate([
          { $match: { ...REVENUE_MATCH, createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totals.total' }, orders: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        Visit.summary(since, prevSince),
      ])

    const cur = current[0] ?? { revenue: 0, orders: 0, items: 0 }
    const prev = previous[0] ?? { revenue: 0, orders: 0 }
    const pct = (a, b) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100))

    res.json({
      range,
      totals: {
        revenue: cur.revenue,
        orders: cur.orders,
        items: cur.items,
        avgOrderValue: cur.orders ? Math.round(cur.revenue / cur.orders) : 0,
        newCustomers,
        unreadChats,
        visitors: traffic.visitors,
        pageViews: traffic.pageViews,
        visitorsToday: traffic.today,
      },
      change: {
        revenue: pct(cur.revenue, prev.revenue),
        orders: pct(cur.orders, prev.orders),
        visitors: traffic.change,
      },
      /**
       * Conversion rate is the number this dashboard was missing: revenue and
       * orders alone cannot tell you whether a quiet week was fewer visitors or
       * a checkout that stopped working.
       *
       * Null until there is enough traffic to mean anything. Visit tracking
       * starts the day this is deployed while orders may go back months, so a
       * naive divide reads "2800%" on day one — a number that is arithmetically
       * correct and completely useless. Also capped, because a shop taking
       * orders over WhatsApp will genuinely book more sales than it has
       * tracked web sessions.
       */
      conversionRate:
        traffic.visitors >= 20
          ? Math.min(100, Math.round((cur.orders / traffic.visitors) * 1000) / 10)
          : null,
      traffic,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
      paymentSplit: paymentSplit.map((p) => ({ method: p._id, count: p.count, revenue: p.revenue })),
      topProducts: topProducts.map((p) => ({ ...p._id, qty: p.qty, revenue: p.revenue })),
      lowStock,
      recentOrders,
      series: series.map((s) => ({ date: s._id, revenue: s.revenue, orders: s.orders })),
    })
  }),
)

router.get(
  '/activity',
  asyncHandler(async (_req, res) => {
    const logs = await ActivityLog.find().sort('-createdAt').limit(40)
    res.json({ logs })
  }),
)

export default router
