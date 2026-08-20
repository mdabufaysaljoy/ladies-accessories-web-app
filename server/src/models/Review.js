import mongoose from 'mongoose'

/**
 * Two kinds of review share this collection:
 *
 * - `product` — about one item, and only writable by someone who actually
 *   received that item. `product` is set.
 * - `shop` — about the business as a whole. `product` is null.
 *
 * Both require a signed-in customer and both start life as `pending`: nothing
 * a shopper writes reaches the storefront until the admin publishes it.
 */
const reviewSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['product', 'shop'], default: 'product', index: true },

    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
    productSlug: String,

    /** The account that wrote it. Absent only on the seeded demo reviews. */
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
    /** The delivered order that earned the right to write it. */
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

    name: { type: String, required: true },
    location: String,
    phone: String,
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: String,
    body: String,
    images: [String],

    /** True when the review is backed by a delivered order. */
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'published', 'rejected'], default: 'pending', index: true },
    reply: { body: String, at: Date, by: String },
  },
  { timestamps: true },
)

/**
 * One review per customer per product — and, because shop reviews leave
 * `product` null, one shop review per customer as well. The partial filter
 * exempts the seeded demo reviews, which have no `customer` and would
 * otherwise all collide on null.
 */
reviewSchema.index(
  { customer: 1, product: 1 },
  { unique: true, partialFilterExpression: { customer: { $type: 'objectId' } } },
)

reviewSchema.index({ status: 1, kind: 1, createdAt: -1 })

/**
 * Rewrites a product's cached rating from its published reviews.
 *
 * Called after every moderation action and delete. The zero case matters: when
 * the last published review is pulled, the product must fall back to no rating
 * rather than keeping the average of reviews that are no longer visible.
 */
reviewSchema.statics.recomputeProduct = async function (productId) {
  if (!productId) return null
  const { Product } = await import('./Product.js')

  const [stats] = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: 'published' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])

  const rating = stats ? Math.round(stats.avg * 10) / 10 : 0
  const reviewCount = stats?.count ?? 0
  await Product.updateOne({ _id: productId }, { $set: { rating, reviewCount } })
  return { rating, reviewCount }
}

/** Aggregate for the whole business: average, total, and the star breakdown. */
reviewSchema.statics.shopSummary = async function () {
  const rows = await this.aggregate([
    { $match: { kind: 'shop', status: 'published' } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ])

  const counts = [1, 2, 3, 4, 5].reduce((acc, stars) => {
    acc[stars] = rows.find((r) => r._id === stars)?.count ?? 0
    return acc
  }, {})
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const sum = Object.entries(counts).reduce((acc, [stars, n]) => acc + Number(stars) * n, 0)

  return {
    average: total ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    breakdown: [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars],
      pct: total ? Math.round((counts[stars] / total) * 100) : 0,
    })),
  }
}

export const Review = mongoose.model('Review', reviewSchema)
