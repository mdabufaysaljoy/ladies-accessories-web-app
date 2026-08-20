import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { AdminUser } from '../models/AdminUser.js'
import { signToken, requireAuth, requireRole } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../utils/helpers.js'
import { logActivity } from '../models/ActivityLog.js'
import { isProd } from '../config/env.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
})

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {}
    if (!email || !password) throw ApiError.badRequest('Email and password are required')

    const user = await AdminUser.findOne({ email: String(email).toLowerCase().trim() })
    // Same message either way so the endpoint cannot enumerate accounts.
    const ok = user && user.active && (await user.verifyPassword(password))
    if (!ok) throw ApiError.unauthorized('Incorrect email or password')

    user.lastLoginAt = new Date()
    await user.save()

    const token = signToken(user)
    res.cookie('gbs_admin_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    await logActivity({
      actor: user._id,
      actorName: user.name,
      action: 'auth.login',
      summary: `${user.name} signed in`,
      ip: req.ip,
    })

    res.json({ token, user: user.toSafeJSON() })
  }),
)

router.post('/logout', (_req, res) => {
  res.clearCookie('gbs_admin_token')
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeJSON() }))

router.patch(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {}
    if (!(await req.user.verifyPassword(currentPassword ?? ''))) {
      throw ApiError.badRequest('Your current password is incorrect')
    }
    if (!newPassword || newPassword.length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters')
    }
    await req.user.setPassword(newPassword)
    req.user.tokenVersion += 1 // sign every other device out
    await req.user.save()

    const token = signToken(req.user)
    res.json({ ok: true, token })
  }),
)

/* --------------------------- team management ---------------------------- */

router.get(
  '/users',
  requireAuth,
  requireRole('owner', 'admin'),
  asyncHandler(async (_req, res) => {
    const users = await AdminUser.find().sort('-createdAt')
    res.json({ users: users.map((u) => u.toSafeJSON()) })
  }),
)

router.post(
  '/users',
  requireAuth,
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body ?? {}
    if (!name || !email || !password) throw ApiError.badRequest('Name, email and password are required')
    if (password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters')
    if (role === 'owner' && req.user.role !== 'owner') {
      throw ApiError.forbidden('Only an owner can create another owner')
    }

    const user = new AdminUser({ name, email, role: role ?? 'support' })
    await user.setPassword(password)
    await user.save()

    await logActivity({
      actor: req.user._id,
      actorName: req.user.name,
      action: 'team.create',
      entity: 'AdminUser',
      entityId: String(user._id),
      summary: `Added ${user.name} as ${user.role}`,
    })

    res.status(201).json({ user: user.toSafeJSON() })
  }),
)

router.patch(
  '/users/:id',
  requireAuth,
  requireRole('owner', 'admin'),
  asyncHandler(async (req, res) => {
    const user = await AdminUser.findById(req.params.id)
    if (!user) throw ApiError.notFound('User not found')
    if (user.role === 'owner' && req.user.role !== 'owner') {
      throw ApiError.forbidden('Only an owner can modify an owner')
    }

    const { name, role, active, password } = req.body ?? {}
    if (name) user.name = name
    if (role) user.role = role
    if (typeof active === 'boolean') user.active = active
    if (password) {
      if (password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters')
      await user.setPassword(password)
      user.tokenVersion += 1
    }
    await user.save()
    res.json({ user: user.toSafeJSON() })
  }),
)

router.delete(
  '/users/:id',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    if (String(req.user._id) === req.params.id) throw ApiError.badRequest('You cannot delete yourself')
    await AdminUser.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  }),
)

export default router
