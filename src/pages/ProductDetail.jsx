import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProductArt } from '@/components/product/ProductArt'
import { ProductGrid } from '@/components/product/ProductGrid'
import { ColorPicker, QtyStepper, SizePicker } from '@/components/product/VariantPicker'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Rating } from '@/components/ui/Rating'
import { Accordion } from '@/components/ui/Accordion'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Section, SectionHeader } from '@/components/ui/Section'
import { usePageMeta } from '@/components/common/PageShell'
import { useProduct } from '@/hooks/useCatalog'
import { QuickOrder } from '@/components/common/QuickOrder'
import { useSettings } from '@/context/SettingsContext'
import { useCategories } from '@/hooks/useCategories'
import { TESTIMONIALS } from '@/data/content'
import { useStore } from '@/context/StoreContext'
import { cx, percentOff, taka } from '@/utils/format'
import NotFound from './NotFound'

/** Four framings of the same generated art, standing in for a photo gallery. */
const GALLERY_VIEWS = [
  { id: 'front', label: 'Front', decorative: true, transform: 'none' },
  { id: 'detail', label: 'Detail', decorative: false, transform: 'scale(1.9) translate(-6%, 4%)' },
  { id: 'styled', label: 'Styled', decorative: true, transform: 'scale(1.25) translate(9%, -5%)' },
  { id: 'packed', label: 'Packaging', decorative: false, transform: 'scale(0.82) rotate(-4deg)' },
]

function ratingBreakdown(product) {
  // Deterministic distribution weighted toward the product's actual rating.
  const total = product.reviews
  const weights = [0.02, 0.02, 0.05, 0.18, 0.73].map((w, i) => w * (1 + (i + 1 - product.rating) * -0.2))
  const sum = weights.reduce((a, b) => a + b, 0)
  return [5, 4, 3, 2, 1].map((stars, i) => {
    const w = weights[4 - i] / sum
    return { stars, count: Math.round(total * w), pct: Math.round(w * 100) }
  })
}

