import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Rating } from '@/components/ui/Rating'
import { ProductArt } from '@/components/product/ProductArt'
import { useReveal } from '@/hooks/useReveal'
import { useHeroProducts } from '@/hooks/useHeroProducts'
import { useSettings } from '@/context/SettingsContext'
import { taka } from '@/utils/format'

/** Shown only until the shop has entered its own numbers in Settings. */
const FALLBACK_STATS = [
  { value: '12,000+', label: 'Orders delivered' },
  { value: '4.9 / 5', label: 'Average rating' },
  { value: '64', label: 'Districts served' },
]

export function Hero() {
  const ref = useReveal({ stagger: 110 })
  const { storefront, tf } = useSettings()

  // Every word and every product here is set in Settings → Storefront.
  const { main: featured, secondary, tertiary } = useHeroProducts(storefront.heroProducts)
  const stats = storefront.stats?.length ? storefront.stats : FALLBACK_STATS

  return (
    <section ref={ref} className="relative overflow-hidden bg-blush">
      {/* ambient wash */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-rose-soft/35 blur-3xl" />
        <div className="absolute -bottom-48 right-0 h-[34rem] w-[34rem] rounded-full bg-gold-soft/30 blur-3xl" />
      </div>

      <div className="container-x relative">
        <div className="grid items-center gap-14 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-24">
          {/* copy */}
          <div className="max-w-xl">
            <p className="reveal inline-flex items-center gap-2 rounded-full border border-ink/12 bg-cream/70 px-4 py-1.5 text-[0.75rem] font-medium backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose" />
              </span>
              {storefront.heroBadge || 'New season hijabs just landed'}
            </p>

            <h1 className="reveal mt-6 text-[2.75rem] leading-[0.98] tracking-[-0.03em] sm:text-[3.5rem] lg:text-[4.25rem] text-balance-pretty">
              {tf(storefront, 'heroHeadline')}
            </h1>

            <p className="reveal mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-ink/65 text-balance-pretty">
              {tf(storefront, 'heroSubtext')}
            </p>

            <div className="reveal mt-9 flex flex-wrap items-center gap-3">
              <Button to={storefront.heroCtaHref || '/shop'} size="lg">
                {storefront.heroCtaLabel || 'Shop the collection'}
                <Icon name="arrowRight" size={18} />
              </Button>
              <Button to="/shop/hijabs" variant="outline" size="lg">
                Explore hijabs
              </Button>
            </div>

            <div className="reveal mt-10 flex flex-wrap items-center gap-x-9 gap-y-5">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="font-display text-2xl tracking-tight">{s.value}</p>
                  <p className="mt-0.5 text-[0.75rem] text-ink/50">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Composed product stack — only when the shop has something to put
              in it. A brand-new or emptied catalogue renders the copy and the
              call to action alone rather than crashing on an absent product. */}
          {featured && (
          <div className="relative">
            <div className="reveal relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] shadow-pop">
              <ProductArt product={featured} priority />
              <Link
                to={`/product/${featured.slug}`}
                className="group absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl bg-cream/85 p-3 backdrop-blur-md transition-colors hover:bg-cream"
              >
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-ink/40">{featured.badge || 'Featured'}</p>
                  <p className="mt-1 truncate text-[0.9375rem] font-medium">{featured.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[0.875rem] font-semibold">{taka(featured.price)}</span>
                    {/* A product with no sale price would otherwise show "৳0" struck through. */}
                    {featured.compareAt > featured.price && (
                      <span className="text-[0.75rem] text-ink/35 line-through">
                        {taka(featured.compareAt)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-cream transition-transform duration-300 group-hover:rotate-45">
                  <Icon name="arrowUpRight" size={18} />
                </span>
              </Link>
            </div>

            {/* floating satellites */}
            {secondary && (
            <Link
              to={`/product/${secondary.slug}`}
              className="reveal absolute -left-2 top-8 hidden w-40 animate-[float_8s_ease-in-out_infinite] overflow-hidden rounded-2xl bg-cream p-2.5 shadow-lift transition-transform duration-300 hover:scale-105 lg:block xl:-left-12"
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-sand">
                <ProductArt product={secondary} decorative={false} />
              </div>
              <p className="mt-2 truncate px-1 text-[0.75rem] font-medium">{secondary.name}</p>
              <p className="px-1 pb-1 text-[0.75rem] text-ink/50">{taka(secondary.price)}</p>
            </Link>
            )}

            <div className="reveal absolute -bottom-4 -right-1 hidden w-48 animate-[float_9s_ease-in-out_1.5s_infinite] rounded-2xl bg-cream p-4 shadow-lift lg:block xl:-right-10">
              <Rating value={5} size={13} />
              <p className="mt-2 text-[0.8125rem] leading-snug text-ink/70">
                “Does not slip, colour never faded. I ordered four more.”
              </p>
              <p className="mt-2 text-[0.6875rem] text-ink/45">Nusrat J. · Dhanmondi</p>
            </div>

            {tertiary && (
            <Link
              to={`/product/${tertiary.slug}`}
              aria-label={tertiary.name}
              title={tertiary.name}
              className="reveal absolute -left-4 bottom-16 hidden h-20 w-20 animate-[float_7s_ease-in-out_0.8s_infinite] overflow-hidden rounded-2xl shadow-lift transition-transform duration-300 hover:scale-105 xl:block"
            >
              <ProductArt product={tertiary} decorative={false} />
            </Link>
            )}
          </div>
          )}
        </div>
      </div>
    </section>
  )
}
