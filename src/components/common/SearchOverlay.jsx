import { useEffect, useRef, useState } from 'react'
import { trackSearch } from '@/lib/tracking'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { useProductSearch } from '@/hooks/useCatalog'
import { useCategories } from '@/hooks/useCategories'
import { useStore } from '@/context/StoreContext'
import { useEscape, useScrollLock } from '@/hooks/useScrollLock'
import { cx, taka } from '@/utils/format'

const POPULAR = ['Georgette hijab', 'Sunscreen', 'Matte lipstick', 'Hair oil', 'Attar', 'Gift set']

export function SearchOverlay() {
  const categories = useCategories()
  const { searchOpen, setSearchOpen } = useStore()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const close = () => setSearchOpen(false)
  useScrollLock(searchOpen)
  useEscape(searchOpen, close)

  const { results, search } = useProductSearch()

  /**
   * Debounced: the search now goes to the database instead of filtering a
   * bundled array, so firing on every keystroke would mean a request per
   * character typed.
   */
  useEffect(() => {
    const t = setTimeout(() => search(query), 180)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setCursor(0)
      // Wait for the transition so focus does not fight the scroll lock.
      const t = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [searchOpen])

  useEffect(() => setCursor(0), [query])

  /**
   * Search intent, reported once the shopper stops typing — firing per
   * keystroke would send "h", "hi", "hij" as three separate searches.
   */
  useEffect(() => {
    const term = query.trim()
    if (term.length < 3) return
    const t = setTimeout(() => trackSearch(term), 900)
    return () => clearTimeout(t)
  }, [query])

  // Open with ⌘K / Ctrl-K from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  const goTo = (path) => {
    close()
    navigate(path)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[cursor]) goTo(`/product/${results[cursor].slug}`)
      else if (query.trim()) goTo(`/shop?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-50 transition-opacity duration-300',
        searchOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]" onClick={close} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search products"
        className={cx(
          'relative mx-auto mt-[8vh] w-[min(46rem,92vw)] overflow-hidden rounded-[1.5rem] bg-cream shadow-pop',
          'transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
          searchOpen ? 'translate-y-0 scale-100' : '-translate-y-4 scale-[0.98]',
        )}
      >
        <div className="flex items-center gap-3 border-b border-ink/10 px-5">
          <Icon name="search" size={20} className="shrink-0 text-ink/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            type="search"
            placeholder="Search hijabs, serums, lipsticks…"
            aria-label="Search"
            className="h-16 flex-1 bg-transparent text-[1.0625rem] outline-none placeholder:text-ink/35"
          />
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-ink/12 px-2.5 py-1 text-[0.6875rem] font-medium text-ink/45"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto overscroll-contain p-4">
          {query.trim() === '' ? (
            <div className="space-y-6 p-2">
              <div>
                <p className="eyebrow text-ink/40">Popular searches</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {POPULAR.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="rounded-full border border-ink/12 px-3.5 py-1.5 text-[0.8125rem] transition-colors hover:border-ink hover:bg-ink hover:text-cream"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="eyebrow text-ink/40">Browse categories</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => goTo(`/shop/${cat.slug}`)}
                      className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3 text-left transition-colors hover:bg-blush"
                    >
                      <span>
                        <span className="block text-[0.9375rem] font-medium">{cat.name}</span>
                        <span className="block text-[0.75rem] text-ink/50">{cat.tagline}</span>
                      </span>
                      <Icon name="arrowRight" size={16} className="text-ink/35" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="font-display text-xl">No matches for “{query}”</p>
              <p className="mt-2 text-[0.875rem] text-ink/55">
                Try a fabric, a concern or a product type — “jersey”, “acne”, “kajal”.
              </p>
            </div>
          ) : (
            <ul>
              {results.map((product, i) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => goTo(`/product/${product.slug}`)}
                    className={cx(
                      'flex w-full items-center gap-4 rounded-2xl p-2.5 text-left transition-colors',
                      i === cursor ? 'bg-sand' : 'hover:bg-sand/60',
                    )}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand">
                      <ProductArt product={product} decorative={false} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem] font-medium">{product.name}</p>
                      <p className="truncate text-[0.75rem] text-ink/50">{product.subcategory}</p>
                    </div>
                    <span className="shrink-0 text-[0.875rem] font-semibold">{taka(product.price)}</span>
                  </button>
                </li>
              ))}
              <li className="px-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => goTo(`/shop?q=${encodeURIComponent(query.trim())}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-[0.875rem] font-medium text-cream transition-colors hover:bg-plum"
                >
                  See all results for “{query}” <Icon name="arrowRight" size={16} />
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
