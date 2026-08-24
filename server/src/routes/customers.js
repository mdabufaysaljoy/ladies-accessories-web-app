import { Router } from 'express'
import { Customer } from '../models/Customer.js'
import { Order } from '../models/Order.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta } from '../utils/helpers.js'
import { buildExport } from '../services/dataExport.js'
import { logActivity } from '../models/ActivityLog.js'

const router = Router()
router.use(requireAuth, requireAbility('customers'))

/**
 * GET /api/customers/export?format=csv|xlsx|json
 *
 * Honours the same filters as the list, so the admin exports the segment they
 * are looking at. Declared above `/:id` so "export" is never read as an id.
 *
 * This file is a customer list — names, phone numbers, addresses and spend.
 * It is gated on the `customers` ability and the download is logged, because
 * exporting one is exactly what a leaving employee would do.
 */
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const format = ['csv', 'xlsx', 'json'].includes(req.query.format) ? req.query.format : 'csv'
    const { q, segment, risk } = req.query

    const filter = {}
    if (risk) filter.riskFlag = risk
    if (segment === 'vip') filter.orderCount = { $gte: 5 }
    if (segment === 'repeat') filter.orderCount = { $gte: 2, $lt: 5 }
    if (segment === 'new') filter.orderCount = { $lte: 1 }
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }]
    }

    const customers = await Customer.find(filter).sort('-lastOrderAt').limit(10000)

    const columns = [
      { header: 'name', key: 'name', width: 26 },
      { header: 'phone', key: 'phone', width: 16 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'district', key: 'district' },
      { header: 'area', key: 'area' },
      { header: 'address', key: 'address', width: 44 },
      { header: 'orders', key: 'orders' },
      { header: 'totalSpent', key: 'totalSpent' },
      { header: 'segment', key: 'segment' },
      { header: 'riskFlag', key: 'riskFlag' },
      { header: 'acceptsMarketing', key: 'acceptsMarketing' },
      { header: 'hasAccount', key: 'hasAccount' },
      { header: 'lastOrderAt', key: 'lastOrderAt' },
      { header: 'createdAt', key: 'createdAt' },
    ]

    const asDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')
    const rows = customers.map((c) => ({
      name: c.name ?? '',
      // Kept as text so a leading zero survives Excel's number guessing.
      phone: c.phone ?? '',
      email: c.email ?? '',
      district: c.district ?? '',
      area: c.area ?? '',
      address: c.address ?? '',
      orders: c.orderCount ?? 0,
      totalSpent: c.totalSpent ?? 0,
      segment: c.segment ?? '',
      riskFlag: c.riskFlag ?? '',
      acceptsMarketing: c.acceptsMarketing ? 'yes' : 'no',
      hasAccount: c.hasAccount ? 'yes' : 'no',
      lastOrderAt: asDate(c.lastOrderAt),
      createdAt: asDate(c.createdAt),
    }))

    const out = await buildExport({ format, columns, rows, name: 'customers', sheetName: 'Customers' })

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'customer.export', entity: 'Customer',
      summary: `Exported ${rows.length} customers as ${format.toUpperCase()}`,
    })

    res.setHeader('Content-Type', out.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`)
    res.send(out.body)
  }),
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    const { q, segment, risk, sort = '-lastOrderAt' } = req.query

    const filter = {}
    if (risk) filter.riskFlag = risk
    if (segment === 'vip') filter.orderCount = { $gte: 5 }
    if (segment === 'repeat') filter.orderCount = { $gte: 2, $lt: 5 }
    if (segment === 'new') filter.orderCount = { $lte: 1 }
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }]
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter).sort(sort).skip(skip).limit(limit),
      Customer.countDocuments(filter),
    ])

    res.json({ customers, meta: meta(total, page, limit) })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id)
    if (!customer) throw ApiError.notFound('Customer not found')

    const orders = await Order.find({ 'customer.phone': customer.phone }).sort('-createdAt').limit(20)
    res.json({ customer, orders })
  }),
)

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { notes, riskFlag, tags, acceptsMarketing } = req.body ?? {}
    const customer = await Customer.findById(req.params.id)
    if (!customer) throw ApiError.notFound('Customer not found')

    if (notes !== undefined) customer.notes = notes
    if (riskFlag) customer.riskFlag = riskFlag
    if (tags) customer.tags = tags
    if (acceptsMarketing !== undefined) customer.acceptsMarketing = acceptsMarketing
    await customer.save()

    res.json({ customer })
  }),
)

export default router