export default function ProductDetail() {
  const { slug } = useParams()
  const { product, related, loading } = useProduct(slug)
  const { zones, storefront, delivery } = useSettings()
  const categories = useCategories()
  const navigate = useNavigate()
  const { addToCart, toggleWishlist, inWishlist, trackView, recentProducts, toast } = useStore()

  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(1)
  const [view, setView] = useState('front')
  const [quickOpen, setQuickOpen] = useState(false)

  useEffect(() => {
    if (!product) return
    setColor(product.colors[0]?.name ?? '')
    setSize(product.sizes[0]?.label ?? '')
    setQty(1)
    setView('front')
    trackView(product.slug)
  }, [product, trackView])

  usePageMeta(product?.name, product?.short)

  const reviews = useMemo(
    () => (product ? TESTIMONIALS.filter((t) => t.product === product.name) : []),
    [product],
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-ink/15 border-t-plum" />
      </div>
    )
  }
  if (!product) return <NotFound />

  // A category can be renamed or removed in admin after a product references it.
  const category = categories.find((c) => c.slug === product.category) ?? {
    slug: product.category,
    name: product.category,
  }
  const sizeOption = product.sizes.find((s) => s.label === size)
  const unitPrice = product.price + (sizeOption?.priceDelta ?? 0)
  const discount = percentOff(product.price, product.compareAt)
  const saved = inWishlist(product.slug)
  const soldOut = product.stock === 0
  const activeView = GALLERY_VIEWS.find((v) => v.id === view) ?? GALLERY_VIEWS[0]
  const breakdown = ratingBreakdown(product)

  const variant = { qty, color: color || null, size: size || null }

  const add = () => addToCart(product, variant)

  const buyNow = () => {
    addToCart(product, { ...variant, silent: true })
    navigate('/checkout')
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: product.name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copied to clipboard', { kind: 'success' })
      }
    } catch {
      /* the user dismissed the share sheet — nothing to do */
    }
  }

  return (
    <>
      <div className="container-x pt-7">
        <Breadcrumb
          items={[
            { label: 'Shop', to: '/shop' },
            { label: category.name, to: `/shop/${category.slug}` },
            { label: product.name },
          ]}
        />
      </div>

      <div className="container-x py-8 md:py-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* gallery */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-sand">
              <div
                className="h-full w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ transform: activeView.transform }}
              >
                <ProductArt product={product} decorative={activeView.decorative} priority />
              </div>

              <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
                {product.badge && (
                  <span className="w-fit rounded-full bg-ink px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-cream">
                    {product.badge}
                  </span>
                )}
                {discount > 0 && (
                  <span className="w-fit rounded-full bg-plum px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-cream">
                    Save {discount}%
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={share}
                aria-label="Share this product"
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-cream/85 backdrop-blur-sm transition-colors hover:bg-cream"
              >
                <Icon name="arrowUpRight" size={18} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-3">
              {GALLERY_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  aria-label={`${v.label} view`}
                  aria-pressed={view === v.id}
                  className={cx(
                    'relative aspect-square overflow-hidden rounded-xl bg-sand transition-all duration-300',
                    view === v.id
                      ? 'ring-2 ring-ink ring-offset-2 ring-offset-cream'
                      : 'opacity-65 hover:opacity-100',
                  )}
                >
                  <div style={{ transform: v.transform }} className="h-full w-full">
                    <ProductArt product={product} decorative={v.decorative} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* buy box */}
          <div>
            <Link
              to={`/shop/${category.slug}?sub=${encodeURIComponent(product.subcategory)}`}
              className="eyebrow text-plum/70 hover:text-plum"
            >
              {product.subcategory}
            </Link>

            <h1 className="mt-3 text-[2.25rem] leading-[1.05] tracking-tight md:text-[2.75rem]">
              {product.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Rating value={product.rating} showValue />
              <a href="#reviews" className="text-[0.8125rem] text-ink/50 underline underline-offset-2">
                {product.reviews} reviews
              </a>
              <span
                className={cx(
                  'flex items-center gap-1.5 text-[0.8125rem] font-medium',
                  soldOut ? 'text-red-600' : product.stock <= 15 ? 'text-rose' : 'text-moss',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {soldOut ? 'Out of stock' : product.stock <= 15 ? `Only ${product.stock} left` : 'In stock'}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-[2.5rem] leading-none">{taka(unitPrice)}</span>
              {product.compareAt > product.price && (
                <>
                  <span className="text-lg text-ink/35 line-through">{taka(product.compareAt)}</span>
                  <span className="rounded-full bg-blush px-3 py-1 text-[0.75rem] font-semibold text-plum">
                    You save {taka(product.compareAt - product.price)}
                  </span>
                </>
              )}
            </div>

            <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink/70 text-balance-pretty">
              {product.short}
            </p>

            <div className="mt-8 space-y-6">
              <ColorPicker colors={product.colors} value={color} onChange={setColor} />
              <SizePicker
                sizes={product.sizes}
                value={size}
                onChange={setSize}
                basePrice={product.price}
              />

              <div>
                <p className="eyebrow text-ink/45">Quantity</p>
                <div className="mt-2.5 flex items-center gap-4">
                  <QtyStepper value={qty} onChange={setQty} max={Math.max(1, product.stock)} />
                  <p className="text-[0.875rem] text-ink/55">
                    Total <strong className="font-semibold text-ink">{taka(unitPrice * qty)}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-2.5">
              <div className="flex gap-2.5">
                <Button variant="outline" size="lg" className="flex-1" onClick={add} disabled={soldOut}>
                  <Icon name="bag" size={18} /> Add to bag
                </Button>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.slug)}
                  aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                  aria-pressed={saved}
                  className={cx(
                    'grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full border transition-all duration-300',
                    saved
                      ? 'border-rose bg-rose text-white'
                      : 'border-ink/20 text-ink hover:border-ink',
                  )}
                >
                  <Icon name="heart" size={20} fill={saved} />
                </button>
              </div>
              <Button size="lg" full onClick={buyNow} disabled={soldOut}>
                Buy it now
              </Button>
              {storefront.showQuickOrder !== false && (
                <Button
                  variant="outline"
                  size="lg"
                  full
                  onClick={() => setQuickOpen(true)}
                  disabled={soldOut}
                  className="border-moss text-moss hover:bg-moss hover:text-white"
                >
                  <Icon name="cash" size={18} /> Order now — pay on delivery
                </Button>
              )}
            </div>

            {/* delivery + payment reassurance */}
            <div className="mt-7 space-y-3 rounded-2xl bg-sand p-5">
              <p className="flex items-start gap-3 text-[0.875rem]">
                <Icon name="truck" size={18} className="mt-0.5 shrink-0 text-ink/45" />
                <span className="text-ink/70">
                  <strong className="font-semibold text-ink">Free delivery over {taka(delivery.freeShippingThreshold)}.</strong>{' '}
                  {zones[0]?.label}: {zones[0]?.eta} · {zones[zones.length - 1]?.label}:{' '}
                  {zones[zones.length - 1]?.eta}
                </span>
              </p>
              <p className="flex items-start gap-3 text-[0.875rem]">
                <Icon name="cash" size={18} className="mt-0.5 shrink-0 text-ink/45" />
                <span className="text-ink/70">
                  <strong className="font-semibold text-ink">Cash on delivery</strong> nationwide, or pay
                  with bKash, Nagad, Rocket or card via SSLCommerz.
                </span>
              </p>
              <p className="flex items-start gap-3 text-[0.875rem]">
                <Icon name="refresh" size={18} className="mt-0.5 shrink-0 text-ink/45" />
                <span className="text-ink/70">
                  <strong className="font-semibold text-ink">7-day returns</strong> on unopened items.{' '}
                  <Link to="/policy/returns" className="underline underline-offset-2">
                    Read the policy
                  </Link>
                </span>
              </p>
            </div>

            {/* details */}
            <Accordion
              className="mt-9"
              defaultOpen={0}
              items={[
                {
                  title: 'Description',
                  content: product.description,
                },
                {
                  title: 'Details & specification',
                  content: (
                    <ul className="space-y-2">
                      {product.details.map((d) => (
                        <li key={d} className="flex items-start gap-2.5">
                          <Icon name="check" size={15} className="mt-1 shrink-0 text-plum" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  ),
                },
                { title: 'How to use & care', content: product.care },
                {
                  title: 'Delivery & returns',
                  content: (
                    <ul className="space-y-2">
                      {zones.map((z) => (
                        <li key={z.id} className="flex justify-between gap-4">
                          <span>{z.label}</span>
                          <span className="shrink-0 text-ink/50">
                            {taka(z.charge)} · {z.eta}
                          </span>
                        </li>
                      ))}
                      <li className="pt-2 text-ink/60">
                        Free above {taka(delivery.freeShippingThreshold)}. Unopened returns accepted within {delivery.returnWindowDays} days.
                      </li>
                    </ul>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* reviews */}
      <Section id="reviews" className="bg-sand/50">
        <div className="container-x">
          <SectionHeader eyebrow="Customer reviews" title={`What people say about the ${product.name}`} />

          <div className="mt-10 grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-16">
            <div>
              <div className="rounded-[1.25rem] bg-cream p-7 text-center">
                <p className="font-display text-[3.5rem] leading-none">{product.rating.toFixed(1)}</p>
                <Rating value={product.rating} size={17} className="mt-3 justify-center" />
                <p className="mt-2.5 text-[0.8125rem] text-ink/50">
                  Based on {product.reviews} verified purchases
                </p>
              </div>

              <ul className="mt-6 space-y-2.5">
                {breakdown.map((row) => (
                  <li key={row.stars} className="flex items-center gap-3 text-[0.8125rem]">
                    <span className="w-8 shrink-0 text-ink/60">{row.stars}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                      <span
                        className="block h-full rounded-full bg-gold transition-[width] duration-700"
                        style={{ width: `${row.pct}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-ink/45">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {reviews.length > 0 ? (
                <ul className="space-y-5">
                  {reviews.map((r) => (
                    <li key={r.name} className="rounded-[1.25rem] bg-cream p-7">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-blush font-display text-plum">
                            {r.name.charAt(0)}
                          </span>
                          <div>
                            <p className="text-[0.9375rem] font-medium">{r.name}</p>
                            <p className="text-[0.75rem] text-ink/45">{r.location}</p>
                          </div>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-full bg-moss/10 px-3 py-1 text-[0.6875rem] font-medium text-moss">
                          <Icon name="checkCircle" size={13} /> Verified purchase
                        </span>
                      </div>
                      <Rating value={r.rating} size={15} className="mt-4" />
                      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink/70 text-balance-pretty">
                        {r.body}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-[1.25rem] bg-cream p-10 text-center">
                  <p className="font-display text-xl">No written reviews yet</p>
                  <p className="mt-2 text-[0.9375rem] text-ink/55">
                    This product has {product.reviews} star ratings. Be the first to write about it.
                  </p>
                </div>
              )}

              <div className="mt-6 rounded-[1.25rem] border border-dashed border-ink/20 p-7 text-center">
                <p className="text-[0.9375rem] font-medium">Bought this already?</p>
                <p className="mt-1.5 text-[0.875rem] text-ink/55">
                  Reviews open once your order is marked delivered.
                </p>
                <Button to="/track-order" variant="outline" size="sm" className="mt-4">
                  Find my order
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* related */}
      {related.length > 0 && (
        <Section>
          <div className="container-x">
            <SectionHeader
              eyebrow="You may also like"
              title={`More from ${category.name}`}
              action={`Shop all ${category.name}`}
              actionTo={`/shop/${category.slug}`}
            />
            <div className="mt-10">
              <ProductGrid products={related} />
            </div>
          </div>
        </Section>
      )}

      <QuickOrder
        product={product}
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        color={color || null}
        size={size || null}
        initialQty={qty}
      />

      {/* recently viewed */}
      {recentProducts.filter((p) => p.slug !== product.slug).length > 0 && (
        <Section className="border-t border-ink/8 pt-14">
          <div className="container-x">
            <SectionHeader eyebrow="Recently viewed" title="Pick up where you left off" />
            <div className="mt-10">
              <ProductGrid
                products={recentProducts.filter((p) => p.slug !== product.slug).slice(0, 4)}
                reveal={false}
              />
            </div>
          </div>
        </Section>
      )}
    </>
  )
}
