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

    /**
     * Three outcomes, so the admin can always get to the one they meant:
     *
     *   (no flag)      delete, but refuse if products would be orphaned
     *   ?mode=hide     keep the record, just take it off the site
     *   ?force=true    delete regardless of the product count
     *
     * The old version silently turned a delete into a deactivate whenever the
     * category had products, which is why a category could never actually be
     * removed — it reported success and stayed in the list.
     */
    if (req.query.mode === 'hide') {
      category.active = false
      await category.save()
      await logActivity({
        actor: req.user._id, actorName: req.user.name,
        action: 'category.hide', entity: 'Category', entityId: String(category._id),
        summary: `Hid category “${category.name}”`,
      })
      return res.json({ ok: true, hidden: true, productCount })
    }

    if (productCount > 0 && req.query.force !== 'true') {
      throw ApiError.conflict(
        `${productCount} products still use this category. Move them to another category first, or confirm deleting it anyway.`,
      )
    }

    await category.deleteOne()
    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'category.delete', entity: 'Category', entityId: String(category._id),
      summary: `Deleted category “${category.name}”${productCount ? ` (${productCount} products left uncategorised)` : ''}`,
    })

    res.json({ ok: true, deleted: true, orphaned: productCount })
  }),
)

export default router
