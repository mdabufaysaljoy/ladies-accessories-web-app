import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { adaptProduct } from '@/hooks/useCatalog'

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
        // No demo fallback: an empty or unreachable catalogue must show as
        // empty. Substituting bundled products put items in the hero that the
        // shop does not sell and cannot fulfil.
        if (alive) setProducts([])
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
   * The slots reuse whatever is available so a shop with one or two products
   * still gets a complete hero composition. With none at all every slot is
   * undefined and the hero renders its product-free layout — which is correct
   * for a catalogue that is genuinely empty.
   */
  const safe = products ?? []

  return {
    main: safe[0],
    secondary: safe[1] ?? safe[0],
    tertiary: safe[2] ?? safe[1] ?? safe[0],
    loading: products === null,
  }
}
