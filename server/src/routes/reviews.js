import { Router } from 'express'
import { Review } from '../models/Review.js'
import { Product } from '../models/Product.js'
import { Order } from '../models/Order.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta, normalizeBdPhone } from '../utils/helpers.js'

const router = Router()

router.get(
  '/product/:slug',
  asyncHandler(async (req, res) => {
    const reviews = await Review.find({ productSlug: req.params.slug, status: 'published' })
      .sort('-createdAt')
      .limit(20)
    res.json({ reviews })
  }),
)

/** Only customers with a delivered order for that product may review it. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { productSlug, name, phone, rating, body, location } = req.body ?? {}
    if (!productSlug || !name || !rating) throw ApiError.badRequest('Name and rating are required')

    const product = await Product.findOne({ slug: productSlug })
    if (!product) throw ApiError.notFound('Product not found')

    let verified = false
    let order = null
    if (phone) {
      order = await Order.findOne({
        'customer.phone': normalizeBdPhone(phone),
        status: 'delivered',
        'lines.slug': productSlug,
      })
      verified = Boolean(order)
    }

    const review = await Review.create({
      product: product._id,
      productSlug,
      order: order?._id,
      name,
      location,
      phone: phone ? normalizeBdPhone(phone) : undefined,
      rating: Math.min(5, Math.max(1, Number(rating))),
      body,
      verified,
      status: 'pending',
    })

    res.status(201).json({ review: { id: review._id, status: review.status } })
  }),
)

/* -------------------------------- admin ---------------------------------- */

router.get(
  '/',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    const filter = req.query.status ? { status: req.query.status } : {}
    const [reviews, total, pending] = await Promise.all([
      Review.find(filter).sort('-createdAt').skip(skip).limit(limit),
      Review.countDocuments(filter),
      Review.countDocuments({ status: 'pending' }),
    ])
    res.json({ reviews, meta: meta(total, page, limit), pendingCount: pending })
  }),
)

router.patch(
  '/:id',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id)
    if (!review) throw ApiError.notFound('Review not found')

    const { status, reply } = req.body ?? {}
    if (status) review.status = status
    if (reply) review.reply = { body: reply, at: new Date(), by: req.user.name }
    await review.save()

    // Recompute the product's aggregate from published reviews only.
    const stats = await Review.aggregate([
      { $match: { product: review.product, status: 'published' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ])
    if (stats[0]) {
      await Product.updateOne(
        { _id: review.product },
        { $set: { rating: Math.round(stats[0].avg * 10) / 10, reviewCount: stats[0].count } },
      )
    }

    res.json({ review })
  }),
)

router.delete(
  '/:id',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    await Review.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  }),
)

export default router
