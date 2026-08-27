import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CartLine } from '@/components/cart/CartLine'
import { FreeShippingBar } from '@/components/cart/FreeShippingBar'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Section, SectionHeader } from '@/components/ui/Section'
import { EmptyState, PageHeader, usePageMeta } from '@/components/common/PageShell'
import { COUPONS, DELIVERY_ZONES } from '@/data/content'
import { useBestsellers } from '@/hooks/useCatalog'
import { useStore } from '@/context/StoreContext'
import { cx, taka } from '@/utils/format'

function CouponBox() {
  const { coupon, applyCoupon, removeCoupon } = useStore()
  const [code, setCode] = useState('')
  const [open, setOpen] = useState(false)

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-moss/10 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon name="checkCircle" size={18} className="shrink-0 text-moss" />
          <div className="min-w-0">
            <p className="text-[0.875rem] font-semibold">{coupon.code}</p>
            <p className="truncate text-[0.75rem] text-ink/55">{coupon.label}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={removeCoupon}
          className="shrink-0 text-[0.75rem] font-medium text-ink/50 underline underline-offset-2 hover:text-ink"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-[0.875rem] font-medium"
      >
        <span className="flex items-center gap-2">
          <Icon name="sparkle" size={15} className="text-gold" fill />
          Have a discount code?
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={cx('text-ink/40 transition-transform duration-300', open && 'rotate-180')}
        />
      </button>

      <div
        className={cx(
          'grid transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
          open ? 'mt-3.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (applyCoupon(code)) setCode('')
            }}
            className="flex gap-2"
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              aria-label="Discount code"
              className="h-11 min-w-0 flex-1 rounded-full border border-ink/15 bg-cream px-4 text-[0.875rem] uppercase tracking-wide outline-none transition-colors focus:border-ink"
            />
            <Button type="submit" variant="outline" size="md">
              Apply
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {COUPONS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCode(c.code)}
                title={c.label}
                className="rounded-full border border-dashed border-ink/25 px-2.5 py-1 text-[0.6875rem] font-medium text-ink/60 transition-colors hover:border-plum hover:text-plum"
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Cart() {
  const { products: bestsellerProducts } = useBestsellers(8)
  const { lines, totals, zone, zoneId, setZoneId, clearCart } = useStore()
  usePageMeta('Your bag')

  if (lines.length === 0) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Your bag' }]} title="Your bag" tone="plain" />
        <EmptyState
          title="Nothing in your bag yet"
          body="Browse the collection and add a few things — cash on delivery means you can try without risk."
          action="Start shopping"
          actionTo="/shop"
        />
        <Section>
          <div className="container-x">
            <SectionHeader eyebrow="Start here" title="Our bestsellers" align="center" />
            <div className="mt-10">
              <ProductGrid products={bestsellerProducts.slice(0, 4)} />
            </div>
          </div>
        </Section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Your bag' }]}
        title="Your bag"
        lead={`${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'} ready to go.`}
        tone="plain"
      />

      <div className="container-x py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_23rem] lg:gap-14">
          <div>
            <FreeShippingBar subtotal={totals.subtotal} />

            <ul className="mt-2 divide-y divide-ink/10">
              {lines.map((line) => (
                <CartLine key={line.key} line={line} />
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-7">
              <Link
                to="/shop"
                className="group inline-flex items-center gap-2 text-[0.875rem] font-medium hover:text-plum"
              >
                <Icon
                  name="chevronLeft"
                  size={16}
                  className="transition-transform duration-300 group-hover:-translate-x-1"
                />
                Continue shopping
              </Link>
              <button
                type="button"
                onClick={clearCart}
                className="text-[0.8125rem] text-ink/45 underline underline-offset-2 hover:text-red-600"
              >
                Empty bag
              </button>
            </div>
          </div>

          {/* summary */}
          <aside className="lg:sticky lg:top-36 lg:self-start">
            <div className="rounded-[1.5rem] bg-sand p-6 md:p-7">
              <h2 className="font-display text-xl">Order summary</h2>

              <div className="mt-6">
                <label className="eyebrow text-ink/45" htmlFor="zone">
                  Delivery area
                </label>
                <select
                  id="zone"
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="mt-2.5 h-11 w-full cursor-pointer rounded-full border border-ink/15 bg-cream px-4 text-[0.875rem] outline-none transition-colors focus:border-ink"
                >
                  {DELIVERY_ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label} — {taka(z.charge)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-ink/50">
                  <Icon name="clock" size={13} /> Estimated {zone.eta}
                </p>
              </div>

              <div className="mt-6 border-t border-ink/10 pt-5">
                <CouponBox />
              </div>

              <dl className="mt-6 space-y-3 border-t border-ink/10 pt-5 text-[0.9375rem]">
                <div className="flex justify-between">
                  <dt className="text-ink/60">Subtotal</dt>
                  <dd className="font-medium">{taka(totals.subtotal)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-moss">
                    <dt>Coupon discount</dt>
                    <dd className="font-medium">−{taka(totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink/60">Delivery</dt>
                  <dd className="font-medium">
                    {totals.shipping === 0 ? <span className="text-moss">Free</span> : taka(totals.shipping)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-ink/15 pt-4">
                  <dt className="font-display text-xl">Total</dt>
                  <dd className="font-display text-[1.75rem]">{taka(totals.total)}</dd>
                </div>
                {totals.savings > 0 && (
                  <p className="rounded-xl bg-moss/10 px-3.5 py-2.5 text-[0.8125rem] font-medium text-moss">
                    You are saving {taka(totals.savings)} on this order
                  </p>
                )}
              </dl>

              <Button to="/checkout" size="lg" full className="mt-6">
                Proceed to checkout
                <Icon name="arrowRight" size={17} />
              </Button>

              <ul className="mt-5 space-y-2 text-[0.75rem] text-ink/55">
                <li className="flex items-center gap-2">
                  <Icon name="lock" size={13} className="shrink-0 text-ink/40" />
                  Secure SSLCommerz payment
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="cash" size={13} className="shrink-0 text-ink/40" />
                  Cash on delivery available nationwide
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="refresh" size={13} className="shrink-0 text-ink/40" />
                  7-day return on unopened items
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <Section className="bg-sand/40">
        <div className="container-x">
          <SectionHeader eyebrow="Frequently added together" title="Complete your order" />
          <div className="mt-10">
            <ProductGrid
              products={bestsellerProducts
                .filter((p) => !lines.some((l) => l.id === p.id))
                .slice(0, 4)}
            />
          </div>
        </div>
      </Section>
    </>
  )
}
