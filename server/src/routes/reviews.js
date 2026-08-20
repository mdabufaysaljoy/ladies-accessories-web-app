import { Router } from 'express'
import { Review } from '../models/Review.js'
import { Product } from '../models/Product.js'
import { Order } from '../models/Order.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { requireCustomer, optionalCustomer } from '../middleware/customerAuth.js'
import { ApiError, asyncHandler, paginate, meta } from '../utils/helpers.js'

const router = Router()

/**
 * Orders that belong to this customer. Matched the same way order history is —
 * by account link *or* phone number — so orders placed as a guest before
 * signing up still count towards the right to review.
 */
const ownedOrdersFilter = (customer) => ({
  $or: [{ account: customer._id }, { 'customer.phone': customer.phone }],
})

/**
 * Has this customer actually received the product? A review is only worth
 * anything if it comes from someone who used the thing, so this is a hard
 * gate, not a badge: without a delivered order the write is refused.
 */
async function findDeliveredOrder(customer, productSlug) {
  return Order.findOne({
    ...ownedOrdersFilter(customer),
    status: 'delivered',
    ...(productSlug ? { 'lines.slug': productSlug } : {}),
  }).sort('-createdAt')
}

/* ------------------------------- public read ------------------------------ */

/** Published reviews for one product, newest first, with the star breakdown. */
router.get(
  '/product/:slug',
  asyncHandler(async (req, res) => {
    const { limit = 20 } = req.query
    const filter = { productSlug: req.params.slug, status: 'published' }

    const [reviews, total, rows] = await Promise.all([
      Review.find(filter).sort('-createdAt').limit(Math.min(Number(limit) || 20, 50)),
      Review.countDocuments(filter),
      Review.aggregate([
        { $match: filter },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
    ])

    const counts = [1, 2, 3, 4, 5].reduce((acc, s) => {
      acc[s] = rows.find((r) => r._id === s)?.count ?? 0
      return acc
    }, {})
    const sum = Object.entries(counts).reduce((acc, [s, n]) => acc + Number(s) * n, 0)

    res.json({
      reviews,
      total,
      summary: {
        average: total ? Math.round((sum / total) * 10) / 10 : 0,
        total,
        breakdown: [5, 4, 3, 2, 1].map((stars) => ({
          stars,
          count: counts[stars],
          pct: total ? Math.round((counts[stars] / total) * 100) : 0,
        })),
      },
    })
  }),
)

/** Published reviews about the business itself. */
router.get(
  '/shop',
  asyncHandler(async (req, res) => {
    const { limit = 24 } = req.query
    const [reviews, summary] = await Promise.all([
      Review.find({ kind: 'shop', status: 'published' })
        .sort('-createdAt')
        .limit(Math.min(Number(limit) || 24, 60)),
      Review.shopSummary(),
    ])
    res.json({ reviews, summary })
  }),
)

/* ------------------------------- eligibility ------------------------------ */

/**
 * Tells the storefront whether to show a review form, and if not, why.
 *
 * The UI needs the reason to say something useful — "sign in to review" is a
 * very different message from "you can review this once it is delivered" — and
 * answering it here keeps that rule in one place rather than reimplemented in
 * the client.
 */
router.get(
  '/eligibility',
  optionalCustomer,
  asyncHandler(async (req, res) => {
    const { slug } = req.query
    const kind = slug ? 'product' : 'shop'

    if (!req.customer) {
      return res.json({ canReview: false, reason: 'signed-out', kind })
    }

    let product = null
    if (kind === 'product') {
      product = await Product.findOne({ slug }).select('_id')
      if (!product) throw ApiError.notFound('Product not found')
    }

    const existing = await Review.findOne({
      customer: req.customer._id,
      product: product?._id ?? null,
    })
    if (existing) {
      return res.json({
        canReview: false,
        reason: 'already-reviewed',
        kind,
        review: { id: existing._id, rating: existing.rating, status: existing.status },
      })
    }

    const order = await findDeliveredOrder(req.customer, kind === 'product' ? slug : null)
    if (!order) {
      return res.json({ canReview: false, reason: kind === 'product' ? 'not-purchased' : 'no-orders', kind })
    }

    res.json({ canReview: true, kind, orderNumber: order.orderNumber })
  }),
)

/**
 * Everything this customer has actually received, ready to be reviewed.
 *
 * Built from delivered order lines rather than from the catalogue, because
 * what they bought is the authority — then cross-checked against `Product` so
 * a discontinued item does not offer a dead link. One entry per product even
 * if it was ordered several times, carrying whichever review already exists.
 */
router.get(
  '/purchases',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ ...ownedOrdersFilter(req.customer), status: 'delivered' })
      .sort('-createdAt')
      .select('orderNumber lines delivery.deliveredAt createdAt')

    // Orders arrive newest-first, so a repeat purchase keeps the most recent
    // delivery date while `timesBought` records how often they came back.
    const bySlug = new Map()
    for (const order of orders) {
      for (const line of order.lines ?? []) {
        if (!line.slug) continue
        const seen = bySlug.get(line.slug)
        if (!seen) {
          bySlug.set(line.slug, {
            slug: line.slug,
            name: line.name,
            price: line.price,
            art: line.art,
            imageUrl: line.imageUrl,
            orderNumber: order.orderNumber,
            purchasedAt: order.delivery?.deliveredAt ?? order.createdAt,
            timesBought: 1,
          })
        } else {
          seen.timesBought += 1
        }
      }
    }

    const slugs = [...bySlug.keys()]
    if (!slugs.length) return res.json({ purchases: [] })

    const [products, reviews] = await Promise.all([
      Product.find({ slug: { $in: slugs } }).select('slug name price status art imageUrl'),
      Review.find({ customer: req.customer._id, productSlug: { $in: slugs } })
        .select('productSlug rating status body createdAt'),
    ])

    const liveBySlug = new Map(products.map((p) => [p.slug, p]))
    const reviewBySlug = new Map(reviews.map((r) => [r.productSlug, r]))

    const purchases = slugs.map((slug) => {
      const bought = bySlug.get(slug)
      const live = liveBySlug.get(slug)
      const review = reviewBySlug.get(slug)
      return {
        ...bought,
        // Keep the name they saw at purchase, but prefer live art for the card.
        art: live?.art ?? bought.art,
        imageUrl: live?.imageUrl ?? bought.imageUrl,
        available: Boolean(live),
        review: review
          ? {
              id: review._id,
              rating: review.rating,
              status: review.status,
              body: review.body,
              createdAt: review.createdAt,
            }
          : null,
      }
    })

    // Unreviewed first — that is the whole point of the page.
    purchases.sort((a, b) => {
      if (Boolean(a.review) !== Boolean(b.review)) return a.review ? 1 : -1
      return new Date(b.purchasedAt) - new Date(a.purchasedAt)
    })

    res.json({ purchases })
  }),
)

