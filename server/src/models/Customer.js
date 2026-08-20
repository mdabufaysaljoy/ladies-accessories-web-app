import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

/**
 * Built from orders rather than signups — most BD shoppers check out as guests,
 * so the phone number is the identity.
 */
const customerSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: String,
    email: { type: String, index: true },
    district: String,
    area: String,
    address: String,
    orderCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    cancelledCount: { type: Number, default: 0 },
    lastOrderAt: Date,
    tags: [String],
    riskFlag: { type: String, enum: ['none', 'watch', 'blocked'], default: 'none' },
    notes: String,
    acceptsMarketing: { type: Boolean, default: true },

    /**
     * Accounts are optional — a customer record is created by their first order
     * whether or not they ever set a password. `hasAccount` is what separates a
     * guest record from one that can sign in.
     */
    passwordHash: { type: String, select: false },
    hasAccount: { type: Boolean, default: false },
    lastLoginAt: Date,
    tokenVersion: { type: Number, default: 0 },

    addresses: [
      {
        label: { type: String, default: 'Home' },
        name: String,
        phone: String,
        district: String,
        area: String,
        address: String,
        zoneId: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
)

customerSchema.virtual('segment').get(function () {
  if (this.riskFlag === 'blocked') return 'blocked'
  if (this.orderCount >= 5) return 'vip'
  if (this.orderCount >= 2) return 'repeat'
  return 'new'
})

customerSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 12)
  this.hasAccount = true
}

customerSchema.methods.verifyPassword = function (plain) {
  if (!this.passwordHash) return false
  return bcrypt.compare(plain, this.passwordHash)
}

/** Exactly one address may be the default. */
customerSchema.methods.normaliseAddresses = function (preferredId) {
  const target = preferredId
    ? this.addresses.id(preferredId)
    : this.addresses.find((a) => a.isDefault) ?? this.addresses[0]
  this.addresses.forEach((a) => {
    a.isDefault = Boolean(target && String(a._id) === String(target._id))
  })
  return this
}

/** What the storefront is allowed to see about its own account. */
customerSchema.methods.toAccountJSON = function () {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    email: this.email,
    orderCount: this.orderCount,
    totalSpent: this.totalSpent,
    acceptsMarketing: this.acceptsMarketing,
    addresses: this.addresses.map((a) => ({
      id: a._id,
      label: a.label,
      name: a.name,
      phone: a.phone,
      district: a.district,
      area: a.area,
      address: a.address,
      zoneId: a.zoneId,
      isDefault: a.isDefault,
    })),
  }
}

customerSchema.set('toJSON', { virtuals: true })

export const Customer = mongoose.model('Customer', customerSchema)
