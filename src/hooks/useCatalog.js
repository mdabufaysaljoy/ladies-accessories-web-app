import { useCallback, useEffect, useState } from 'react'
import { api, qs } from '@/lib/api'
import { PRODUCTS as LOCAL_PRODUCTS } from '@/data/products'

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

const LOCAL = LOCAL_PRODUCTS.map(adaptProduct)

/** Paginated product list with filters. Falls back to bundled data offline. */
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
        setState({ products: LOCAL, meta: null, loading: false, error })
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
        const local = LOCAL.find((p) => p.slug === slug) ?? null
        setState({
          product: local,
          related: local ? LOCAL.filter((p) => p.category === local.category && p.slug !== slug).slice(0, 4) : [],
          loading: false,
          error: local ? null : error,
        })
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
      setResults(
        LOCAL.filter((p) =>
          [p.name, p.category, p.subcategory, p.short, ...p.tags].join(' ').toLowerCase().includes(q.toLowerCase()),
        ).slice(0, 8),
      )
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
