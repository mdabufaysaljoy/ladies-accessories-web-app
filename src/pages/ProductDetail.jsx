import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProductGallery } from '@/components/product/ProductGallery'
import { ProductGrid } from '@/components/product/ProductGrid'
import { ColorPicker, QtyStepper, SizePicker } from '@/components/product/VariantPicker'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Rating } from '@/components/ui/Rating'
import { ReviewSummary, ReviewList } from '@/components/review/ReviewList'
import { ReviewForm } from '@/components/review/ReviewForm'
import { Accordion } from '@/components/ui/Accordion'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Section, SectionHeader } from '@/components/ui/Section'
import { usePageMeta } from '@/components/common/PageShell'
import { useProduct } from '@/hooks/useCatalog'
import { useReviews } from '@/hooks/useReviews'
import { QuickOrder } from '@/components/common/QuickOrder'
import { useSettings } from '@/context/SettingsContext'
import { useCategories } from '@/hooks/useCategories'
import { useStore } from '@/context/StoreContext'
import { trackProductView } from '@/lib/tracking'
import { cx, percentOff, taka } from '@/utils/format'
import NotFound from './NotFound'

/**
 * The top pair (Add to bag / Buy it now) sits two-up on every screen, so the
 * `lg` size's wide padding has to give. Both labels are short enough to stay
 * on one line once the padding shrinks — the longer actions below get a full
 * row each rather than wrapping mid-phrase.
 */
const PAIRED = 'flex-1 basis-0 min-w-0 px-3 text-[0.875rem] sm:px-5 sm:text-[0.9375rem]'

