import { useCallback, useEffect, useState } from 'react'
import { api, qs } from '@/lib/api'

/**
 * Normalises an API product into the shape the storefront components already
 * expect, so switching the data source did not require rewriting every view.
 * Products seeded before the API existed still render through the same path.
 */
export function adaptProduct(p) {
  if (!p) return null
  return {
    ...p,
    id: p._id ?? p.id,
    reviews: p.reviewCount ?? p.reviews ?? 0,
    details: p.details ?? [],
    specifications: p.specifications ?? [],
    colors: p.colors ?? [],
    sizes: p.sizes ?? [],
    tags: p.tags ?? [],
    images: p.images ?? [],
    videos: p.videos ?? [],
    image: p.images?.[0]?.url ?? p.image ?? null,
    compareAt: p.compareAt || 0,
  }
}

/** Paginated product list with filters. */
export function useProducts(params = {}, { enabled = true } = {}) {
  const [state, setState] = useState({ products: [], meta: null, loading: enabled, error: null })
  const key = JSON.stringify(params)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    setState((s) => ({ ...s, loading: true }))

    api
      .get(`/products${qs(JSON.parse(key))}`)
      .then((d) => {
        if (!alive) return
        setState({ products: d.products.map(adaptProduct), meta: d.meta, loading: false, error: null })
      })
      .catch((error) => {
        if (!alive) return
        // Showing bundled demo products when the API is unreachable put items
        // on the shelf that cannot be bought; an error state is more honest.
        setState({ products: [], meta: null, loading: false, error })
      })

    return () => {
      alive = false
    }
  }, [key, enabled])

  return state
}

/** Single product plus its related items. */
export function useProduct(slug) {
  const [state, setState] = useState({ product: null, related: [], loading: true, error: null })

  useEffect(() => {
    if (!slug) return
    let alive = true
    setState((s) => ({ ...s, loading: true }))

    api
      .get(`/products/${slug}`)
      .then((d) => {
        if (!alive) return
        setState({
          product: adaptProduct(d.product),
          related: (d.related ?? []).map(adaptProduct),
          loading: false,
          error: null,
        })
      })
      .catch((error) => {
        if (!alive) return
        /**
         * A deleted product must 404, not silently resolve to the bundled
         * demo record of the same slug — that showed a product page, with a
         * price and an add-to-bag button, for something the shop had removed.
         */
        setState({ product: null, related: [], loading: false, error })
      })

    return () => {
      alive = false
    }
  }, [slug])

  return state
}

/** Live search for the ⌘K overlay. */
export function useProductSearch() {
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const search = useCallback(async (query) => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const d = await api.get(`/products${qs({ q, limit: 8 })}`)
      setResults(d.products.map(adaptProduct))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  return { results, searching, search }
}

/** Product facets (types, tags, price range) for the shop filter panel. */
export function useFacets(category) {
  const [facets, setFacets] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .get(`/products/facets${qs({ category })}`)
      .then((d) => alive && setFacets(d))
      .catch(() => alive && setFacets(null))
    return () => {
      alive = false
    }
  }, [category])

  return facets
}

/**
 * The home page and cross-sell rails, from the database.
 *
 * These used to call `bestsellers()` / `newArrivals()` / `onSale()` on the
 * bundled `src/data/products.js`, which meant every rail on the storefront
 * showed demo products regardless of what the shop actually sells — the
 * catalogue could be emptied and the home page would look unchanged.
 *
 * No offline fallback here on purpose: an empty catalogue must render as
 * empty. Falling back to bundled demo products is what created the illusion
 * of stock that does not exist.
 */
function useRail(params, limit) {
  const [state, setState] = useState({ products: [], loading: true, total: 0 })
  const key = JSON.stringify({ ...params, limit })

  useEffect(() => {
    let alive = true
    api
      .get(`/products${qs(JSON.parse(key))}`)
      .then((d) => {
        if (!alive) return
        setState({
          products: (d.products ?? []).map(adaptProduct),
          loading: false,
          total: d.meta?.total ?? d.products?.length ?? 0,
        })
      })
      .catch(() => alive && setState({ products: [], loading: false, total: 0 }))
    return () => {
      alive = false
    }
  }, [key])

  return state
}

/**
 * A rail the shop can curate.
 *
 * If any product has been pinned to this collection in the admin, the rail is
 * exactly those products. If none has, it falls back to the automatic
 * ordering — units sold, or newest first — so a shop that has not curated
 * anything still gets a sensible home page.
 */
function useCuratedRail(collection, autoParams, limit) {
  const pinned = useRail({ collection }, limit)
  const auto = useRail(autoParams, limit)

  // Wait for the pinned query before deciding, or the rail would flash the
  // automatic list and then replace it.
  if (pinned.loading) return { products: [], loading: true, total: 0 }
  return pinned.total > 0 ? pinned : auto
}

export const useBestsellers = (limit = 8) =>
  useCuratedRail('bestseller', { sort: 'bestselling' }, limit)

export const useNewArrivals = (limit = 8) =>
  useCuratedRail('new-arrival', { sort: 'new' }, limit)

export const useOnSale = (limit = 8) => useRail({ onSale: 'true' }, limit)

/**
 * Resolves a handful of products by slug in one request — for the wishlist,
 * recently-viewed and any hand-picked editorial slot.
 */
export function useProductsBySlug(slugs = []) {
  const clean = (slugs ?? []).filter(Boolean)
  const key = clean.join(',')
  const [products, setProducts] = useState([])

  useEffect(() => {
    if (!key) {
      setProducts([])
      return
    }
    let alive = true
    api
      .get(`/products?slugs=${encodeURIComponent(key)}&limit=20`)
      .then((d) => {
        if (!alive) return
        // Restore the caller's order; the API sorts by its own rules.
        const bySlug = new Map((d.products ?? []).map((p) => [p.slug, p]))
        setProducts(key.split(',').map((s) => bySlug.get(s)).filter(Boolean).map(adaptProduct))
      })
      .catch(() => alive && setProducts([]))
    return () => {
      alive = false
    }
  }, [key])

  return products
}
