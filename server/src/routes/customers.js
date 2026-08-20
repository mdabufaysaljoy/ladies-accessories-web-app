import { Router } from 'express'
import { Customer } from '../models/Customer.js'
import { Order } from '../models/Order.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta } from '../utils/helpers.js'

const router = Router()
router.use(requireAuth, requireAbility('customers'))

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
