import mongoose from 'mongoose'
import { slugify } from '../utils/helpers.js'

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: 'text' },
    nameBn: { type: String, default: '' },
    slug: { type: String, required: true, unique: true, index: true },
    sku: { type: String, default: '', index: true },

    category: { type: String, required: true, index: true }, // category slug
    subcategory: { type: String, default: '' },

    price: { type: Number, required: true, min: 0 },
    compareAt: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 }, // margin reporting, never public

    short: { type: String, default: '' },
    shortBn: { type: String, default: '' },
    description: { type: String, default: '' },
    descriptionBn: { type: String, default: '' },
    care: { type: String, default: '' },

    /** Free-form spec bullets shown under "Details & specification". */
    details: [{ type: String }],
    /** Structured key/value specs, e.g. { label: 'Fabric', value: '100% georgette' } */
    specifications: [{ label: String, value: String }],

    images: [{ url: String, alt: String }],

    /**
     * YouTube videos shown in the gallery beside the photos. Only the id is
     * authoritative — it is re-derived from the pasted URL on every write, so
     * the storefront always builds its own embed URL rather than rendering a
     * link somebody typed.
     */
    videos: [
      {
        videoId: { type: String, required: true },
        url: String,
        title: { type: String, default: '' },
      },
    ],
    art: { shape: { type: String, default: 'jar' }, hue: { type: Number, default: 320 } },

    colors: [{ name: String, hex: String, stock: { type: Number, default: 0 } }],
    sizes: [{ label: String, priceDelta: { type: Number, default: 0 }, stock: { type: Number, default: 0 } }],

    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    trackInventory: { type: Boolean, default: true },

    badge: { type: String, default: '' },
    tags: [{ type: String, index: true }],

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active', index: true },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },

    seo: { metaTitle: String, metaDescription: String, keywords: [String] },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
)

productSchema.index({ name: 'text', short: 'text', description: 'text', tags: 'text' })
productSchema.index({ category: 1, status: 1 })
productSchema.index({ price: 1 })

productSchema.virtual('inStock').get(function () {
  return !this.trackInventory || this.stock > 0
})

productSchema.virtual('discountPercent').get(function () {
  if (!this.compareAt || this.compareAt <= this.price) return 0
  return Math.round(((this.compareAt - this.price) / this.compareAt) * 100)
})

productSchema.pre('validate', async function (next) {
  if (!this.slug && this.name) {
    let base = slugify(this.name)
    let candidate = base
    let n = 2
    // Slugs are public URLs, so collisions must be resolved rather than thrown.
    while (await mongoose.models.Product.exists({ slug: candidate, _id: { $ne: this._id } })) {
      candidate = `${base}-${n++}`
    }
    this.slug = candidate
  }
  next()
})

export const Product = mongoose.model('Product', productSchema)
