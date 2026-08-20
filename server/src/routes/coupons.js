import { Router } from 'express'
import { Coupon } from '../models/Coupon.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../utils/helpers.js'

const router = Router()

/** Public: validate a code against a subtotal. Never lists all coupons. */
router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    const { code, subtotal = 0 } = req.body ?? {}
    if (!code) throw ApiError.badRequest('Enter a coupon code')

    const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() })
    if (!coupon) throw ApiError.badRequest('That coupon code is not valid')

    const check = coupon.isRedeemable(Number(subtotal))
    if (!check.ok) throw ApiError.badRequest(check.reason)

    res.json({
      coupon: {
        code: coupon.code,
        label: coupon.label,
        type: coupon.type,
        value: coupon.value,
        minSpend: coupon.minSpend,
        discount: coupon.discountFor(Number(subtotal)),
      },
    })
  }),
)

/** Public: codes flagged for display on the storefront. */
router.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const coupons = await Coupon.find({
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).select('code label type value minSpend').limit(6)
    res.json({ coupons })
  }),
)

router.get(
  '/',
  requireAuth,
  requireAbility('coupons'),
  asyncHandler(async (_req, res) => {
    const coupons = await Coupon.find().sort('-createdAt')
    res.json({ coupons })
  }),
)

router.post(
  '/',
  requireAuth,
  requireAbility('coupons'),
  asyncHandler(async (req, res) => {
    const coupon = await Coupon.create({ ...req.body, _id: undefined })
    res.status(201).json({ coupon })
  }),
)

router.patch(
  '/:id',
  requireAuth,
  requireAbility('coupons'),
  asyncHandler(async (req, res) => {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      { ...req.body, _id: undefined },
      { new: true, runValidators: true },
    )
    if (!coupon) throw ApiError.notFound('Coupon not found')
    res.json({ coupon })
  }),
)

router.delete(
  '/:id',
  requireAuth,
  requireAbility('coupons'),
  asyncHandler(async (req, res) => {
    await Coupon.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  }),
)

export default router
