import { useCallback, useRef } from 'react'

/**
 * Adds `.is-visible` to every `.reveal` inside the returned ref once it scrolls
 * into view, with an optional stagger between siblings.
 *
 * Returns a *callback* ref rather than a ref object on purpose. Sections whose
 * content comes from the API render `null` on the first pass, so a plain
 * `useRef` + `useEffect` would find nothing, bail, and never run again — the
 * content would arrive and stay stuck at opacity 0. A callback ref fires
 * whenever the node actually mounts, and a MutationObserver then picks up any
 * `.reveal` children that appear later still.
 */
export function useReveal({ stagger = 70, threshold = 0.12 } = {}) {
  const cleanup = useRef(null)
  const opts = useRef({ stagger, threshold })
  opts.current = { stagger, threshold }

  const attach = useCallback((node) => {
    cleanup.current?.()
    cleanup.current = null
    if (!node) return

    const { stagger: gap, threshold: ratio } = opts.current

    if (!('IntersectionObserver' in window)) {
      node.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'))
      if (node.classList?.contains('reveal')) node.classList.add('is-visible')
      return
    }

    let shown = 0

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.style.transitionDelay = `${(shown++ % 8) * gap}ms`
          entry.target.classList.add('is-visible')
          io.unobserve(entry.target)
        })
      },
      { threshold: ratio, rootMargin: '0px 0px -8% 0px' },
    )

    /**
     * Tracked per setup rather than with a DOM marker. StrictMode calls a ref
     * callback node → null → node; a marker left on the element would survive
     * the teardown and make the second setup skip everything, leaving the whole
     * page stuck at opacity 0.
     */
    const bound = new WeakSet()

    const observe = (el) => {
      if (bound.has(el) || el.classList.contains('is-visible')) return
      bound.add(el)
      io.observe(el)
    }

    const scan = () => {
      if (node.classList?.contains('reveal')) observe(node)
      node.querySelectorAll('.reveal').forEach(observe)
    }

    scan()

    const mo = new MutationObserver(scan)
    mo.observe(node, { childList: true, subtree: true })

    cleanup.current = () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])

  // Teardown is handled by React calling this ref with `null` on unmount. A
  // separate unmount effect would be wrong here: StrictMode double-invokes
  // effects, so its cleanup would disconnect the observers right after mount
  // and the ref would never fire again to rebuild them.
  return attach
}
