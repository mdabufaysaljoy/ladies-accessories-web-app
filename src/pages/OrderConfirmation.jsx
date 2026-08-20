import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { Section, SectionHeader } from '@/components/ui/Section'
import { ProductGrid } from '@/components/product/ProductGrid'
import { EmptyState, usePageMeta } from '@/components/common/PageShell'
import { useWhatsAppLink } from '@/context/SettingsContext'
import { bestsellers } from '@/data/products'
import { useStore } from '@/context/StoreContext'
import { trackPurchase } from '@/lib/tracking'
import { cx, formatDate, taka } from '@/utils/format'

const TIMELINE = [
  { id: 'confirmed', label: 'Order confirmed', body: 'We have your order and it is queued for packing.' },
  { id: 'packed', label: 'Packed', body: 'Wrapped by hand and sealed with a tamper tag.' },
  { id: 'shipped', label: 'Handed to courier', body: 'You will get an SMS with the tracking number.' },
  { id: 'delivered', label: 'Delivered', body: 'Record an unboxing video in case anything is wrong.' },
]

function Confetti() {
  // Deterministic scatter so the burst does not reshuffle on re-render.
  const pieces = Array.from({ length: 26 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 9) * 0.14,
    hue: [340, 45, 265, 150][i % 4],
    size: 5 + (i % 4) * 2,
  }))

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.8,
            backgroundColor: `hsl(${p.hue} 55% 62%)`,
            animation: `confetti-fall ${2.2 + (i % 5) * 0.3}s ease-in ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}

export default function OrderConfirmation() {
  const { id } = useParams()
  const { orders } = useStore()
  const order = orders.find((o) => o.orderNumber === id) ?? null
  const waLink = useWhatsAppLink(order ? `Hi! I just placed order ${order.orderNumber}.` : undefined)

  usePageMeta(order ? `Order ${order.orderNumber}` : 'Order')

  /**
   * Browser-side Purchase. The server sends its own copy from the saved order;
   * both use the order number as the event id, so Meta keeps exactly one. The
   * ref stops a re-render (or React's StrictMode double-mount in dev) from
   * reporting the same sale twice.
   */
  const purchaseTracked = useRef(false)
  useEffect(() => {
    if (!order || purchaseTracked.current) return
    purchaseTracked.current = true
    trackPurchase(order)
  }, [order])

  if (!order) {
    return (
      <EmptyState
        icon="search"
        title="We could not find that order"
        body="Orders are stored on the device they were placed from. Try the tracking page, or message us on WhatsApp with your phone number."
        action="Track an order"
        actionTo="/track-order"
      />
    )
  }

  /** The invoice endpoint authorises on the order's own phone number. */
  const invoiceUrl = (mode) =>
    `/api/orders/${order.orderNumber}/invoice?phone=${encodeURIComponent(order.customer.phone)}${
      mode === 'print' ? '&print=1' : ''
    }`

  const paid = order.payment.status === 'paid'
  const advanceDue = order.payment.advanceAmount > 0
  const eta = new Date(order.createdAt)
  eta.setDate(eta.getDate() + (order.delivery.zoneId === 'dhaka-city' ? 2 : 4))

  return (
    <>
      <div className="relative overflow-hidden bg-blush">
        <Confetti />
        <div className="container-x relative py-14 text-center md:py-20">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-moss text-white">
            <Icon name="check" size={30} strokeWidth={2.5} />
          </span>
          <p className="eyebrow mt-6 text-plum/70">Order {order.orderNumber}</p>
          <h1 className="mt-3 text-[2.25rem] leading-[1.05] md:text-[3rem]">
            Thank you, {order.customer.name.split(' ')[0]}.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[1.0625rem] leading-relaxed text-ink/65 text-balance-pretty">
            Your order is confirmed. We will call {order.customer.phone} before dispatch, and send the
            courier tracking number by SMS.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/shop" size="lg">
              Continue shopping
            </Button>
            <Button
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="lg"
            >
              <Icon name="whatsapp" size={17} /> Message us about this order
            </Button>
          </div>
        </div>
      </div>

      <div className="container-x py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
          <div>
            {/* payment status */}
            <div
              className={cx(
                'flex flex-wrap items-center gap-4 rounded-2xl p-5',
                paid ? 'bg-moss/10' : 'bg-gold/12',
              )}
            >
              <Icon
                name={paid ? 'checkCircle' : 'cash'}
                size={26}
                className={cx('shrink-0', paid ? 'text-moss' : 'text-gold')}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold">
                  {paid
                    ? `Paid ${taka(order.totals.total)} via ${order.payment.channel}`
                    : `Cash on delivery — ${taka(order.totals.total)} due`}
                </p>
                <p className="mt-1 text-[0.8125rem] text-ink/60">
                  {paid
                    ? `Transaction verified · ${order.payment.transactionId ?? order.payment.validationId}`
                    : advanceDue
                      ? `We will send a bKash number for the ${taka(order.payment.advanceAmount)} advance. The rest is paid to the courier.`
                      : 'Please keep the exact amount ready — couriers often cannot give change.'}
                </p>
              </div>
            </div>

            {/* timeline */}
            <div className="mt-10">
              <h2 className="font-display text-xl">What happens next</h2>
              <ol className="mt-6">
                {TIMELINE.map((stage, i) => {
                  const active = i === 0
                  return (
                    <li key={stage.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={cx(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors',
                            active ? 'bg-moss text-white' : 'border border-ink/15 text-ink/30',
                          )}
                        >
                          {active ? (
                            <Icon name="check" size={16} strokeWidth={2.5} />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-current" />
                          )}
                        </span>
                        {i < TIMELINE.length - 1 && <span className="w-px flex-1 bg-ink/12" />}
                      </div>
                      <div className={cx('pb-8', i === TIMELINE.length - 1 && 'pb-0')}>
                        <p
                          className={cx(
                            'text-[0.9375rem] font-medium',
                            !active && 'text-ink/45',
                          )}
                        >
                          {stage.label}
                          {active && (
                            <span className="ml-2 rounded-full bg-moss/12 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-moss">
                              Now
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-[0.875rem] text-ink/55">{stage.body}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>

            {/* items */}
            <div className="mt-10 border-t border-ink/10 pt-9">
              <h2 className="font-display text-xl">Your items</h2>
              <ul className="mt-5 divide-y divide-ink/8">
                {order.lines.map((line, i) => (
                  <li key={i} className="flex items-center gap-4 py-4">
                    <Link
                      to={`/product/${line.slug}`}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand"
                    >
                      <ProductArt product={line} decorative={false} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/product/${line.slug}`}
                        className="text-[0.9375rem] font-medium hover:text-plum"
                      >
                        {line.name}
                      </Link>
                      <p className="mt-0.5 text-[0.8125rem] text-ink/50">
                        {[line.color, line.size, `Qty ${line.qty}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 text-[0.9375rem] font-medium">
                      {taka(line.price * line.qty)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* receipt */}
          <aside className="lg:sticky lg:top-36 lg:self-start">
            <div className="rounded-[1.5rem] bg-sand p-6">
              <h2 className="font-display text-xl">Receipt</h2>
              <dl className="mt-5 space-y-2.5 text-[0.875rem]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/55">Order number</dt>
                  <dd className="font-mono font-medium">{order.orderNumber}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/55">Placed</dt>
                  <dd>{formatDate(order.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/55">Estimated arrival</dt>
                  <dd className="font-medium">{formatDate(eta)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/55">Payment</dt>
                  <dd>{order.payment.method === 'cod' ? 'Cash on delivery' : 'SSLCommerz'}</dd>
                </div>
              </dl>

              <dl className="mt-5 space-y-2.5 border-t border-ink/12 pt-5 text-[0.875rem]">
                <div className="flex justify-between">
                  <dt className="text-ink/55">Subtotal</dt>
                  <dd>{taka(order.totals.subtotal)}</dd>
                </div>
                {order.totals.discount > 0 && (
                  <div className="flex justify-between text-moss">
                    <dt>Discount {order.coupon?.code && `(${order.coupon.code})`}</dt>
                    <dd>−{taka(order.totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink/55">Delivery</dt>
                  <dd>{order.totals.shipping === 0 ? 'Free' : taka(order.totals.shipping)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-ink/15 pt-3.5">
                  <dt className="font-display text-lg">Total</dt>
                  <dd className="font-display text-2xl">{taka(order.totals.total)}</dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-ink/12 pt-5">
                <p className="eyebrow text-ink/45">Delivering to</p>
                <address className="mt-2.5 text-[0.875rem] not-italic leading-relaxed text-ink/70">
                  <strong className="font-medium text-ink">{order.customer.name}</strong>
                  <br />
                  {order.customer.address}
                  <br />
                  {order.customer.area}, {order.customer.district}
                  <br />
                  {order.customer.phone}
                </address>
                {order.customer.giftNote && (
                  <p className="mt-3 rounded-xl bg-blush px-3.5 py-3 text-[0.8125rem] italic text-ink/70">
                    <Icon name="gift" size={14} className="mr-1.5 inline text-plum" />
                    “{order.customer.giftNote}”
                  </p>
                )}
              </div>

              {/*
                Opens the server-rendered invoice rather than printing this page.
                window.print() here would print the whole storefront — header,
                footer, newsletter and all — across half a dozen sheets.
              */}
              <Button
                href={invoiceUrl('print')}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="md"
                full
                className="mt-6"
              >
                <Icon name="eye" size={16} /> Print invoice
              </Button>
              <Button
                href={invoiceUrl()}
                target="_blank"
                rel="noopener noreferrer"
                variant="ghost"
                size="sm"
                full
                className="mt-2"
              >
                View invoice{order.invoice?.number ? ` · ${order.invoice.number}` : ''}
              </Button>
            </div>

            <p className="mt-5 px-2 text-[0.75rem] leading-relaxed text-ink/50">
              Keep this order number safe. Message it to us on WhatsApp at any time and we will tell you
              exactly where your parcel is.
            </p>
          </aside>
        </div>
      </div>

      <Section className="bg-sand/40">
        <div className="container-x">
          <SectionHeader
            eyebrow="While you wait"
            title="Others also bought"
            action="Shop all"
            actionTo="/shop"
          />
          <div className="mt-10">
            <ProductGrid
              products={bestsellers()
                .filter((p) => !order.lines.some((l) => l.slug === p.slug))
                .slice(0, 4)}
            />
          </div>
        </div>
      </Section>
    </>
  )
}
