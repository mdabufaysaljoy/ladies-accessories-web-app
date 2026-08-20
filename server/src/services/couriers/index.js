import { Settings } from '../../models/Settings.js'
import { ApiError } from '../../utils/helpers.js'
import * as steadfast from './steadfast.js'
import * as pathao from './pathao.js'
import * as redx from './redx.js'

/**
 * Courier registry.
 *
 * Every provider exposes the same four functions, so the rest of the app never
 * branches on which courier is in use. Adding another one means writing an
 * adapter and adding it to this map plus the settings schema — nothing else in
 * the codebase changes.
 */
const PROVIDERS = { steadfast, pathao, redx }

export const listProviders = () => Object.keys(PROVIDERS)

export const getProvider = (name) => {
  const provider = PROVIDERS[name]
  if (!provider) throw ApiError.badRequest(`Unknown courier: ${name}`)
  return provider
}

const configFor = (settings, name) => settings.couriers?.[name] ?? {}

/** What the admin panel shows on the couriers tab. */
export async function statusAll() {
  const settings = await Settings.getSingleton()
  return Object.entries(PROVIDERS).map(([name, provider]) => {
    const cfg = configFor(settings, name)
    return {
      id: name,
      label: provider.label,
      enabled: Boolean(cfg.enabled),
      configured: provider.isConfigured(cfg),
      sandbox: Boolean(cfg.sandbox),
    }
  })
}

/** Providers that are both switched on and hold valid credentials. */
export async function availableProviders() {
  return (await statusAll()).filter((p) => p.enabled && p.configured)
}

async function resolve(name) {
  const settings = await Settings.getSingleton()
  const chosen = name || settings.couriers?.defaultProvider || 'steadfast'
  const provider = getProvider(chosen)
  const cfg = configFor(settings, chosen)

  if (!cfg.enabled) throw ApiError.badRequest(`${provider.label} is not enabled`)
  if (!provider.isConfigured(cfg)) {
    throw ApiError.badRequest(`${provider.label} is missing its API credentials`)
  }
  return { provider, cfg, settings }
}

/**
 * Books the parcel and writes the result onto the order. Returns the updated
 * order so callers do not have to re-read it.
 */
export async function createConsignment(order, providerName, { by = 'system' } = {}) {
  if (order.delivery?.consignmentId) {
    throw ApiError.conflict(
      `This order already has consignment ${order.delivery.consignmentId} with ${order.delivery.courier}`,
    )
  }

  const { provider, cfg } = await resolve(providerName)
  const result = await provider.createConsignment(cfg, order)

  order.delivery.provider = result.provider
  order.delivery.courier = provider.label
  order.delivery.consignmentId = result.consignmentId
  order.delivery.trackingCode = result.trackingCode
  order.delivery.trackingNumber = result.trackingCode || result.consignmentId
  order.delivery.trackingUrl = result.trackingUrl
  order.delivery.courierStatus = result.status
  order.delivery.lastSyncedAt = new Date()
  order.delivery.courierResponse = result.raw

  order.timeline.push({
    status: order.status,
    note: `Sent to ${provider.label} — consignment ${result.consignmentId}`,
    by,
    at: new Date(),
  })

  await order.save()
  return { order, result }
}

/**
 * Re-reads the courier's status. When the courier says the parcel is delivered
 * or returned, the order status follows automatically — that is the whole point
 * of polling, so the shop does not have to watch a second dashboard.
 */
export async function syncStatus(order, { by = 'system' } = {}) {
  if (!order.delivery?.consignmentId && !order.delivery?.trackingCode) {
    throw ApiError.badRequest('This order has no courier consignment yet')
  }

  const { provider, cfg } = await resolve(order.delivery.provider)
  const { status, raw } = await provider.getStatus(cfg, {
    consignmentId: order.delivery.consignmentId,
    trackingCode: order.delivery.trackingCode,
    invoice: order.invoice?.number || order.orderNumber,
  })

  const changed = status && status !== order.delivery.courierStatus
  order.delivery.courierStatus = status
  order.delivery.lastSyncedAt = new Date()
  order.delivery.courierResponse = raw

  let advancedTo = null
  const mapped = provider.mapStatus(status)
  const terminal = ['delivered', 'returned', 'cancelled']

  // Only ever move forward, and never overwrite a terminal status.
  if (mapped && mapped !== order.status && !terminal.includes(order.status)) {
    order.pushStatus(mapped, `${provider.label}: ${status}`, by)
    advancedTo = mapped
  } else if (changed) {
    order.timeline.push({ status: order.status, note: `${provider.label}: ${status}`, by, at: new Date() })
  }

  await order.save()
  return { order, courierStatus: status, advancedTo, changed: Boolean(changed) }
}

export async function getBalance(providerName) {
  const { provider, cfg } = await resolve(providerName)
  if (!provider.getBalance) throw ApiError.badRequest(`${provider.label} has no balance endpoint`)
  return provider.getBalance(cfg)
}

/** Pathao needs a store id; this lets the admin pick one instead of typing it. */
export async function listStores(providerName) {
  const { provider, cfg } = await resolve(providerName)
  if (!provider.listStores) return []
  return provider.listStores(cfg)
}

/**
 * Fire-and-forget booking used when auto-dispatch is on. A courier outage must
 * never block an order from being placed or shipped, so failures are recorded
 * on the timeline rather than thrown.
 */
export async function tryAutoCreate(order, { by = 'automation' } = {}) {
  const settings = await Settings.getSingleton()
  if (!settings.couriers?.autoCreateConsignment) return { skipped: 'disabled' }
  if (order.delivery?.consignmentId) return { skipped: 'already-booked' }

  try {
    const { result } = await createConsignment(order, settings.couriers.defaultProvider, { by })
    return { ok: true, consignmentId: result.consignmentId, provider: result.provider }
  } catch (error) {
    order.timeline.push({
      status: order.status,
      note: `Auto-dispatch failed: ${error.message}`,
      by,
      at: new Date(),
    })
    await order.save()
    console.error('[courier] auto-create failed:', error.message)
    return { ok: false, error: error.message }
  }
}
