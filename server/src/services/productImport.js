import { Product } from '../models/Product.js'
import { Category } from '../models/Category.js'
import { slugify, parseYouTubeId } from '../utils/helpers.js'

/**
 * Bulk product import from CSV or JSON.
 *
 * The whole file is parsed and validated before a single document is written,
 * so a shop owner never ends up with half a catalogue imported and no idea
 * which half. Every row comes back with its own verdict — create, update, skip
 * or error — and the same code path runs for the dry-run preview and the real
 * import, so the preview cannot disagree with what actually happens.
 */

/* ------------------------------ CSV parsing ------------------------------ */

/**
 * RFC 4180 parser, written out rather than pulled in as a dependency.
 *
 * Product copy is exactly the kind of data that breaks naive `split(',')` —
 * descriptions contain commas, quoted phrases and line breaks. This handles
 * quoted fields, doubled quotes ("" inside a quoted field), and CRLF or LF.
 */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0

  // A UTF-8 BOM from Excel would otherwise become part of the first header.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  while (i < src.length) {
    const char = src[i]

    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += char
      i++
      continue
    }

    if (char === '"') {
      inQuotes = true
      i++
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (char === '\r' && src[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 2
      continue
    }
    if (char === '\n' || char === '\r') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }

    field += char
    i++
  }

  // Whatever is still buffered is the last field of the last row.
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  // Trailing newline leaves an empty row; blank lines mid-file are noise.
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''))
}

/** Header → object rows, with headers normalised so `Compare At` == `compareAt`. */
export function csvToObjects(text) {
  const rows = parseCsv(text)
  if (!rows.length) return []

  const headers = rows[0].map((h) => normaliseHeader(h))
  return rows.slice(1).map((cells) => {
    const obj = {}
    headers.forEach((key, idx) => {
      if (key) obj[key] = cells[idx] ?? ''
    })
    return obj
  })
}

