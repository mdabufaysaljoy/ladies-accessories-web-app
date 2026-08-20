import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Customer } from '../models/Customer.js'
import { Order } from '../models/Order.js'
import { requireCustomer, signCustomerToken } from '../middleware/customerAuth.js'
import { ApiError, asyncHandler, isValidBdPhone, normalizeBdPhone, paginate, meta } from '../utils/helpers.js'
import { isProd } from '../config/env.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
})

const setCookie = (res, token) =>
  res.cookie('gbs_customer_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })

/**
 * Registration adopts the existing guest record for that phone number, so a
 * shopper who ordered as a guest and signs up later keeps their order history
 * instead of starting from zero.
 */
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, phone, email, password } = req.body ?? {}

    if (!name || String(name).trim().length < 3) throw ApiError.badRequest('Please enter your full name')
    if (!isValidBdPhone(phone)) throw ApiError.badRequest('Enter a valid Bangladeshi mobile number')
    if (!password || password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters')

    const normalised = normalizeBdPhone(phone)
    const existing = await Customer.findOne({ phone: normalised }).select('+passwordHash')

    if (existing?.hasAccount) {
      throw ApiError.conflict('An account already exists for this number. Please sign in instead.')
    }

    const customer = existing ?? new Customer({ phone: normalised })
    customer.name = String(name).trim()
    if (email) customer.email = String(email).toLowerCase().trim()
    await customer.setPassword(password)
    customer.lastLoginAt = new Date()
    await customer.save()

    const token = signCustomerToken(customer)
    setCookie(res, token)
    res.status(201).json({ token, customer: customer.toAccountJSON() })
  }),
)

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body ?? {}
    if (!phone || !password) throw ApiError.badRequest('Mobile number and password are required')

    const customer = await Customer.findOne({ phone: normalizeBdPhone(phone) }).select('+passwordHash')
    // Identical message either way — this endpoint must not confirm which
    // numbers have accounts.
    const ok = customer?.hasAccount && (await customer.verifyPassword(password))
    if (!ok) throw ApiError.unauthorized('Incorrect mobile number or password')
    if (customer.riskFlag === 'blocked') throw ApiError.forbidden('This account is not able to sign in.')

    customer.lastLoginAt = new Date()
    await customer.save()

    const token = signCustomerToken(customer)
    setCookie(res, token)
    res.json({ token, customer: customer.toAccountJSON() })
  }),
)

router.post('/logout', (_req, res) => {
  res.clearCookie('gbs_customer_token')
  res.json({ ok: true })
})

router.get('/me', requireCustomer, (req, res) => res.json({ customer: req.customer.toAccountJSON() }))

router.patch(
  '/me',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { name, email, acceptsMarketing } = req.body ?? {}
    if (name) req.customer.name = String(name).trim()
    if (email !== undefined) req.customer.email = String(email).toLowerCase().trim()
    if (acceptsMarketing !== undefined) req.customer.acceptsMarketing = Boolean(acceptsMarketing)
    await req.customer.save()
    res.json({ customer: req.customer.toAccountJSON() })
  }),
)

router.patch(
  '/password',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {}
    const withHash = await Customer.findById(req.customer._id).select('+passwordHash')

    if (!(await withHash.verifyPassword(currentPassword ?? ''))) {
      throw ApiError.badRequest('Your current password is incorrect')
    }
    if (!newPassword || newPassword.length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters')
    }

    await withHash.setPassword(newPassword)
    withHash.tokenVersion += 1 // sign other devices out
    await withHash.save()

    const token = signCustomerToken(withHash)
    setCookie(res, token)
    res.json({ ok: true, token })
  }),
)

/* ------------------------------- addresses ------------------------------- */

router.get('/addresses', requireCustomer, (req, res) =>
  res.json({ addresses: req.customer.toAccountJSON().addresses }),
)

router.post(
  '/addresses',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { label, name, phone, district, area, address, zoneId, isDefault } = req.body ?? {}
    if (!address || String(address).trim().length < 10) {
      throw ApiError.badRequest('Please give a full address — house, road and area')
    }

    req.customer.addresses.push({
      label: label || 'Home',
      name: name || req.customer.name,
      phone: phone ? normalizeBdPhone(phone) : req.customer.phone,
      district,
      area,
      address: String(address).trim(),
      zoneId,
      isDefault: Boolean(isDefault),
    })

    const added = req.customer.addresses[req.customer.addresses.length - 1]
    if (isDefault || req.customer.addresses.length === 1) req.customer.normaliseAddresses(added._id)
    await req.customer.save()

    res.status(201).json({ customer: req.customer.toAccountJSON() })
  }),
)

router.patch(
  '/addresses/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const entry = req.customer.addresses.id(req.params.id)
    if (!entry) throw ApiError.notFound('Address not found')

    const fields = ['label', 'name', 'district', 'area', 'address', 'zoneId']
    fields.forEach((f) => {
      if (req.body?.[f] !== undefined) entry[f] = req.body[f]
    })
    if (req.body?.phone) entry.phone = normalizeBdPhone(req.body.phone)
    if (req.body?.isDefault) req.customer.normaliseAddresses(entry._id)

    await req.customer.save()
    res.json({ customer: req.customer.toAccountJSON() })
  }),
)

router.delete(
  '/addresses/:id',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const entry = req.customer.addresses.id(req.params.id)
    if (!entry) throw ApiError.notFound('Address not found')

    const wasDefault = entry.isDefault
    entry.deleteOne()
    if (wasDefault && req.customer.addresses.length) req.customer.normaliseAddresses()
    await req.customer.save()

    res.json({ customer: req.customer.toAccountJSON() })
  }),
)

/* --------------------------------- orders -------------------------------- */

router.get(
  '/orders',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query)
    /**
     * Matches on the explicit `account` link first (set whenever the order was
     * placed while signed in), falling back to phone for orders placed as a
     * guest before this field existed or with an account created afterwards.
     */
    const filter = {
      $or: [{ account: req.customer._id }, { 'customer.phone': req.customer.phone }],
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select('orderNumber status totals payment.method payment.status delivery createdAt lines invoice')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ])

    res.json({ orders, meta: meta(total, page, limit) })
  }),
)

router.get(
  '/orders/:orderNumber',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({
      orderNumber: String(req.params.orderNumber).toUpperCase(),
      // scoped — cannot read someone else's order
      $or: [{ account: req.customer._id }, { 'customer.phone': req.customer.phone }],
    })
    if (!order) throw ApiError.notFound('Order not found')
    res.json({ order })
  }),
)

export default router
