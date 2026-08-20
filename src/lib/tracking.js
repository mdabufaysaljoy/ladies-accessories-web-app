/**
 * Marketing tracking — Meta Pixel, Meta Conversions API, GA4, Google Ads, GTM.
 *
 * Everything is driven by the IDs saved in the admin panel: with none set, not
 * a single third-party script is loaded and every call here is a no-op. That
 * keeps the site fast and privacy-clean until the shop actually starts running
 * ads, and means switching a pixel on is a settings change, not a deploy.
 *
 * Each event is fired twice on purpose — once from the browser and once from
 * our own server (`/api/track/event`) — carrying the same `eventId` so Meta
 * deduplicates them. The browser half dies to ad blockers; the server half
 * does not. Purchase is the exception: it is fired server-side straight from
 * the saved order, so its value can never be faked from the console.
 */
import { ACCOUNT_TOKEN_KEY, API_BASE } from '@/lib/api'

let loaded = { meta: false, google: false, gtm: false }
let config = null

const isBrowser = () => typeof window !== 'undefined'

/* ----------------------------- script loading ---------------------------- */

const injectScript = (src, attrs = {}) => {
  const el = document.createElement('script')
  el.async = true
  el.src = src
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  document.head.appendChild(el)
  return el
}

/** The official Meta Pixel bootstrap, kept verbatim so upstream fixes apply. */
function loadMetaPixel(pixelId) {
  if (loaded.meta || !pixelId) return
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    }
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = !0
    n.version = '2.0'
    n.queue = []
    t = b.createElement(e)
    t.async = !0
    t.src = v
    s = b.getElementsByTagName(e)[0]
    s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */
  window.fbq('init', pixelId)
  loaded.meta = true
}

/** GA4 and Google Ads share one gtag.js runtime, so they load together. */
function loadGoogle({ googleAnalyticsId, googleAdsConversionId }) {
  const ids = [googleAnalyticsId, googleAdsConversionId].filter(Boolean)
  if (loaded.google || !ids.length) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids[0])}`)
  // Manual page_view: this is an SPA, so the automatic one would only ever
  // report the landing route.
  ids.forEach((id) => window.gtag('config', id, { send_page_view: false }))
  loaded.google = true
}

function loadGtm(containerId) {
  if (loaded.gtm || !containerId) return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  injectScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`)
  loaded.gtm = true
}

/** Verification meta tags Meta and Google ask you to put in <head>. */
function setMetaTag(name, content) {
  if (!content) return
  let tag = document.querySelector(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

/**
 * Call once, as soon as settings arrive. Safe to call again — each loader is
 * guarded, so a settings reload will not double-inject anything.
 */
export function initTracking(analytics) {
  if (!isBrowser() || !analytics) return
  config = analytics

  captureClickId()
  loadMetaPixel(analytics.facebookPixelId)
  loadGoogle(analytics)
  loadGtm(analytics.googleTagManagerId)
  setMetaTag('facebook-domain-verification', analytics.facebookDomainVerification)
  setMetaTag('google-site-verification', analytics.googleSiteVerification)
}

/* ------------------------------- identity -------------------------------- */

const readCookie = (name) => {
  if (!isBrowser()) return ''
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[2]) : ''
}

/**
 * When someone lands from a Facebook ad the URL carries `fbclid`. The pixel
 * normally turns that into an `_fbc` cookie, but it only does so once it has
 * loaded — and if it is blocked, never. Writing it ourselves means the server
 * still receives the click id and can attribute the sale.
 */
function captureClickId() {
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid')
    if (!fbclid || readCookie('_fbc')) return
    const value = `fb.1.${Date.now()}.${fbclid}`
    document.cookie = `_fbc=${encodeURIComponent(value)}; path=/; max-age=${90 * 24 * 60 * 60}; SameSite=Lax`
  } catch {
    /* cookies disabled — tracking degrades, the shop does not */
  }
}

/** The two identifiers CAPI cares most about, for the checkout payload. */
export function getPixelIds() {
  return { fbp: readCookie('_fbp'), fbc: readCookie('_fbc') }
}

