import { Order } from '../models/Order.js'
import { Settings } from '../models/Settings.js'
import * as couriers from './couriers/index.js'

/**
 * Background status polling.
 *
 * Re-reads the courier for every parcel still in flight, so "delivered" lands
 * in the admin without anyone opening a second dashboard. The interval is a
 * setting, so it is re-read on each tick rather than captured at boot — an
 * admin changing it takes effect within one cycle instead of needing a restart.
 */
let timer = null
let running = false

const TICK_MS = 60_000 // check once a minute whether a sync is due
let lastRunAt = 0

async function runOnce() {
  if (running) return // never overlap; a slow courier must not stack up calls
  running = true

  try {
    const settings = await Settings.getSingleton()
    const minutes = Number(settings.couriers?.statusSyncMinutes ?? 0)
    if (!minutes) return

    if (Date.now() - lastRunAt < minutes * 60_000) return
    lastRunAt = Date.now()

    const available = await couriers.availableProviders()
    if (!available.length) return

    const inFlight = await Order.find({
      'delivery.consignmentId': { $exists: true, $nin: ['', null] },
      status: { $nin: ['delivered', 'returned', 'cancelled'] },
    }).limit(200)

    if (!inFlight.length) return

    let advanced = 0
    for (const order of inFlight) {
      try {
        const result = await couriers.syncStatus(order, { by: 'auto-sync' })
        if (result.advancedTo) advanced += 1
      } catch (error) {
        // One bad consignment must not stop the rest of the batch.
        console.warn(`[poller] ${order.orderNumber}: ${error.message}`)
      }
      // Be a polite API citizen — these are rate-limited endpoints.
      await new Promise((r) => setTimeout(r, 250))
    }

    console.log(`[poller] checked ${inFlight.length} parcels, ${advanced} advanced`)
  } catch (error) {
    console.error('[poller] failed:', error.message)
  } finally {
    running = false
  }
}

export function startCourierPoller() {
  if (timer) return
  timer = setInterval(runOnce, TICK_MS)
  timer.unref?.() // never hold the process open on shutdown
  console.log('[poller] courier status polling active')
}

export function stopCourierPoller() {
  if (timer) clearInterval(timer)
  timer = null
}