export default function ProductDetail() {
  const { slug } = useParams()
  const { product, related, loading } = useProduct(slug)
  const { zones, storefront, delivery, contact, productPage } = useSettings()
  const categories = useCategories()
  const navigate = useNavigate()
  const { addToCart, toggleWishlist, inWishlist, trackView, recentProducts, toast } = useStore()

  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(1)
  const [quickOpen, setQuickOpen] = useState(false)

  useEffect(() => {
    if (!product) return
    setColor(product.colors[0]?.name ?? '')
    setSize(product.sizes[0]?.label ?? '')
    setQty(1)
    trackView(product.slug)
    trackProductView(product)
  }, [product, trackView])

  usePageMeta(product?.name, product?.short)

  /**
   * Real, moderated reviews — and whether this shopper may add one. The rule
   * (delivered order, one review each) is enforced server-side; the page only
   * renders the answer.
   */
  const { reviews, summary, eligibility, refresh: refreshReviews } = useReviews(slug)

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

  /**
   * The admin writes these rows as plain text with a few placeholders, so the
   * delivery numbers stay tied to the delivery settings instead of being
   * copied by hand and going stale. `{freeShipping}` deliberately renders as
   * plain "Free delivery" when no threshold is set — "over ৳0" is nonsense.
   */
  const assuranceRows = (productPage.assurances ?? [])
    .filter((row) => row?.enabled !== false && (row?.title || row?.body))
    .map((row) => {
      const zoneSummary = zones.length
        ? `${zones[0]?.label}: ${zones[0]?.eta} · ${zones[zones.length - 1]?.label}: ${zones[zones.length - 1]?.eta}`
        : ''
      const threshold = Number(delivery.freeShippingThreshold) || 0
      const fill = (text = '') =>
        String(text)
          .replace(/\{freeShipping\}/g, threshold > 0 ? taka(threshold) : '')
          .replace(/\{deliveryZones\}/g, zoneSummary)
          .replace(/\{returnDays\}/g, String(delivery.returnWindowDays ?? 7))
          // A removed placeholder can leave "over ." or a double space behind.
          .replace(/\s+over\s*\./gi, '.')
          .replace(/\s{2,}/g, ' ')
          .trim()

      return { ...row, title: fill(row.title), body: fill(row.body) }
    })

  const specRows = (product.specifications ?? []).filter((sp) => sp?.label && sp?.value)

  const variant = { qty, color: color || null, size: size || null }

  const add = () => addToCart(product, variant)

  const buyNow = () => {
    addToCart(product, { ...variant, silent: true })
    navigate('/checkout')
  }

  // "Ask about this product" — opens WhatsApp with the product already
  // described, so Sadia does not have to ask which item they mean.
  const askOnWhatsApp = () => {
    const url = typeof window === 'undefined' ? '' : window.location.href
    const lines = [
      `Assalamu alaikum! I would like to know more about this product:`,
      '',
      `*${product.name}*`,
      `Price: ${taka(unitPrice)}`,
      color && `Colour: ${color}`,
      size && `Size: ${size}`,
      qty > 1 && `Quantity: ${qty}`,
      '',
      url,
    ].filter(Boolean)
    const number = String(contact.whatsapp ?? '').replace(/\D/g, '')
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`,
      '_blank',
      'noopener,noreferrer',
    )
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
            <ProductGallery product={product}>
              <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
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
                className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-cream/85 backdrop-blur-sm transition-colors hover:bg-cream"
              >
                <Icon name="arrowUpRight" size={18} />
              </button>
            </ProductGallery>
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

            <div className="mt-8 space-y-2.5">
              <div className="flex gap-2.5">
                <Button variant="outline" size="lg" className={PAIRED} onClick={add} disabled={soldOut}>
                  <Icon name="bag" size={18} /> Add to bag
                </Button>
                <Button size="lg" className={PAIRED} onClick={buyNow} disabled={soldOut}>
                  Buy it now
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

              {storefront.showQuickOrder !== false && (
                <Button
                  variant="outline"
                  size="lg"
                  full
                  onClick={() => setQuickOpen(true)}
                  disabled={soldOut}
                  className="border-moss text-moss hover:bg-moss hover:text-white"
                >
                  <Icon name="cash" size={18} className="shrink-0" /> Order now — pay on delivery
                </Button>
              )}

              <Button
                variant="outline"
                size="lg"
                full
                onClick={askOnWhatsApp}
                className="border-[#25D366] text-[#128C4A] hover:bg-[#25D366] hover:text-white"
              >
                <Icon name="whatsapp" size={18} className="shrink-0" /> Ask about this product
              </Button>
            </div>

            {/* Delivery and payment reassurance — every row editable and
                switchable from Settings → Storefront → Product page. */}
            {productPage.showAssurances !== false && assuranceRows.length > 0 && (
              <div className="mt-7 space-y-3 rounded-2xl bg-sand p-5">
                {assuranceRows.map((row, i) => (
                  <p key={i} className="flex items-start gap-3 text-[0.875rem]">
                    <Icon name={row.icon || 'checkCircle'} size={18} className="mt-0.5 shrink-0 text-ink/45" />
                    <span className="text-ink/70">
                      {row.title && (
                        <strong className="font-semibold text-ink">{row.title}</strong>
                      )}
                      {row.title && row.body ? ' ' : ''}
                      {row.body}
                      {row.link && row.linkLabel && (
                        <>
                          {' '}
                          <Link to={row.link} className="underline underline-offset-2">
                            {row.linkLabel}
                          </Link>
                        </>
                      )}
                    </span>
                  </p>
                ))}
              </div>
            )}

            {/* details — description and specification stay open: this is the
                copy that decides the sale, so it should never need a click */}
            <div className="mt-9 border-t border-ink/10 pt-7">
              <h2 className="font-display text-[1.375rem] tracking-tight">Description</h2>
              <div className="mt-3 text-[0.9375rem] leading-relaxed text-ink/70 text-balance-pretty">
                {product.description}
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-ink/10 p-6">
              <h2 className="font-display text-[1.375rem] tracking-tight">Details & specification</h2>
              <ul className="mt-4 space-y-2.5 text-[0.9375rem] leading-relaxed text-ink/70">
                {product.details.map((d) => (
                  <li key={d} className="flex items-start gap-2.5">
                    <Icon name="check" size={15} className="mt-1 shrink-0 text-plum" />
                    {d}
                  </li>
                ))}
              </ul>

              {/* The key/value specs entered in the admin editor. They were
                  being stored and never shown anywhere before. */}
              {productPage.showSpecifications !== false && specRows.length > 0 && (
                <div className="mt-6 border-t border-ink/10 pt-5">
                  <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink/45">
                    {productPage.specificationsTitle || 'Specifications'}
                  </h3>

                  {/* A table on its own scroll track, so a long value cannot
                      push the whole page sideways on a phone. */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-[0.9375rem]">
                      <tbody>
                        {specRows.map((spec, i) => (
                          <tr
                            key={`${spec.label}-${i}`}
                            className="border-b border-ink/8 last:border-0 even:bg-sand/40"
                          >
                            <th
                              scope="row"
                              className="w-[42%] py-2.5 pr-4 text-left align-top font-medium text-ink/60"
                            >
                              {spec.label}
                            </th>
                            <td className="py-2.5 align-top text-ink/80">{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <Accordion
              className="mt-7"
              items={[
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
          <SectionHeader
            eyebrow="Customer reviews"
            title={`What people say about the ${product.name}`}
          />

          <div className="mt-10 grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-16">
            <ReviewSummary summary={summary} />

            <div>
              <ReviewList
                reviews={reviews}
                empty={{
                  title: 'No reviews yet',
                  body: 'Be the first to write about this one.',
                }}
              />

              <div className="mt-6">
                <ReviewForm
                  productSlug={product.slug}
                  productName={product.name}
                  eligibility={eligibility}
                  onSubmitted={refreshReviews}
                />
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
