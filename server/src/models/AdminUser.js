import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

export const ROLES = ['owner', 'admin', 'manager', 'support']

/** Route-level capabilities per role. `owner` implicitly has everything. */
export const ROLE_ABILITIES = {
  owner: ['*'],
  admin: ['products', 'orders', 'customers', 'inbox', 'campaigns', 'settings', 'analytics', 'coupons', 'media'],
  manager: ['products', 'orders', 'customers', 'inbox', 'analytics', 'coupons', 'media'],
  support: ['orders', 'customers', 'inbox'],
}

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'support' },
    avatarUrl: String,
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
    // Bumping this invalidates every previously issued token for the user.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
)

adminUserSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 12)
}

adminUserSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash)
}

adminUserSchema.methods.can = function (ability) {
  const abilities = ROLE_ABILITIES[this.role] ?? []
  return abilities.includes('*') || abilities.includes(ability)
}

adminUserSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    avatarUrl: this.avatarUrl,
    abilities: ROLE_ABILITIES[this.role] ?? [],
    lastLoginAt: this.lastLoginAt,
  }
}

export const AdminUser = mongoose.model('AdminUser', adminUserSchema)
