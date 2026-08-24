import { Router } from 'express'
import { Product } from '../models/Product.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta, slugify, parseYouTubeId } from '../utils/helpers.js'
import { logActivity } from '../models/ActivityLog.js'
import { importUpload } from '../middleware/upload.js'
import {
  buildTemplate,
  csvToObjects,
  importProducts,
  PRODUCT_EXPORT_COLUMNS,
  productToRow,
} from '../services/productImport.js'
import { buildExport, xlsxToObjects } from '../services/dataExport.js'

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
      featured, badge, inStock, slugs,
    } = req.query

    const filter = { status: 'active' }
    /**
     * `?slugs=a,b,c` — fetch a specific, hand-picked set in one request. The
     * homepage hero uses this for the products the admin chose, rather than
     * firing one request per slot.
     */
    if (slugs) {
      filter.slug = { $in: String(slugs).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20) }
    }
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

/* ------------------------------ bulk export ------------------------------ */

/**
 * GET /api/products/export?format=csv|xlsx|json
 *
 * The same filters the admin list accepts, so "export what I am looking at"
 * works — exporting 2,000 rows when the screen shows 12 archived items is not
 * what anyone means by export.
 */
router.get(
  '/export',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const format = ['csv', 'xlsx', 'json'].includes(req.query.format) ? req.query.format : 'csv'
    const { q, category, status } = req.query

    const filter = {}
    if (category) filter.category = category
    if (status) filter.status = status
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: rx }, { sku: rx }, { slug: rx }]
    }

    const products = await Product.find(filter).sort('-createdAt').limit(5000)
    const rows = products.map(productToRow)

    const out = await buildExport({
      format,
      columns: PRODUCT_EXPORT_COLUMNS,
      rows,
      name: 'products',
      sheetName: 'Products',
    })

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'product.export', entity: 'Product',
      summary: `Exported ${rows.length} products as ${format.toUpperCase()}`,
    })

    res.setHeader('Content-Type', out.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`)
    res.send(out.body)
  }),
)

/**
 * NOTE: every literal path must be declared above `/:slug` — Express matches
 * in order, so a route added later would be swallowed as a product slug and
 * answer 404.
 */
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


/**
 * Fields the server owns. They are stripped from any client payload before it
 * touches a document.
 *
 * `__v` is the one that bites: the editor loads a product, the first save
 * increments the stored version, and the form still holds the old number — so
 * a second save from the same page writes a stale `__v`, Mongoose's optimistic
 * concurrency query `{_id, __v}` matches nothing, and `save()` throws a
 * VersionError. Any array edit (images, videos, specifications) increments the
 * version, so this fires on the ordinary "save twice" path.
 *
 * The rest are either virtuals, counters the server increments, or the rating
 * recomputed from moderated reviews — echoing a stale copy of those back would
 * silently undo whatever changed since the form was opened.
 */
const SERVER_OWNED = [
  '_id', 'id', '__v', 'createdAt', 'updatedAt',
  'inStock', 'discountPercent',
  'soldCount', 'viewCount',
  'rating', 'reviewCount',
]

const stripServerOwned = (payload) => {
  const clean = { ...payload }
  SERVER_OWNED.forEach((key) => delete clean[key])
  return clean
}

/**
 * Rebuilds the `videos` array from whatever the client sent.
 *
 * The id is always re-derived here rather than trusted, so a crafted `videoId`
 * cannot end up inside the storefront's iframe src. A URL that is not YouTube
 * is rejected with the row it came from, rather than silently dropped — a shop
 * owner who pastes a Facebook video link needs to be told why it vanished.
 */
function sanitiseVideos(input) {
  if (input === undefined) return undefined
  const list = Array.isArray(input) ? input : [input]

  const videos = []
  const seen = new Set()
  for (const entry of list) {
    if (!entry) continue
    const source = typeof entry === 'string' ? entry : (entry.url ?? entry.videoId ?? '')
    if (!String(source).trim()) continue

    const videoId = parseYouTubeId(source)
    if (!videoId) {
      throw ApiError.badRequest(`“${String(source).slice(0, 80)}” is not a YouTube link`)
    }
    if (seen.has(videoId)) continue
    seen.add(videoId)

    videos.push({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: typeof entry === 'object' ? String(entry.title ?? '').slice(0, 160) : '',
    })
  }
  return videos.slice(0, 8)
}

router.post(
  '/',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const payload = stripServerOwned(req.body)
    if (payload.slug) payload.slug = slugify(payload.slug)

    const videos = sanitiseVideos(payload.videos)
    if (videos !== undefined) payload.videos = videos

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

    const payload = stripServerOwned(req.body)
    if (payload.slug) payload.slug = slugify(payload.slug)

    const videos = sanitiseVideos(payload.videos)
    if (videos !== undefined) payload.videos = videos

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

/* ------------------------------ bulk import ------------------------------ */

/** A ready-made file with the right headers and one worked example row. */
router.get(
  '/import/template',
  requireAuth,
  requireAbility('products'),
  asyncHandler(async (req, res) => {
    const format = ['json', 'xlsx', 'csv'].includes(req.query.format) ? req.query.format : 'csv'

    if (format === 'xlsx') {
      const sample = JSON.parse(buildTemplate('json'))
      const out = await buildExport({
        format: 'xlsx',
        columns: Object.keys(sample[0]).map((k) => ({ header: k, key: k })),
        rows: sample,
        name: 'product-import-template',
        sheetName: 'Products',
      })
      res.setHeader('Content-Type', out.contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`)
      return res.send(out.body)
    }

    const body = buildTemplate(format)
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="product-import-template.${format}"`)
    res.send(body)
  }),
)

/**
 * POST /api/products/import
 *
 * Accepts a `.csv`/`.json` upload (field name `file`) or a raw `rows` array in
 * the body. Always validates the whole file first; `dryRun` returns the same
 * per-row verdicts without writing, which is what the admin previews before
 * committing. Nothing is written unless every row has been checked.
 */
router.post(
  '/import',
  requireAuth,
  requireAbility('products'),
  importUpload.single('file'),
  asyncHandler(async (req, res) => {
    const mode = req.body?.mode === 'upsert' ? 'upsert' : 'create'
    // multipart bodies are strings, so "false" has to be handled explicitly.
    const dryRun = req.body?.dryRun !== 'false' && req.body?.dryRun !== false

    let rows = []
    if (req.file) {
      // An .xlsx is binary; only text formats are decoded.
      const text = req.file.originalname.toLowerCase().endsWith('.xlsx')
        ? ''
        : req.file.buffer.toString('utf8')
      const isJson =
        req.file.originalname.toLowerCase().endsWith('.json') ||
        req.file.mimetype === 'application/json'

      const lower = req.file.originalname.toLowerCase()

      if (lower.endsWith('.xlsx')) {
        try {
          // Read the binary buffer, not the utf8 decode above — an xlsx is a zip.
          rows = await xlsxToObjects(req.file.buffer)
        } catch (err) {
          throw ApiError.badRequest(`That spreadsheet could not be read: ${err.message}`)
        }
      } else if (isJson) {
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch (err) {
          throw ApiError.badRequest(`That JSON file could not be read: ${err.message}`)
        }
        // Accept a bare array or the shape our own export produces.
        rows = Array.isArray(parsed) ? parsed : (parsed.products ?? parsed.rows ?? [])
        if (!Array.isArray(rows)) {
          throw ApiError.badRequest('JSON must be an array of products, or { "products": [...] }')
        }
      } else {
        rows = csvToObjects(text)
      }
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows
    } else {
      throw ApiError.badRequest('Attach a .csv or .json file to import')
    }

    if (!rows.length) throw ApiError.badRequest('That file has no product rows in it')
    if (rows.length > 2000) {
      throw ApiError.badRequest(`That file has ${rows.length} rows. Please split it into files of 2000 or fewer.`)
    }

    let report
    try {
      report = await importProducts(rows, { mode, dryRun })
    } catch (err) {
      throw ApiError.badRequest(err.message)
    }

    if (!dryRun && (report.summary.created || report.summary.updated)) {
      await logActivity({
        actor: req.user._id,
        actorName: req.user.name,
        action: 'product.import',
        entity: 'Product',
        summary: `Imported products — ${report.summary.created} created, ${report.summary.updated} updated, ${report.summary.errors} failed`,
      })
    }

    res.json(report)
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

    /**
     * Archiving is the default because it is reversible, not because deleting
     * is unsafe: every order line stores its own copy of the name, price, SKU
     * and image, and nothing populates the Product, so invoices and order
     * history render correctly long after the product is gone. Permanent
     * deletion stays owner-only all the same — it cannot be undone.
     */
    const hardDeleted = req.query.hard === 'true' && req.user.role === 'owner'
    if (hardDeleted) {
      await product.deleteOne()
    } else {
      product.status = 'archived'
      await product.save()
    }

    await logActivity({
      actor: req.user._id, actorName: req.user.name,
      action: 'product.delete', entity: 'Product', entityId: req.params.id,
      summary: `${hardDeleted ? 'Deleted' : 'Archived'} “${product.name}”`,
    })

    res.json({ ok: true, deleted: hardDeleted, status: hardDeleted ? 'deleted' : 'archived' })
  }),
)

export default router
