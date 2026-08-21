import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { adaptProduct } from '@/hooks/useCatalog'
import { PRODUCTS as LOCAL_PRODUCTS } from '@/data/products'

/**
 * The three products the hero shows, in the order the admin arranged them.
 *
 * The hero is the first thing a visitor sees, so it must never render empty or
 * broken. There are three levels of fallback: the admin's chosen slugs, then
 * whatever is flagged `featured` in the catalogue, and finally the bundled demo
 * products if the API cannot be reached at all.
 */
export function useHeroProducts(slugs = []) {
  const wanted = (slugs ?? []).filter(Boolean)
  const key = wanted.join(',')

  const [products, setProducts] = useState(null)

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        if (key) {
          const { products: found } = await api.get(`/products?slugs=${encodeURIComponent(key)}&limit=10`)
          // The API returns them in its own order; restore the admin's.
          const bySlug = new Map(found.map((p) => [p.slug, p]))
          const ordered = wanted.map((s) => bySlug.get(s)).filter(Boolean)
          if (ordered.length) {
            if (alive) setProducts(ordered.map(adaptProduct))
            return
          }
        }

        // Nothing chosen, or every chosen product has since been archived.
        const { products: featured } = await api.get('/products?featured=true&limit=3')
        if (alive) setProducts((featured ?? []).map(adaptProduct))
      } catch {
        if (alive) setProducts(LOCAL_PRODUCTS.slice(0, 3).map(adaptProduct))
      }
    }

    load()
    return () => {
      alive = false
    }
    // `wanted` is a fresh array on every render; `key` is its stable
    // serialisation and is what actually decides whether to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  /**
   * Padded to three so the hero's layout is stable while loading and when the
   * shop has fewer than three products — the slots reuse what is available
   * rather than collapsing the composition.
   */
  const list = products ?? LOCAL_PRODUCTS.slice(0, 3).map(adaptProduct)
  const safe = list.length ? list : LOCAL_PRODUCTS.slice(0, 3).map(adaptProduct)

  return {
    main: safe[0],
    secondary: safe[1] ?? safe[0],
    tertiary: safe[2] ?? safe[1] ?? safe[0],
    loading: products === null,
  }
}
