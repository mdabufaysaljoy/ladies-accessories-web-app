import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { AnnouncementBar } from './AnnouncementBar'
import { MobileMenu } from './MobileMenu'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { useNavItems } from '@/hooks/useNavigation'
import { bestsellers } from '@/data/products'
import { useWhatsAppLink } from '@/context/SettingsContext'
import { useAccount } from '@/context/AccountContext'
import { useStore } from '@/context/StoreContext'
import { cx, taka } from '@/utils/format'

function MegaMenu({ onNavigate }) {
  const navItems = useNavItems()

  const featured = bestsellers().slice(0, 2)

  return (
    <div
      className={cx(
        'invisible absolute left-0 right-0 top-full z-40 opacity-0 transition-all duration-300',
        'group-hover/shop:visible group-hover/shop:opacity-100 focus-within:visible focus-within:opacity-100',
      )}
    >
      <div className="mx-auto mt-0 max-w-7xl px-6 pt-3">
        <div className="overflow-hidden rounded-[1.5rem] border border-ink/8 bg-cream shadow-pop">
          <div className="grid grid-cols-[1fr_auto] gap-8 p-8">
            <div className="grid gap-7" style={{ gridTemplateColumns: `repeat(${Math.min(navItems.length || 1, 5)}, minmax(0, 1fr))` }}>
              {navItems.map((cat) => (
                <div key={cat.key}>
                  <Link
                    to={cat.to}
                    onClick={onNavigate}
                    className="link-underline font-display text-[1.0625rem] tracking-tight hover:text-plum"
                  >
                    {cat.label}
                  </Link>
                  <ul className="mt-3 space-y-2">
                    {cat.subcategories.map((sub) => (
                      <li key={sub.label}>
                        <Link
                          to={sub.to}
                          onClick={onNavigate}
                          className="text-[0.8125rem] text-ink/55 transition-colors hover:text-plum"
                        >
                          {sub.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="w-[19rem] shrink-0 border-l border-ink/8 pl-8">
              <p className="eyebrow text-ink/40">Loved right now</p>
              <div className="mt-4 space-y-3">
                {featured.map((p) => (
                  <Link
                    key={p.id}
                    to={`/product/${p.slug}`}
                    onClick={onNavigate}
                    className="group/f flex items-center gap-3.5 rounded-2xl p-2 transition-colors hover:bg-sand"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand">
                      <ProductArt product={p} decorative={false} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[0.875rem] font-medium group-hover/f:text-plum">
                        {p.name}
                      </p>
                      <p className="text-[0.8125rem] text-ink/50">{taka(p.price)}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                to="/shop?filter=sale"
                onClick={onNavigate}
                className="mt-4 flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-cream transition-colors hover:bg-plum"
              >
                <span className="text-[0.8125rem] font-medium">Shop the sale — up to 30% off</span>
                <Icon name="arrowRight" size={17} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Header() {
  const navItems = useNavItems()
  const waLink = useWhatsAppLink()
  const { isSignedIn } = useAccount()
  const { totals, wishlist, setCartOpen, setSearchOpen } = useStore()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-cream"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40">
        <AnnouncementBar />

        <div
          className={cx(
            'border-b transition-all duration-400',
            scrolled
              ? 'border-ink/8 bg-cream/85 backdrop-blur-xl supports-[backdrop-filter]:bg-cream/70'
              : 'border-transparent bg-cream',
          )}
        >
          <div className="container-x">
            <div
              className={cx(
                'flex items-center justify-between gap-4 transition-all duration-400',
                scrolled ? 'h-[4.25rem]' : 'h-[5.25rem]',
              )}
            >
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Open menu"
                  className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]"
                >
                  <Icon name="menu" size={21} />
                </button>
              </div>

              <Logo className="lg:mr-2" />

              <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
                <div className="group/shop static">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 py-7 text-[0.875rem] font-medium tracking-tight transition-colors hover:text-plum"
                  >
                    Shop
                    <Icon
                      name="chevronDown"
                      size={15}
                      className="transition-transform duration-300 group-hover/shop:rotate-180"
                    />
                  </button>
                  <MegaMenu />
                </div>

                {navItems.map((item) => (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    className={({ isActive }) =>
                      cx(
                        'link-underline text-[0.875rem] font-medium tracking-tight transition-colors hover:text-plum',
                        isActive && 'text-plum',
                      )
                    }
                    data-active={location.pathname === `/shop/${item.key}`}
                  >
                    {item.label}
                  </NavLink>
                ))}

                <NavLink
                  to="/shop?filter=sale"
                  className="link-underline text-[0.875rem] font-medium tracking-tight text-rose transition-colors hover:text-plum"
                >
                  Offers
                </NavLink>

                {/* Guests order without an account, so tracking has to be
                    reachable without one too — not buried in the footer. */}
                <NavLink
                  to="/track-order"
                  className="link-underline flex items-center gap-1.5 text-[0.875rem] font-medium tracking-tight transition-colors hover:text-plum"
                >
                  <Icon name="truck" size={15} />
                  Track order
                </NavLink>
              </nav>

              <div className="flex items-center gap-0.5">
                <LanguageToggle className="mr-1.5 hidden sm:flex" />

                <Link
                  to={isSignedIn ? '/account' : '/login'}
                  aria-label={isSignedIn ? 'My account' : 'Sign in'}
                  className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]"
                >
                  <Icon name="user" size={19} />
                  {isSignedIn && (
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-moss ring-2 ring-cream" />
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search products"
                  className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]"
                >
                  <Icon name="search" size={19} />
                </button>

                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat on WhatsApp"
                  className="hidden h-10 w-10 place-items-center rounded-full transition-colors hover:bg-ink/[0.06] md:grid"
                >
                  <Icon name="whatsapp" size={19} />
                </a>

                <Link
                  to="/wishlist"
                  aria-label={`Wishlist, ${wishlist.length} items`}
                  className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]"
                >
                  <Icon name="heart" size={19} />
                  {wishlist.length > 0 && (
                    <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[0.5625rem] font-bold text-white">
                      {wishlist.length}
                    </span>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  aria-label={`Shopping bag, ${totals.itemCount} items`}
                  className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]"
                >
                  <Icon name="bag" size={19} />
                  {totals.itemCount > 0 && (
                    <span className="absolute right-0.5 top-1 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-ink px-1 text-[0.5625rem] font-bold text-cream">
                      {totals.itemCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}

