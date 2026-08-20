import mongoose from 'mongoose'

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    label: String,
    type: { type: String, enum: ['percent', 'flat', 'shipping'], default: 'percent' },
    value: { type: Number, default: 0 },
    minSpend: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 0 },   // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    perCustomerLimit: { type: Number, default: 0 },
    startsAt: Date,
    expiresAt: Date,
    appliesTo: { type: String, enum: ['all', 'category', 'product'], default: 'all' },
    targets: [String],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

couponSchema.methods.isRedeemable = function (subtotal) {
  const now = new Date()
  if (!this.active) return { ok: false, reason: 'This coupon is no longer active' }
  if (this.startsAt && now < this.startsAt) return { ok: false, reason: 'This coupon is not active yet' }
  if (this.expiresAt && now > this.expiresAt) return { ok: false, reason: 'This coupon has expired' }
  if (this.usageLimit && this.usedCount >= this.usageLimit)
    return { ok: false, reason: 'This coupon has been fully claimed' }
  if (subtotal < this.minSpend)
    return { ok: false, reason: `Spend ৳${this.minSpend} to use ${this.code}` }
  return { ok: true }
}

couponSchema.methods.discountFor = function (subtotal) {
  let discount = 0
  if (this.type === 'percent') discount = Math.round((subtotal * this.value) / 100)
  if (this.type === 'flat') discount = Math.min(this.value, subtotal)
  if (this.maxDiscount > 0) discount = Math.min(discount, this.maxDiscount)
  return discount
}

export const Coupon = mongoose.model('Coupon', couponSchema)