const newEventId = () => {
  try {
    return crypto.randomUUID()
  } catch {
    return `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/* -------------------------------- events --------------------------------- */

/** Mirrors a browser event to our server so CAPI can send its own copy. */
function forwardToServer(eventName, eventId, customData) {
  if (!config?.serverSideEnabled) return
  /**
   * Purchase is the one event the server owns outright — it is sent from the
   * saved order, with the real total. Forwarding it from here would be
   * rejected (the endpoint refuses client-supplied purchases so the value
   * cannot be faked) and would only add a failed request to every sale.
   */
  if (eventName === 'Purchase') return
  const body = JSON.stringify({
    eventName,
    eventId,
    sourceUrl: window.location.href,
    customData,
    userData: getPixelIds(),
  })
  const url = `${API_BASE}/track/event`

  // Fire-and-forget, and survives the page unloading mid-navigation.
  try {
    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY)
    if (!token && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      return
    }
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* never let analytics throw into a click handler */
  }
}

/** Maps our event names onto the GA4 recommended ones. */
const GA_EVENTS = {
  ViewContent: 'view_item',
  AddToCart: 'add_to_cart',
  AddToWishlist: 'add_to_wishlist',
  InitiateCheckout: 'begin_checkout',
  Search: 'search',
  Purchase: 'purchase',
  Lead: 'generate_lead',
  CompleteRegistration: 'sign_up',
}

function toGa4(customData = {}) {
  return {
    currency: customData.currency ?? 'BDT',
    value: customData.value,
    ...(customData.searchString ? { search_term: customData.searchString } : {}),
    ...(Array.isArray(customData.contents)
      ? {
          items: customData.contents.map((c) => ({
            item_id: c.id,
            item_name: c.name ?? c.id,
            price: c.item_price,
            quantity: c.quantity,
          })),
        }
      : {}),
  }
}

/**
 * The one function the app calls. `customData` uses our own camelCase shape;
 * translating it to each vendor's vocabulary happens here so pages never have
 * to know what a `content_id` is.
 */
export function track(eventName, customData = {}, { eventId } = {}) {
  if (!isBrowser() || !config) return null
  const id = eventId ?? newEventId()

  try {
    if (window.fbq) {
      window.fbq(
        'track',
        eventName,
        {
          currency: customData.currency ?? 'BDT',
          ...(customData.value != null ? { value: customData.value } : {}),
          ...(customData.contentName ? { content_name: customData.contentName } : {}),
          ...(customData.contentCategory ? { content_category: customData.contentCategory } : {}),
          ...(customData.contentIds ? { content_ids: customData.contentIds } : {}),
          ...(customData.contents ? { contents: customData.contents, content_type: 'product' } : {}),
          ...(customData.searchString ? { search_string: customData.searchString } : {}),
          ...(customData.numItems != null ? { num_items: customData.numItems } : {}),
          ...(customData.orderId ? { order_id: customData.orderId } : {}),
        },
        // Same id as the server copy — this is what stops double counting.
        { eventID: id },
      )
    }

    if (window.gtag && GA_EVENTS[eventName]) {
      window.gtag('event', GA_EVENTS[eventName], {
        ...toGa4(customData),
        ...(customData.orderId ? { transaction_id: customData.orderId } : {}),
      })
    }

    if (window.dataLayer) {
      window.dataLayer.push({ event: `gbs_${eventName}`, ...customData, eventId: id })
    }
  } catch {
    /* a broken pixel must never break the page */
  }

  forwardToServer(eventName, id, customData)
  return id
}

/** SPA route change — GA4 and the pixel both need to be told explicitly. */
export function trackPageView(path) {
  if (!isBrowser() || !config) return
  try {
    if (window.fbq) window.fbq('track', 'PageView')
    if (window.gtag && config.googleAnalyticsId) {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
      })
    }
  } catch {
    /* ignore */
  }
}

/**
 * Purchase, from the confirmation page. The server sends its own copy from the
 * order record; passing the order number as the event id is what keeps the two
 * from being counted as two sales.
 */
export function trackPurchase(order) {
  if (!isBrowser() || !config || !order) return
  const contents = (order.lines ?? []).map((l) => ({
    id: l.slug ?? String(l.product ?? ''),
    name: l.name,
    quantity: l.qty,
    item_price: l.price,
  }))

  track(
    'Purchase',
    {
      currency: 'BDT',
      value: order.totals?.total ?? 0,
      orderId: order.orderNumber,
      contents,
      contentIds: contents.map((c) => c.id),
      numItems: contents.reduce((sum, c) => sum + (c.quantity ?? 0), 0),
    },
    { eventId: order.orderNumber },
  )

  // Google Ads counts conversions through its own labelled event.
  try {
    if (window.gtag && config.googleAdsConversionId && config.googleAdsPurchaseLabel) {
      window.gtag('event', 'conversion', {
        send_to: `${config.googleAdsConversionId}/${config.googleAdsPurchaseLabel}`,
        value: order.totals?.total ?? 0,
        currency: 'BDT',
        transaction_id: order.orderNumber,
      })
    }
  } catch {
    /* ignore */
  }
}

/** Convenience wrappers so pages read as intent, not as pixel plumbing. */
export const trackProductView = (product) =>
  track('ViewContent', {
    contentName: product.name,
    contentCategory: product.category,
    contentIds: [product.slug],
    contents: [{ id: product.slug, name: product.name, quantity: 1, item_price: product.price }],
    value: product.price,
  })

export const trackAddToCart = (product, qty = 1, price) =>
  track('AddToCart', {
    contentName: product.name,
    contentCategory: product.category,
    contentIds: [product.slug],
    contents: [{ id: product.slug, name: product.name, quantity: qty, item_price: price ?? product.price }],
    value: (price ?? product.price) * qty,
    numItems: qty,
  })

export const trackAddToWishlist = (product) =>
  track('AddToWishlist', {
    contentName: product.name,
    contentIds: [product.slug],
    value: product.price,
  })

export const trackBeginCheckout = (lines, total) =>
  track('InitiateCheckout', {
    value: total,
    numItems: lines.reduce((sum, l) => sum + l.qty, 0),
    contentIds: lines.map((l) => l.slug),
    contents: lines.map((l) => ({ id: l.slug, name: l.name, quantity: l.qty, item_price: l.price })),
  })

export const trackSearch = (query) => track('Search', { searchString: query })
