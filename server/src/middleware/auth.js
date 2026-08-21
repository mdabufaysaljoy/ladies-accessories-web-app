import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AdminUser } from '../models/AdminUser.js'
import { ApiError, asyncHandler } from '../utils/helpers.js'

/**
 * Admin and customer sessions are signed with the same secret, so the audience
 * claim is what keeps them apart. Without it a customer token verifies here
 * perfectly well and is only rejected because its `sub` happens not to exist
 * in the admin collection — defence by coincidence rather than by design.
 */
const AUDIENCE = 'admin'

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), v: user.tokenVersion, aud: AUDIENCE }, env.jwtSecret, {
    expiresIn: env.jwtExpiry,
  })

const extractToken = (req) => {
  const header = req.headers.authorization ?? ''
  if (header.startsWith('Bearer ')) return header.slice(7)
  return req.cookies?.gbs_admin_token ?? null
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req)
  if (!token) throw ApiError.unauthorized()

  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret, { audience: AUDIENCE })
  } catch {
    throw ApiError.unauthorized('Session expired — please sign in again')
  }

  const user = await AdminUser.findById(payload.sub)
  if (!user || !user.active) throw ApiError.unauthorized('Account is inactive')
  // Password change / forced logout bumps tokenVersion, killing old tokens.
  if (user.tokenVersion !== payload.v) throw ApiError.unauthorized('Session revoked')

  req.user = user
  next()
})

/** requireAbility('products') — owner bypasses all checks. */
export const requireAbility = (ability) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized())
  if (!req.user.can(ability)) {
    return next(ApiError.forbidden(`Your role (${req.user.role}) cannot manage ${ability}`))
  }
  next()
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized())
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden())
  next()
}
