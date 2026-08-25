import mongoose from 'mongoose'
import { slugify } from '../utils/helpers.js'

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameBn: { type: String, default: '' },
    slug: { type: String, required: true, unique: true, index: true },
    tagline: { type: String, default: '' },
    taglineBn: { type: String, default: '' },
    blurb: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    art: { shape: { type: String, default: 'jar' }, hue: { type: Number, default: 320 } },
    subcategories: [{ type: String }],
    order: { type: Number, default: 0 },
    /**
     * Whether this category gets a slot in the site's top navigation. Separate
     * from `active`: a shop can keep a category browsable and indexed while
     * leaving it out of a header that only has room for a handful.
     */
    showInNav: { type: Boolean, default: true },
    featured: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    seo: { metaTitle: String, metaDescription: String },
  },
  { timestamps: true },
)

categorySchema.pre('validate', function (next) {
  if (!this.slug && this.name) this.slug = slugify(this.name)
  next()
})

export const Category = mongoose.model('Category', categorySchema)
