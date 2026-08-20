import { Router } from 'express'
import { Category } from '../models/Category.js'
import { Product } from '../models/Product.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, slugify } from '../utils/helpers.js'
import { logActivity } from '../models/ActivityLog.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = req.query.all === 'true' ? {} : { active: true }
    const categories = await Category.find(filter).sort({ order: 1, name: 1 })

    const counts = await Product.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ])
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]))

    res.json({
      categories: categories.map((c) => ({
        ...c.toObject(),
        productCount: countMap[c.slug] ?? 0,
      })),
    })
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
    const category = await Category.create(payload)
    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'category.create', entity: 'Category', entityId: String(category._id),
      summary: `Created category “${category.name}”`,
    })
    res.status(201).json({ category })
  }),
)

router.patch(
  '/:id',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id)
    if (!category) throw ApiError.notFound('Category not found')

    const previousSlug = category.slug
    const payload = { ...req.body }
    delete payload._id
    delete payload.id
    if (payload.slug) payload.slug = slugify(payload.slug)

    Object.assign(category, payload)
    await category.save()

    // Products reference categories by slug — keep them in sync on rename.
    if (payload.slug && payload.slug !== previousSlug) {
      await Product.updateMany({ category: previousSlug }, { $set: { category: category.slug } })
    }

    res.json({ category })
  }),
)

router.post(
  '/reorder',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const { order } = req.body ?? {} // [{ id, order }]
    if (!Array.isArray(order)) throw ApiError.badRequest('Expected an order array')
    await Promise.all(order.map(({ id, order: o }) => Category.updateOne({ _id: id }, { $set: { order: o } })))
    res.json({ ok: true })
  }),
)

router.delete(
  '/:id',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id)
    if (!category) throw ApiError.notFound('Category not found')

    const productCount = await Product.countDocuments({ category: category.slug })
    if (productCount > 0 && req.query.force !== 'true') {
      throw ApiError.conflict(
        `${productCount} products still use this category. Move them first, or pass force=true to deactivate instead.`,
      )
    }

    if (productCount > 0) {
      category.active = false
      await category.save()
    } else {
      await category.deleteOne()
    }

    res.json({ ok: true, deactivated: productCount > 0 })
  }),
)

export default router
