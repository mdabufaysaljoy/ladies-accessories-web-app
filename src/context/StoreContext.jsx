import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useProductsBySlug } from '@/hooks/useCatalog'
import { useSettings } from '@/context/SettingsContext'
import { api } from '@/lib/api'
import { freeShippingThreshold, qualifiesForFreeShipping } from '@/utils/format'
import { trackAddToCart } from '@/lib/tracking'

const StoreContext = createContext(null)

/** A cart line is identified by product + chosen variant, not product alone. */
const lineKey = (productId, color, size) => [productId, color || '-', size || '-'].join('::')

export function StoreProvider({ children }) {
  const { zones, delivery } = useSettings()
  const [lines, setLines] = useLocalStorage('gbs.cart', [])
  const [wishlist, setWishlist] = useLocalStorage('gbs.wishlist', [])
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage('gbs.recent', [])

  /**
   * Both lists are stored as slugs and resolved against the database.
   *
   * They used to be looked up in the bundled `PRODUCTS` array, so a saved item
   * showed demo data — the wrong price, the wrong stock, and a product the
   * shop may never have sold. Resolving from the API also means an item that
   * has since been deleted quietly drops out of the list instead of lingering.
   */
  const wishlistProducts = useProductsBySlug(wishlist)
  const recentProducts = useProductsBySlug(recentlyViewed)
  const [orders, setOrders] = useLocalStorage('gbs.orders', [])
  const [coupon, setCoupon] = useLocalStorage('gbs.coupon', null)
  const [zoneId, setZoneId] = useLocalStorage('gbs.zone', 'dhaka-city')

  const [toasts, setToasts] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  /* ------------------------------- toasts -------------------------------- */
  const toast = useCallback((message, opts = {}) => {
    const id = crypto.randomUUID()
    setToasts((t) => [...t, { id, message, ...opts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration ?? 3600)
  }, [])

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  /* -------------------------------- cart --------------------------------- */
  const addToCart = useCallback(
    (product, { qty = 1, color = null, size = null, silent = false } = {}) => {
      const key = lineKey(product.id, color, size)
      setLines((current) => {
        const existing = current.find((l) => l.key === key)
        if (existing) {
          return current.map((l) =>
            l.key === key ? { ...l, qty: Math.min(l.qty + qty, product.stock) } : l,
          )
        }
        const sizeOption = product.sizes?.find((s) => s.label === size)
        return [
          ...current,
          {
            key,
            id: product.id,
            slug: product.slug,
            name: product.name,
            price: product.price + (sizeOption?.priceDelta ?? 0),
            compareAt: product.compareAt,
            art: product.art,
            image: product.image ?? null,
            category: product.category,
            stock: product.stock,
            color,
            size,
            qty: Math.min(qty, product.stock),
          },
        ]
      })
      if (!silent) {
        toast(`${product.name} added to bag`, { kind: 'success', slug: product.slug })
        setCartOpen(true)
      }

      // Fires for "Buy now" too (silent only suppresses the toast and drawer):
      // the shopper did put the item in the bag, and Meta expects AddToCart to
      // precede InitiateCheckout in the funnel.
      const sizeOption = product.sizes?.find((s) => s.label === size)
      trackAddToCart(product, qty, product.price + (sizeOption?.priceDelta ?? 0))
    },
    [setLines, toast],
  )

  const updateQty = useCallback(
    (key, qty) =>
      setLines((current) =>
        qty <= 0
          ? current.filter((l) => l.key !== key)
          : current.map((l) => (l.key === key ? { ...l, qty: Math.min(qty, l.stock) } : l)),
      ),
    [setLines],
  )

  const removeLine = useCallback(
    (key) => {
      setLines((current) => current.filter((l) => l.key !== key))
      toast('Removed from bag')
    },
    [setLines, toast],
  )

  const clearCart = useCallback(() => {
    setLines([])
    setCoupon(null)
  }, [setLines, setCoupon])

  /* ------------------------------ wishlist ------------------------------- */
  const toggleWishlist = useCallback(
    (slug) => {
      setWishlist((w) => {
        const has = w.includes(slug)
        toast(has ? 'Removed from wishlist' : 'Saved to wishlist', { kind: has ? 'info' : 'success' })
        return has ? w.filter((s) => s !== slug) : [...w, slug]
      })
    },
    [setWishlist, toast],
  )

  const inWishlist = useCallback((slug) => wishlist.includes(slug), [wishlist])

  /* --------------------------- recently viewed --------------------------- */
  const trackView = useCallback(
    (slug) => setRecentlyViewed((r) => [slug, ...r.filter((s) => s !== slug)].slice(0, 8)),
    [setRecentlyViewed],
  )

  /* ------------------------------- coupons ------------------------------- */
  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.qty, 0), [lines])

  /** Validated server-side — a coupon's real terms never live in the browser. */
  const applyCoupon = useCallback(
    async (code) => {
      try {
        const { coupon: valid } = await api.post('/coupons/validate', { code, subtotal })
        setCoupon(valid)
        toast(`${valid.code} applied — ${valid.label}`, { kind: 'success' })
        return true
      } catch (error) {
        toast(error.message ?? 'That coupon code is not valid', { kind: 'error' })
        return false
      }
    },
    [subtotal, setCoupon, toast],
  )

  const removeCoupon = useCallback(() => setCoupon(null), [setCoupon])

  /* -------------------------------- totals ------------------------------- */
  const zone = useMemo(
    () =>
      zones.find((z) => z.id === zoneId) ??
      zones[0] ?? { id: 'dhaka-city', label: 'Inside Dhaka City', charge: 70, eta: '1–2 working days' },
    [zones, zoneId],
  )
  // 0 means the shop has switched free delivery off — see utils/format.
  const freeThreshold = freeShippingThreshold(delivery)

  const totals = useMemo(() => {
    const itemCount = lines.reduce((n, l) => n + l.qty, 0)

    let discount = 0
    if (coupon?.type === 'percent') discount = Math.round((subtotal * coupon.value) / 100)
    if (coupon?.type === 'flat') discount = Math.min(coupon.value, subtotal)

    const qualifiesFreeShipping =
      qualifiesForFreeShipping(subtotal, delivery) ||
      (coupon?.type === 'shipping' && subtotal >= (coupon.minSpend ?? coupon.min ?? 0))

    const shipping = itemCount === 0 || qualifiesFreeShipping ? 0 : zone.charge
    const savings =
      lines.reduce((s, l) => s + (l.compareAt ? (l.compareAt - l.price) * l.qty : 0), 0) + discount

    return {
      itemCount,
      subtotal,
      discount,
      shipping,
      qualifiesFreeShipping,
      // Meaningless when the offer is off, so report nothing to add.
      amountToFreeShipping: freeThreshold > 0 ? Math.max(0, freeThreshold - subtotal) : 0,
      savings,
      total: Math.max(0, subtotal - discount) + shipping,
    }
  }, [lines, subtotal, coupon, zone, freeThreshold])

  /* -------------------------------- orders ------------------------------- */
  /**
   * Keeps a local copy of orders placed on this device so the confirmation page
   * renders instantly. The server remains the source of truth — /track-order
   * re-fetches by order number + phone for anyone on a different device.
   */
  const placeOrder = useCallback(
    (order) => {
      setOrders((o) => [order, ...o.filter((x) => x.orderNumber !== order.orderNumber)].slice(0, 20))
      clearCart()
    },
    [setOrders, clearCart],
  )

  const findOrder = useCallback(
    (id) => orders.find((o) => o.orderNumber === String(id).trim().toUpperCase()),
    [orders],
  )

  const value = useMemo(
    () => ({
      lines,
      addToCart,
      updateQty,
      removeLine,
      clearCart,
      wishlist,
      toggleWishlist,
      inWishlist,
      wishlistProducts,
      recentProducts,
      trackView,
      coupon,
      applyCoupon,
      removeCoupon,
      zone,
      zoneId,
      setZoneId,
      totals,
      orders,
      placeOrder,
      findOrder,
      toasts,
      toast,
      dismissToast,
      cartOpen,
      setCartOpen,
      searchOpen,
      setSearchOpen,
    }),
    [
      lines, addToCart, updateQty, removeLine, clearCart,
      wishlist, toggleWishlist, inWishlist, recentlyViewed, trackView,
      wishlistProducts, recentProducts,
      coupon, applyCoupon, removeCoupon, zone, zoneId, setZoneId, totals,
      orders, placeOrder, findOrder,
      toasts, toast, dismissToast, cartOpen, searchOpen,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
