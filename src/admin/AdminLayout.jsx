import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { useAdminAuth } from './AdminAuth'
import { useSettings } from '@/context/SettingsContext'
import { adminApi } from '@/lib/api'
import { cx } from '@/utils/format'
import { Spinner } from './components/ui'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'grid', end: true, ability: 'orders' },
  { to: '/admin/orders', label: 'Orders', icon: 'bag', ability: 'orders', badge: 'pendingOrders' },
  { to: '/admin/products', label: 'Products', icon: 'sparkle', ability: 'products' },
  { to: '/admin/categories', label: 'Categories', icon: 'filter', ability: 'products' },
  { to: '/admin/inbox', label: 'Inbox', icon: 'whatsapp', ability: 'inbox', badge: 'unreadChats' },
  { to: '/admin/customers', label: 'Customers', icon: 'user', ability: 'customers' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'checkCircle', ability: 'products', badge: 'pendingReviews' },
  { to: '/admin/campaigns', label: 'Email', icon: 'mail', ability: 'campaigns' },
  { to: '/admin/coupons', label: 'Coupons', icon: 'gift', ability: 'coupons' },
  { to: '/admin/offers', label: 'Offers', icon: 'sparkle', ability: 'settings' },
  { to: '/admin/media', label: 'Media', icon: 'eye', ability: 'media' },
  { to: '/admin/settings', label: 'Settings', icon: 'lock', ability: 'settings' },
]

export function AdminLayout() {
  const { user, loading, logout, can } = useAdminAuth()
  const { brand } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState({})

  useEffect(() => {
    if (!loading && !user) navigate('/admin/login', { replace: true, state: { from: location.pathname } })
  }, [loading, user, navigate, location.pathname])

  // Sidebar badge counts, refreshed on navigation and every 45s.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      try {
        const [orders, chats, reviews] = await Promise.all([
          can('orders') ? adminApi.get('/orders?status=pending&limit=1') : null,
          can('inbox') ? adminApi.get('/inbox/conversations?limit=1') : null,
          can('products') ? adminApi.get('/reviews?status=pending&limit=1') : null,
        ])
        if (cancelled) return
        setCounts({
          pendingOrders: orders?.meta?.total ?? 0,
          unreadChats: Object.values(chats?.unreadByChannel ?? {}).reduce((a, b) => a + b, 0),
          pendingReviews: reviews?.pendingCount ?? 0,
        })
      } catch {
        /* badges are cosmetic */
      }
    }

    load()
    const id = setInterval(load, 45000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [user, can, location.pathname])

  useEffect(() => setOpen(false), [location.pathname])

  if (loading) return <Spinner className="min-h-dvh" />
  if (!user) return null

  const items = NAV.filter((item) => can(item.ability))

  return (
    <div className="min-h-dvh bg-sand/40">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/90 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-ink/60 hover:bg-ink/[0.06] lg:hidden"
          >
            <Icon name={open ? 'close' : 'menu'} size={19} />
          </button>

          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink font-display text-[0.9375rem] text-cream">
              {brand.logoMark || 'S'}
            </span>
            <span className="hidden sm:block">
              <span className="block text-[0.875rem] font-semibold leading-tight tracking-tight">{brand.name}</span>
              <span className="block text-[0.625rem] uppercase tracking-[0.14em] text-ink/40">Admin panel</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/"
              target="_blank"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[0.8125rem] text-ink/60 hover:bg-ink/[0.06] hover:text-ink sm:flex"
            >
              <Icon name="arrowUpRight" size={15} /> View store
            </Link>

            <div className="flex items-center gap-2.5 rounded-lg py-1 pl-2 pr-1">
              <span className="hidden text-right md:block">
                <span className="block text-[0.8125rem] font-medium leading-tight">{user.name}</span>
                <span className="block text-[0.6875rem] capitalize text-ink/45">{user.role}</span>
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blush font-display text-[0.875rem] text-plum">
                {user.name.charAt(0)}
              </span>
            </div>

            <button
              type="button"
              onClick={async () => {
                await logout()
                navigate('/admin/login', { replace: true })
              }}
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink/50 hover:bg-red-50 hover:text-red-600"
            >
              <Icon name="arrowUpRight" size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* sidebar */}
        <aside
          className={cx(
            'fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-ink/10 bg-white pt-14 transition-transform duration-300 lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100dvh-3.5rem)] lg:translate-x-0 lg:pt-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.875rem] transition-colors',
                    isActive ? 'bg-ink text-cream' : 'text-ink/65 hover:bg-sand hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={item.icon} size={17} className="shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {counts[item.badge] > 0 && (
                      <span
                        className={cx(
                          'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.6875rem] font-bold',
                          isActive ? 'bg-cream/20 text-cream' : 'bg-rose text-white',
                        )}
                      >
                        {counts[item.badge]}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}

            <div className="mt-auto rounded-xl bg-sand p-3.5">
              <p className="text-[0.75rem] font-medium">Signed in as {user.role}</p>
              <p className="mt-1 text-[0.6875rem] leading-snug text-ink/50">
                {user.role === 'owner'
                  ? 'You have full access to every section.'
                  : `Your role can manage: ${user.abilities.join(', ')}.`}
              </p>
            </div>
          </nav>
        </aside>

        {open && (
          <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
        )}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