/** The customer's own reviews, including ones still awaiting moderation. */
router.get(
  '/mine',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const reviews = await Review.find({ customer: req.customer._id }).sort('-createdAt')
    res.json({ reviews })
  }),
)

/* --------------------------------- write --------------------------------- */

/**
 * Writes a review. Signed-in customers only, and for product reviews only
 * those who have a delivered order containing that exact product.
 *
 * The reviewer's name comes from their account, never from the request body —
 * otherwise anyone could sign their review with someone else's name.
 */
router.post(
  '/',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { productSlug, rating, body, title, location } = req.body ?? {}

    const score = Math.round(Number(rating))
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw ApiError.badRequest('Please choose a rating between 1 and 5 stars')
    }
    if (body && String(body).length > 2000) {
      throw ApiError.badRequest('Please keep your review under 2000 characters')
    }

    const kind = productSlug ? 'product' : 'shop'

    let product = null
    if (kind === 'product') {
      product = await Product.findOne({ slug: productSlug })
      if (!product) throw ApiError.notFound('Product not found')
    }

    const order = await findDeliveredOrder(req.customer, kind === 'product' ? productSlug : null)
    if (!order) {
      throw ApiError.forbidden(
        kind === 'product'
          ? 'You can review this product once your order for it has been delivered'
          : 'You can review the shop once your first order has been delivered',
      )
    }

    const duplicate = await Review.findOne({
      customer: req.customer._id,
      product: product?._id ?? null,
    })
    if (duplicate) {
      throw ApiError.badRequest(
        kind === 'product'
          ? 'You have already reviewed this product'
          : 'You have already reviewed the shop',
      )
    }

    const review = await Review.create({
      kind,
      product: product?._id,
      productSlug: kind === 'product' ? productSlug : undefined,
      customer: req.customer._id,
      order: order._id,
      name: req.customer.name || 'Verified customer',
      location: location ? String(location).slice(0, 80) : req.customer.district,
      phone: req.customer.phone,
      rating: score,
      title: title ? String(title).slice(0, 120) : undefined,
      body: body ? String(body).trim() : '',
      // Unreachable without a delivered order, so this is always earned.
      verified: true,
      status: 'pending',
    })

    res.status(201).json({
      review: { id: review._id, status: review.status, rating: review.rating },
      message: 'Thank you! Your review will appear once it has been approved.',
    })
  }),
)

/* -------------------------------- admin ---------------------------------- */

router.get(
  '/',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.kind) filter.kind = req.query.kind

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
    if (status) {
      if (!['pending', 'published', 'rejected'].includes(status)) {
        throw ApiError.badRequest('Unknown review status')
      }
      review.status = status
    }
    if (reply !== undefined) {
      review.reply = reply ? { body: String(reply), at: new Date(), by: req.user.name } : undefined
    }
    await review.save()

    // Publishing or hiding a review changes what the product's rating is
    // averaged from, so the cached figure has to be rebuilt either way.
    if (review.product) await Review.recomputeProduct(review.product)

    res.json({ review })
  }),
)

router.delete(
  '/:id',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndDelete(req.params.id)
    if (review?.product) await Review.recomputeProduct(review.product)
    res.json({ ok: true })
  }),
)

export default router