/** `Compare at price` / `compare_at` / `COMPAREAT` all resolve to `compareat`. */
const normaliseHeader = (raw) => String(raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')

/**
 * Accepted column names. The left-hand side is the normalised header, so the
 * spreadsheet can say "Compare at price" or "compareAt" — both land here.
 */
const FIELD_ALIASES = {
  name: 'name', title: 'name', productname: 'name',
  slug: 'slug', handle: 'slug', url: 'slug',
  sku: 'sku', code: 'sku',
  category: 'category',
  subcategory: 'subcategory', subcat: 'subcategory',
  price: 'price', sellingprice: 'price',
  compareat: 'compareAt', compareatprice: 'compareAt', mrp: 'compareAt', oldprice: 'compareAt',
  costprice: 'costPrice', cost: 'costPrice', buyingprice: 'costPrice',
  short: 'short', shortdescription: 'short', tagline: 'short',
  description: 'description', longdescription: 'description', fulldescription: 'description',
  body: 'description', content: 'description',
  care: 'care', howtouse: 'care', usage: 'care',
  // `details` is the bullet list under "Details & specification" — the same
  // meaning the template column has. It must not alias to `description`, or a
  // file carrying both columns silently loses one of them.
  details: 'details', detailslist: 'details', specs: 'details',
  bullets: 'details', features: 'details', highlights: 'details',
  specifications: 'specifications',
  images: 'images', imageurls: 'images', image: 'images', photo: 'images',
  videos: 'videos', video: 'videos', youtube: 'videos', videourl: 'videos',
  colors: 'colors', colours: 'colors',
  sizes: 'sizes', variants: 'sizes',
  stock: 'stock', quantity: 'stock', qty: 'stock', inventory: 'stock',
  lowstockthreshold: 'lowStockThreshold', lowstock: 'lowStockThreshold',
  trackinventory: 'trackInventory',
  badge: 'badge', label: 'badge',
  tags: 'tags', keywords: 'tags',
  status: 'status',
  featured: 'featured',
  order: 'order', sortorder: 'order',
  artshape: 'artShape', shape: 'artShape',
  arthue: 'artHue', hue: 'artHue',
  metatitle: 'metaTitle', metadescription: 'metaDescription',
}

/* ---------------------------- value coercion ---------------------------- */

const asString = (v) => (v == null ? '' : String(v).trim())

const asNumber = (v) => {
  if (v == null || String(v).trim() === '') return null
  // Tolerate "৳1,450" and "1450 BDT" — spreadsheets are full of both.
  const cleaned = String(v).replace(/[^\d.-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const asBoolean = (v, fallback = false) => {
  const s = asString(v).toLowerCase()
  if (!s) return fallback
  if (['true', 'yes', 'y', '1', 'on'].includes(s)) return true
  if (['false', 'no', 'n', '0', 'off'].includes(s)) return false
  return fallback
}

/** Multi-value cells are pipe-separated: `Soft Beige | Deep Rose`. */
const asList = (v) => {
  if (Array.isArray(v)) return v.map(asString).filter(Boolean)
  const s = asString(v)
  if (!s) return []
  return s.split('|').map((x) => x.trim()).filter(Boolean)
}

/** `Dusty Rose:#c4787f:12` → { name, hex, stock } */
const asColors = (v) => {
  if (Array.isArray(v)) return v
  return asList(v).map((entry) => {
    const [name, hex, stock] = entry.split(':').map((x) => (x ?? '').trim())
    return { name, hex: hex || '#cccccc', stock: asNumber(stock) ?? 0 }
  }).filter((c) => c.name)
}

/** `100ml:0:20 | 200ml:250:5` → { label, priceDelta, stock } */
const asSizes = (v) => {
  if (Array.isArray(v)) return v
  return asList(v).map((entry) => {
    const [label, delta, stock] = entry.split(':').map((x) => (x ?? '').trim())
    return { label, priceDelta: asNumber(delta) ?? 0, stock: asNumber(stock) ?? 0 }
  }).filter((s) => s.label)
}

/** `Fabric=100% georgette | Length=190cm` → { label, value } */
const asSpecifications = (v) => {
  if (Array.isArray(v)) return v
  return asList(v).map((entry) => {
    const idx = entry.indexOf('=')
    if (idx === -1) return { label: entry, value: '' }
    return { label: entry.slice(0, idx).trim(), value: entry.slice(idx + 1).trim() }
  }).filter((s) => s.label)
}

/**
 * YouTube links from a spreadsheet cell. Anything that is not YouTube is
 * dropped rather than failing the row — the warning tells the shop owner.
 */
const asVideos = (v) => {
  const entries = Array.isArray(v) ? v : asList(v)
  return entries
    .map((entry) => (typeof entry === 'string' ? entry : entry?.url ?? entry?.videoId ?? ''))
    .map((url) => {
      const videoId = parseYouTubeId(url)
      return videoId ? { videoId, url: `https://www.youtube.com/watch?v=${videoId}`, title: '' } : null
    })
    .filter(Boolean)
    .slice(0, 8)
}

const asImages = (v) => {
  if (Array.isArray(v)) {
    return v.map((img) => (typeof img === 'string' ? { url: img, alt: '' } : img)).filter((i) => i.url)
  }
  return asList(v).map((url) => ({ url, alt: '' }))
}

/**
 * Maps one raw row (CSV cell strings or a JSON object) onto product fields.
 * Unknown columns are ignored rather than rejected — people export from other
 * systems and the extra columns are not their fault.
 */
export function normaliseRow(raw) {
  const mapped = {}
  for (const [key, value] of Object.entries(raw ?? {})) {
    const field = FIELD_ALIASES[normaliseHeader(key)]
    // JSON files may already use exact schema keys that have no alias entry.
    if (field) mapped[field] = value
    else if (Object.hasOwn(raw, key)) mapped[key] = value
  }
  return mapped
}

/* ------------------------------ validation ------------------------------ */

const STATUSES = new Set(['active', 'draft', 'archived'])

/**
 * Turns a mapped row into a product payload, collecting problems as it goes.
 * Returns `{ payload, errors, warnings }` — errors block the row, warnings do
 * not (a missing image is worth telling someone about, not worth refusing).
 */
export function buildProduct(row, { categorySlugs }) {
  const errors = []
  const warnings = []

  const name = asString(row.name)
  if (!name) errors.push('name is required')

  const price = asNumber(row.price)
  if (price == null) errors.push('price is required')
  else if (price < 0) errors.push('price cannot be negative')

  let category = slugify(asString(row.category))
  if (!category) {
    errors.push('category is required')
  } else if (!categorySlugs.has(category)) {
    errors.push(`category "${asString(row.category)}" does not exist`)
  }

  const compareAt = asNumber(row.compareAt) ?? 0
  if (compareAt && price != null && compareAt <= price) {
    warnings.push('compareAt is not above price, so no discount will show')
  }

  const status = asString(row.status).toLowerCase() || 'active'
  if (!STATUSES.has(status)) {
    errors.push(`status must be active, draft or archived (got "${status}")`)
  }

  const images = asImages(row.images)
  if (!images.length) warnings.push('no image — the generated placeholder art will be used')

  const videos = asVideos(row.videos)
  const videoCellCount = Array.isArray(row.videos) ? row.videos.length : asList(row.videos).length
  if (videoCellCount > videos.length) {
    warnings.push(`${videoCellCount - videos.length} video link(s) ignored — only YouTube is supported`)
  }

  const hue = asNumber(row.artHue)
  const payload = {
    name,
    ...(asString(row.slug) ? { slug: slugify(asString(row.slug)) } : {}),
    sku: asString(row.sku),
    category,
    subcategory: asString(row.subcategory),
    price: price ?? 0,
    compareAt,
    costPrice: asNumber(row.costPrice) ?? 0,
    short: asString(row.short),
    description: asString(row.description),
    care: asString(row.care),
    details: asList(row.details),
    specifications: asSpecifications(row.specifications),
    images,
    videos,
    colors: asColors(row.colors),
    sizes: asSizes(row.sizes),
    // Inventory is counted in whole units, whatever the spreadsheet says.
    stock: Math.max(0, Math.round(asNumber(row.stock) ?? 0)),
    lowStockThreshold: asNumber(row.lowStockThreshold) ?? 5,
    trackInventory: asBoolean(row.trackInventory, true),
    badge: asString(row.badge),
    tags: asList(row.tags),
    status,
    featured: asBoolean(row.featured, false),
    order: asNumber(row.order) ?? 0,
    ...(asString(row.artShape) || hue != null
      ? { art: { shape: asString(row.artShape) || 'jar', hue: hue ?? 320 } }
      : {}),
    ...(asString(row.metaTitle) || asString(row.metaDescription)
      ? { seo: { metaTitle: asString(row.metaTitle), metaDescription: asString(row.metaDescription) } }
      : {}),
  }

  return { payload, errors, warnings }
}

/* -------------------------------- import -------------------------------- */

/**
 * Validates every row and, unless `dryRun`, writes the valid ones.
 *
 * `mode` decides what an existing product means:
 *   - `create` — a matching slug or SKU is a conflict, so the row is skipped
 *   - `upsert` — the existing product is updated in place
 *
 * Rows are matched on slug first, then SKU, because a shop's own SKU is the
 * identifier they think in, but the slug is what the storefront URL depends on.
 */
export async function importProducts(rows, { mode = 'create', dryRun = false } = {}) {
  const categories = await Category.find().select('slug')
  const categorySlugs = new Set(categories.map((c) => c.slug))

  if (!categorySlugs.size) {
    throw new Error('No categories exist yet — create at least one before importing products.')
  }

  const results = []
  const seenSlugs = new Set()
  const seenSkus = new Set()

  for (const [index, raw] of rows.entries()) {
    // Row 1 is the header, so the first data row is row 2 in the user's file.
    const rowNumber = index + 2
    const mapped = normaliseRow(raw)
    const { payload, errors, warnings } = buildProduct(mapped, { categorySlugs })

    if (errors.length) {
      results.push({ row: rowNumber, name: payload.name || '(unnamed)', action: 'error', errors, warnings })
      continue
    }

    const slug = payload.slug || slugify(payload.name)
    const sku = payload.sku

    // Duplicates *within the file* are the common spreadsheet mistake, and the
    // database cannot catch them until the second write has already happened.
    if (seenSlugs.has(slug)) {
      results.push({ row: rowNumber, name: payload.name, action: 'error',
        errors: [`duplicate of an earlier row in this file (slug "${slug}")`], warnings })
      continue
    }
    if (sku && seenSkus.has(sku)) {
      results.push({ row: rowNumber, name: payload.name, action: 'error',
        errors: [`duplicate SKU "${sku}" earlier in this file`], warnings })
      continue
    }
    seenSlugs.add(slug)
    if (sku) seenSkus.add(sku)

    const existing = await Product.findOne(
      sku ? { $or: [{ slug }, { sku }] } : { slug },
    ).select('_id name slug sku')

    if (existing && mode === 'create') {
      results.push({
        row: rowNumber, name: payload.name, action: 'skipped',
        reason: `already exists as “${existing.name}” — choose "Update existing" to overwrite`,
        warnings,
      })
      continue
    }

    if (dryRun) {
      results.push({
        row: rowNumber, name: payload.name,
        action: existing ? 'update' : 'create',
        slug, warnings,
      })
      continue
    }

    try {
      if (existing) {
        Object.assign(existing, payload)
        await existing.save()
        results.push({ row: rowNumber, name: payload.name, action: 'updated', slug: existing.slug, id: String(existing._id), warnings })
      } else {
        // Let the model's pre-validate hook resolve slug collisions.
        const created = await Product.create({ ...payload, slug: payload.slug || undefined })
        results.push({ row: rowNumber, name: payload.name, action: 'created', slug: created.slug, id: String(created._id), warnings })
      }
    } catch (err) {
      results.push({ row: rowNumber, name: payload.name, action: 'error', errors: [err.message], warnings })
    }
  }

  const tally = results.reduce((acc, r) => {
    acc[r.action] = (acc[r.action] ?? 0) + 1
    return acc
  }, {})

  return {
    dryRun,
    mode,
    total: rows.length,
    summary: {
      created: tally.created ?? 0,
      updated: tally.updated ?? 0,
      // Dry runs report intent; real runs report what happened.
      willCreate: tally.create ?? 0,
      willUpdate: tally.update ?? 0,
      skipped: tally.skipped ?? 0,
      errors: tally.error ?? 0,
      warnings: results.filter((r) => r.warnings?.length).length,
    },
    results,
  }
}

/* ------------------------------- template ------------------------------- */

export const TEMPLATE_COLUMNS = [
  'name', 'category', 'price', 'compareAt', 'sku', 'subcategory', 'short',
  'description', 'care', 'details', 'specifications', 'colors', 'sizes',
  'stock', 'tags', 'badge', 'status', 'featured', 'images', 'videos',
]

const SAMPLE_ROW = {
  name: 'Signature Georgette Hijab',
  category: 'hijabs',
  price: '890',
  compareAt: '1250',
  sku: 'HJ-GEO-001',
  subcategory: 'Georgette',
  short: 'A structured drape that holds its shape all day.',
  description: 'Woven denser than the market standard, hand-hemmed on all four sides.',
  care: 'Hand wash cold. Do not tumble dry.',
  details: '190 x 75 cm | 100% premium georgette | Four-side hand-rolled hem',
  specifications: 'Fabric=100% georgette | Length=190cm | Weight=95g',
  colors: 'Dusty Rose:#c4787f:12 | Charcoal:#333333:8',
  sizes: 'Standard:0:20 | XL:150:6',
  stock: '20',
  tags: 'bestseller | everyday',
  badge: 'Bestseller',
  status: 'active',
  featured: 'true',
  images: 'https://example.com/hijab-1.jpg | https://example.com/hijab-2.jpg',
  videos: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
}

/** Escapes a value for CSV: quote it if it holds a comma, quote or newline. */
const csvCell = (value) => {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Export columns, deliberately the same names the importer accepts.
 *
 * That symmetry is the whole point: a shop can export the catalogue, edit
 * prices in Excel, and import the same file straight back without renaming a
 * single header.
 */
export const PRODUCT_EXPORT_COLUMNS = [
  { header: 'name', key: 'name', width: 34 },
  { header: 'sku', key: 'sku' },
  { header: 'slug', key: 'slug', width: 28 },
  { header: 'category', key: 'category' },
  { header: 'subcategory', key: 'subcategory' },
  { header: 'price', key: 'price' },
  { header: 'compareAt', key: 'compareAt' },
  { header: 'costPrice', key: 'costPrice' },
  { header: 'stock', key: 'stock' },
  { header: 'status', key: 'status' },
  { header: 'featured', key: 'featured' },
  { header: 'badge', key: 'badge' },
  { header: 'short', key: 'short', width: 40 },
  { header: 'description', key: 'description', width: 50 },
  { header: 'care', key: 'care', width: 30 },
  { header: 'details', key: 'details', width: 40 },
  { header: 'specifications', key: 'specifications', width: 40 },
  { header: 'colors', key: 'colors', width: 30 },
  { header: 'sizes', key: 'sizes', width: 30 },
  { header: 'tags', key: 'tags' },
  { header: 'images', key: 'images', width: 40 },
  { header: 'videos', key: 'videos', width: 30 },
  { header: 'rating', key: 'rating' },
  { header: 'reviewCount', key: 'reviewCount' },
  { header: 'soldCount', key: 'soldCount' },
]

/** Flattens a product document into the pipe-separated shape the importer reads. */
export function productToRow(p) {
  const list = (arr) => (arr ?? []).join(' | ')
  return {
    name: p.name ?? '',
    sku: p.sku ?? '',
    slug: p.slug ?? '',
    category: p.category ?? '',
    subcategory: p.subcategory ?? '',
    price: p.price ?? 0,
    compareAt: p.compareAt ?? 0,
    costPrice: p.costPrice ?? 0,
    stock: p.stock ?? 0,
    status: p.status ?? 'active',
    featured: p.featured ? 'true' : 'false',
    badge: p.badge ?? '',
    short: p.short ?? '',
    description: p.description ?? '',
    care: p.care ?? '',
    details: list(p.details),
    specifications: (p.specifications ?? []).map((sp) => `${sp.label}=${sp.value}`).join(' | '),
    colors: (p.colors ?? []).map((c) => `${c.name}:${c.hex}:${c.stock ?? 0}`).join(' | '),
    sizes: (p.sizes ?? []).map((z) => `${z.label}:${z.priceDelta ?? 0}:${z.stock ?? 0}`).join(' | '),
    tags: list(p.tags),
    images: (p.images ?? []).map((i) => i.url).join(' | '),
    videos: (p.videos ?? []).map((v) => v.url).join(' | '),
    // Read-only in the importer; exported so the shop can analyse them.
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    soldCount: p.soldCount ?? 0,
  }
}

export function buildTemplate(format = 'csv') {
  if (format === 'json') {
    return JSON.stringify([SAMPLE_ROW], null, 2)
  }
  const header = TEMPLATE_COLUMNS.join(',')
  const sample = TEMPLATE_COLUMNS.map((c) => csvCell(SAMPLE_ROW[c] ?? '')).join(',')
  return `${header}\n${sample}\n`
}
