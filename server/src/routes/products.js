import { Router } from 'express'
import { Product } from '../models/Product.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta, slugify } from '../utils/helpers.js'
import { logActivity } from '../models/ActivityLog.js'

const router = Router()

/** Fields the storefront must never receive. */
const PUBLIC_EXCLUDE = '-costPrice -__v'

/* ------------------------------- public ---------------------------------- */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    const {
      category, subcategory, q, tag, minPrice, maxPrice, sort = 'featured',
      featured, badge, inStock,
    } = req.query

    const filter = { status: 'active' }
    if (category) filter.category = category
    if (subcategory) filter.subcategory = subcategory
    if (tag) filter.tags = tag
    if (badge) filter.badge = badge
    if (featured === 'true') filter.featured = true
    if (inStock === 'true') filter.stock = { $gt: 0 }
    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number(minPrice)
      if (maxPrice) filter.price.$lte = Number(maxPrice)
    }
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: rx }, { nameBn: rx }, { short: rx }, { subcategory: rx }, { tags: rx }]
    }

    const sorts = {
      featured: { featured: -1, soldCount: -1, rating: -1 },
      new: { createdAt: -1 },
      'price-asc': { price: 1 },
      'price-desc': { price: -1 },
      rating: { rating: -1, reviewCount: -1 },
      bestselling: { soldCount: -1 },
    }

    const [items, total] = await Promise.all([
      Product.find(filter).select(PUBLIC_EXCLUDE).sort(sorts[sort] ?? sorts.featured).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ])

    res.json({ products: items, meta: meta(total, page, limit) })
  }),
)

router.get(
  '/facets',
  asyncHandler(async (req, res) => {
    const match = { status: 'active' }
    if (req.query.category) match.category = req.query.category

    const [subcategories, priceRange, tags] = await Promise.all([
      Product.aggregate([{ $match: match }, { $group: { _id: '$subcategory', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Product.aggregate([{ $match: match }, { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }]),
      Product.aggregate([{ $match: match }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ])

    res.json({
      subcategories: subcategories.filter((s) => s._id).map((s) => ({ value: s._id, count: s.count })),
      tags: tags.map((t) => ({ value: t._id, count: t.count })),
      priceRange: { min: priceRange[0]?.min ?? 0, max: priceRange[0]?.max ?? 5000 },
    })
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await Product.findOne({ slug: req.params.slug, status: 'active' }).select(PUBLIC_EXCLUDE)
    if (!product) throw ApiError.notFound('Product not found')

    // Fire-and-forget so a view counter never slows the page.
    Product.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } }).catch(() => {})

    const related = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      status: 'active',
    })
      .select(PUBLIC_EXCLUDE)
      .limit(4)

    res.json({ product, related })
  }),
)

/* -------------------------------- admin ---------------------------------- */

router.get(
  '/admin/list',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    const { q, category, status, stock, sort = '-createdAt' } = req.query

    const filter = {}
    if (category) filter.category = category
    if (status) filter.status = status
    if (stock === 'low') filter.$expr = { $lte: ['$stock', '$lowStockThreshold'] }
    if (stock === 'out') filter.stock = 0
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: rx }, { sku: rx }, { slug: rx }]
    }

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ])

    res.json({ products: items, meta: meta(total, page, limit) })
  }),
)

router.get(
  '/admin/:id',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
    if (!product) throw ApiError.notFound('Product not found')
    res.json({ product })
  }),
)

router.post(
  '/',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body }
    if (payload.slug) payload.slug = slugify(payload.slug)
    delete payload._id

    const product = await Product.create(payload)

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'product.create', entity: 'Product', entityId: String(product._id),
      summary: `Created product “${product.name}”`,
    })

    res.status(201).json({ product })
  }),
)

router.patch(
  '/:id',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
    if (!product) throw ApiError.notFound('Product not found')

    const payload = { ...req.body }
    delete payload._id
    delete payload.id
    if (payload.slug) payload.slug = slugify(payload.slug)

    const priceChanged = payload.price != null && payload.price !== product.price
    Object.assign(product, payload)
    await product.save()

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'product.update', entity: 'Product', entityId: String(product._id),
      summary: priceChanged
        ? `Updated “${product.name}” (price → ৳${product.price})`
        : `Updated “${product.name}”`,
    })

    res.json({ product })
  }),
)

router.post(
  '/:id/duplicate',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const source = await Product.findById(req.params.id)
    if (!source) throw ApiError.notFound('Product not found')

    const copy = source.toObject()
    delete copy._id
    delete copy.createdAt
    delete copy.updatedAt
    copy.name = `${copy.name} (copy)`
    copy.slug = ''
    copy.status = 'draft'
    copy.soldCount = 0
    copy.viewCount = 0

    const product = await Product.create(copy)
    res.status(201).json({ product })
  }),
)

/** Bulk stock/price/status edits — the tool a shop actually uses daily. */
router.post(
  '/bulk',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const { ids, action, value } = req.body ?? {}
    if (!Array.isArray(ids) || !ids.length) throw ApiError.badRequest('Select at least one product')

    const updates = {
      status: { $set: { status: value } },
      featured: { $set: { featured: Boolean(value) } },
      stock: { $set: { stock: Number(value) } },
      'stock-add': { $inc: { stock: Number(value) } },
      badge: { $set: { badge: value ?? '' } },
      category: { $set: { category: value } },
    }
    if (!updates[action]) throw ApiError.badRequest(`Unknown bulk action: ${action}`)

    const result = await Product.updateMany({ _id: { $in: ids } }, updates[action])

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'product.bulk',
      summary: `Bulk ${action} on ${ids.length} products`,
      meta: { action, value },
    })

    res.json({ ok: true, modified: result.modifiedCount })
  }),
)

router.delete(
  '/:id',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
    if (!product) throw ApiError.notFound('Product not found')

    // Hard delete would orphan order lines; archiving keeps history intact.
    if (req.query.hard === 'true' && req.user.role === 'owner') {
      await product.deleteOne()
    } else {
      product.status = 'archived'
      await product.save()
    }

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'product.delete', entity: 'Product', entityId: req.params.id,
      summary: `Removed “${product.name}”`,
    })

    res.json({ ok: true })
  }),
)

export default router
