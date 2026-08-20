import { useCallback, useEffect, useState } from 'react'
import { api, customerApi } from '@/lib/api'
import { useAccount } from '@/context/AccountContext'

/**
 * Published reviews plus this shopper's right to add one.
 *
 * Pass a `slug` for a product's reviews, or nothing for reviews of the shop
 * itself. Eligibility is always asked of the server rather than worked out
 * here — the rule (delivered order, no duplicate) belongs in one place, and
 * the client cannot be trusted with it anyway.
 */
export function useReviews(slug) {
  const { isSignedIn } = useAccount()
  const [data, setData] = useState(null)
  const [eligibility, setEligibility] = useState(null)
  const [loading, setLoading] = useState(true)

  const path = slug ? `/reviews/product/${slug}` : '/reviews/shop'

  const load = useCallback(async () => {
    try {
      const res = await api.get(path)
      setData(res)
    } catch {
      setData({ reviews: [], summary: null })
    } finally {
      setLoading(false)
    }
  }, [path])

  const loadEligibility = useCallback(async () => {
    try {
      // Sent with the customer's token so the server knows who is asking.
      const res = await customerApi.get(`/reviews/eligibility${slug ? `?slug=${encodeURIComponent(slug)}` : ''}`)
      setEligibility(res)
    } catch {
      setEligibility({ canReview: false, reason: 'signed-out' })
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  // Re-asked on sign-in/out, so the form appears without a page refresh.
  useEffect(() => {
    loadEligibility()
  }, [loadEligibility, isSignedIn])

  const refresh = useCallback(() => {
    load()
    loadEligibility()
  }, [load, loadEligibility])

  return {
    reviews: data?.reviews ?? [],
    summary: data?.summary ?? null,
    eligibility,
    loading,
    refresh,
  }
}
