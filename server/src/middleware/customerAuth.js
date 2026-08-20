import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Customer } from '../models/Customer.js'
import { ApiError, asyncHandler } from '../utils/helpers.js'

/**
 * Customer sessions are deliberately separate from admin sessions: a different
 * cookie, a different audience claim, and a different token. A stolen shopper
 * token must never open the admin panel.
 */
const AUDIENCE = 'customer'

export const signCustomerToken = (customer) =>
  jwt.sign({ sub: String(customer._id), v: customer.tokenVersion, aud: AUDIENCE }, env.jwtSecret, {
    expiresIn: '30d',
  })

const extract = (req) => {
  const header = req.headers.authorization ?? ''
  if (header.startsWith('Bearer ')) return header.slice(7)
  return req.cookies?.gbs_customer_token ?? null
}

async function resolveCustomer(req) {
  const token = extract(req)
  if (!token) return null

  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret, { audience: AUDIENCE })
  } catch {
    return null
  }

  const customer = await Customer.findById(payload.sub)
  if (!customer || !customer.hasAccount) return null
  if (customer.tokenVersion !== payload.v) return null
  if (customer.riskFlag === 'blocked') return null

  return customer
}

/** Hard gate for account pages. */
export const requireCustomer = asyncHandler(async (req, _res, next) => {
  const customer = await resolveCustomer(req)
  if (!customer) throw ApiError.unauthorized('Please sign in to continue')
  req.customer = customer
  next()
})

/**
 * Soft gate. Attaches the customer when signed in and does nothing otherwise —
 * checkout uses this so guests are never blocked from ordering.
 */
export const optionalCustomer = asyncHandler(async (req, _res, next) => {
  req.customer = await resolveCustomer(req)
  next()
})
