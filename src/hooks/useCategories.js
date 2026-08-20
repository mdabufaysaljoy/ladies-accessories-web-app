import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { CATEGORIES as FALLBACK } from '@/data/categories'

let cache = null
let inflight = null

/**
 * Categories are needed by the header, footer and shop filters at once, so the
 * result is memoised process-wide rather than refetched per component.
 */
export function useCategories() {
  const [categories, setCategories] = useState(cache ?? FALLBACK)

  useEffect(() => {
    if (cache) return
    inflight ??= api
      .get('/categories')
      .then((d) => {
        cache = d.categories?.length ? d.categories : FALLBACK
        return cache
      })
      .catch(() => {
        cache = FALLBACK
        return cache
      })
      .finally(() => {
        inflight = null
      })

    let alive = true
    inflight.then((c) => alive && setCategories(c))
    return () => {
      alive = false
    }
  }, [])

  return categories
}
