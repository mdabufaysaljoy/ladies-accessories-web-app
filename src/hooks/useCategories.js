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

/**
 * Drops the memoised list so the next render refetches.
 *
 * The admin panel and the storefront are one app, so without this a category
 * added or deleted in the admin would not reach the header until a full page
 * reload — the cache that stops five components refetching also stops them
 * ever seeing the change.
 */
export function invalidateCategories() {
  cache = null
  inflight = null
}

/**
 * Just the categories the admin has put in the top navigation.
 *
 * Split out rather than folded into `useCategories`, whose return value is the
 * plain array three other screens already destructure as one.
 *
 * `!== false` rather than a truthiness check: categories created before the
 * flag existed have no `showInNav` at all, and those should keep appearing
 * rather than silently emptying the header on upgrade.
 */
export function useNavCategories() {
  return useCategories().filter((c) => c.showInNav !== false)
}
