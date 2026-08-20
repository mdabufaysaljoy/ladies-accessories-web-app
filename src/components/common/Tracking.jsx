import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useSettings } from '@/context/SettingsContext'
import { initTracking, trackPageView } from '@/lib/tracking'

/**
 * Boots the marketing pixels once the admin's settings arrive, then reports a
 * PageView on every route change — a single-page app fires one real page load,
 * so without this the pixel only ever sees the landing route.
 *
 * Rendered inside the router and above the routes, so it is mounted for the
 * whole session and never remounts.
 */
export function Tracking() {
  const { analytics, loading } = useSettings()
  const { pathname, search } = useLocation()
  const started = useRef(false)

  useEffect(() => {
    if (loading || started.current) return
    // Nothing configured means nothing loaded — no third-party script at all.
    if (!analytics?.facebookPixelId && !analytics?.googleAnalyticsId && !analytics?.googleTagManagerId) {
      return
    }
    initTracking(analytics)
    started.current = true
    trackPageView(pathname + search)
    // `pathname`/`search` are read for the first view only; the effect below
    // owns every view after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, analytics])

  useEffect(() => {
    if (!started.current) return
    // The shop's own analytics already cover the admin panel; it is staff
    // traffic and would pollute the ad audiences.
    if (pathname.startsWith('/admin')) return
    trackPageView(pathname + search)
  }, [pathname, search])

  return null
}
