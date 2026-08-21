import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useWhatsAppLink } from '@/context/SettingsContext'
import { useAccount } from '@/context/AccountContext'
import { useStore } from '@/context/StoreContext'
import { api, API_BASE } from '@/lib/api'
import { cx, formatDate, taka } from '@/utils/format'

/** The happy path, in order. A cancelled/returned order leaves this track. */
const FLOW = [
  { id: 'pending', label: 'Order placed', body: 'We have your order and will call to confirm.' },
  { id: 'confirmed', label: 'Confirmed', body: 'Confirmed with you and queued for packing.' },
  { id: 'packed', label: 'Packed', body: 'Wrapped by hand and sealed with a tamper tag.' },
  { id: 'shipped', label: 'With the courier', body: 'On its way to you.' },
  { id: 'delivered', label: 'Delivered', body: 'Enjoy! Keep the invoice for returns.' },
]

const STATUS_TONE = {
  pending: 'bg-gold/15 text-gold',
  confirmed: 'bg-blush text-plum',
  packed: 'bg-purple-100 text-purple-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-moss/12 text-moss',
  cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-red-100 text-red-700',
}

const inputClass =
  'h-[3.25rem] w-full rounded-full border border-ink/15 bg-cream px-5 text-[0.9375rem] outline-none transition-colors focus:border-ink'

export default function TrackOrder() {
  const [params, setParams] = useSearchParams()
  const waLink = useWhatsAppLink('Hi! Can you check the status of my order? My number is ')
  const { orders } = useStore()
  const { isSignedIn, customer } = useAccount()

  const [code, setCode] = useState(params.get('order')?.toUpperCase() ?? '')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState(undefined) // undefined = not searched yet
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  usePageMeta(
    'Track your order',
    'Track any Goods by Sadia order with your order number and mobile number — no account needed.',
  )

  /**
   * Looks the order up on the server, so it works from any device and without
   * an account. The phone number is required because order numbers are
   * guessable — it is what stops anyone reading someone else's order.
   */
  const lookup = useCallback(async (orderNumber, mobile) => {
    setError('')
    setBusy(true)
    try {
      const { order } = await api.get(
        `/couriers/track/${encodeURIComponent(orderNumber.trim())}?phone=${encodeURIComponent(mobile.trim())}`,
      )
      setResult(order)
      return true
    } catch (err) {
      setResult(null)
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const submit = (e) => {
    e.preventDefault()
    setParams(code ? { order: code } : {}, { replace: true })
    lookup(code, phone)
  }

  /**
   * A signed-in customer arriving from their order list already proved who they
   * are, so fill in their number and run the lookup rather than making them
   * retype it.
   */
  useEffect(() => {
    const preset = params.get('order')
    if (!preset || !isSignedIn || !customer?.phone || result !== undefined) return
    const local = customer.phone.replace(/^88/, '')
    setPhone(local)
    lookup(preset, local)
  }, [params, isSignedIn, customer?.phone, result, lookup])

  const stageIndex = result ? FLOW.findIndex((s) => s.id === result.status) : -1
  const isClosed = result && ['cancelled', 'returned'].includes(result.status)

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Track order' }]}
        eyebrow="Order status"
        title="Where is my parcel?"
        lead="Enter your order number and the mobile number you ordered with. No account needed — this works for guest orders too."
      />

      <div className="container-x py-12 md:py-16">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={submit} className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GBS-XXXXXX00"
                aria-label="Order number"
                required
                className={cx(inputClass, 'font-mono uppercase')}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                aria-label="Mobile number used to order"
                inputMode="tel"
                required
                className={inputClass}
              />
              <Button type="submit" size="lg" loading={busy}>
                <Icon name="search" size={17} /> Track
              </Button>
            </div>
            <p className="px-2 text-[0.75rem] text-ink/45">
              Your order number is on the confirmation page and in your SMS. The mobile number keeps
              your order private.
            </p>
          </form>

          {/* not found */}
          {result === null && (
            <div className="mt-6 rounded-2xl bg-blush p-6 text-center">
              <p className="font-display text-lg">{error || 'No order found'}</p>
              <p className="mx-auto mt-2 max-w-md text-[0.875rem] leading-relaxed text-ink/60">
                Check that the order number and mobile number match exactly what you used when
                ordering. Still stuck? Message us and we will look it up for you.
              </p>
              <Button href={waLink} target="_blank" rel="noopener noreferrer" size="sm" className="mt-4">
                <Icon name="whatsapp" size={15} /> Ask on WhatsApp
              </Button>
            </div>
          )}

          {/* result */}
          {result && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-ink/12">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-sand px-6 py-4">
                <div>
                  <p className="font-mono text-[0.9375rem] font-semibold">{result.orderNumber}</p>
                  <p className="text-[0.75rem] text-ink/50">
                    Placed {formatDate(result.createdAt)}
                    {result.invoice?.number && ` · ${result.invoice.number}`}
                  </p>
                </div>
                <span
                  className={cx(
                    'rounded-full px-3 py-1.5 text-[0.75rem] font-semibold capitalize',
                    STATUS_TONE[result.status] ?? 'bg-ink/8 text-ink/70',
                  )}
                >
                  {result.status}
                </span>
              </div>

              <div className="px-6 py-5">
                {/* progress */}
                {isClosed ? (
                  <div className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3.5">
                    <Icon name="alert" size={18} className="shrink-0 text-red-600" />
                    <p className="text-[0.875rem] capitalize text-red-700">
                      This order was {result.status}.
                    </p>
                  </div>
                ) : (
                  <ol>
                    {FLOW.map((stage, i) => {
                      const done = i <= stageIndex
                      const current = i === stageIndex
                      return (
                        <li key={stage.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <span
                              className={cx(
                                'grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors',
                                done ? 'bg-moss text-white' : 'border border-ink/15 text-ink/25',
                              )}
                            >
                              {done ? (
                                <Icon name="check" size={15} strokeWidth={2.5} />
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              )}
                            </span>
                            {i < FLOW.length - 1 && (
                              <span className={cx('w-px flex-1', done ? 'bg-moss/40' : 'bg-ink/10')} />
                            )}
                          </div>
                          <div className={cx('pb-6', i === FLOW.length - 1 && 'pb-0')}>
                            <p
                              className={cx(
                                'text-[0.9375rem] font-medium',
                                !done && 'text-ink/40',
                              )}
                            >
                              {stage.label}
                              {current && (
                                <span className="ml-2 rounded-full bg-moss/12 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-moss">
                                  Now
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-[0.8125rem] text-ink/55">{stage.body}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}

                {/* courier */}
                {result.delivery?.trackingNumber && (
                  <div className="mt-5 rounded-xl bg-sand px-4 py-3.5">
                    <p className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                      <Icon name="truck" size={16} className="shrink-0 text-ink/45" />
                      <span className="font-medium">{result.delivery.courier}</span>
                      <span className="font-mono text-[0.8125rem] text-ink/60">
                        {result.delivery.trackingNumber}
                      </span>
                    </p>
                    {result.delivery.courierStatus && (
                      <p className="mt-1.5 text-[0.8125rem] text-ink/60">
                        Courier says: {result.delivery.courierStatus}
                      </p>
                    )}
                    {result.delivery.trackingUrl && (
                      <a
                        href={result.delivery.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-plum underline underline-offset-2"
                      >
                        Track on {result.delivery.courier} <Icon name="arrowUpRight" size={13} />
                      </a>
                    )}
                  </div>
                )}

                {/* items */}
                <ul className="mt-5 space-y-3 border-t border-ink/8 pt-5">
                  {result.lines.map((l, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-sand">
                        <ProductArt product={l} decorative={false} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.875rem] font-medium">{l.name}</p>
                        <p className="text-[0.75rem] text-ink/50">
                          {[l.color, l.size, `Qty ${l.qty}`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="shrink-0 text-[0.875rem] font-medium">
                        {taka(l.price * l.qty)}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-5 space-y-2 border-t border-ink/8 pt-4 text-[0.875rem]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/55">Delivery</dt>
                    <dd className="text-right">
                      {result.delivery.zoneLabel} · {result.delivery.eta}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink/55">Total</dt>
                    <dd className="font-display text-lg">{taka(result.totals.total)}</dd>
                  </div>
                </dl>

                <Button
                  href={`${API_BASE}/orders/${result.orderNumber}/invoice?phone=${encodeURIComponent(phone.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="md"
                  full
                  className="mt-5"
                >
                  <Icon name="eye" size={16} /> View invoice
                </Button>
              </div>
            </div>
          )}

          {/* orders placed on this device — a convenience shortcut, not the source of truth */}
          {orders.length > 0 && (
            <div className="mt-14">
              <h2 className="font-display text-xl">Recent orders from this device</h2>
              <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
                {orders.map((o) => (
                  <li key={o.orderNumber}>
                    <button
                      type="button"
                      onClick={() => {
                        setCode(o.orderNumber)
                        setPhone(o.customer?.phone?.replace(/^88/, '') ?? '')
                        setParams({ order: o.orderNumber }, { replace: true })
                        if (o.customer?.phone) lookup(o.orderNumber, o.customer.phone.replace(/^88/, ''))
                      }}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-plum"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[0.875rem] font-medium">{o.orderNumber}</p>
                        <p className="mt-0.5 text-[0.75rem] text-ink/50">
                          {formatDate(o.createdAt)} · {o.lines.length}{' '}
                          {o.lines.length === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[0.875rem] font-semibold">{taka(o.totals.total)}</span>
                        <Icon name="chevronRight" size={16} className="text-ink/30" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isSignedIn && (
            <p className="mt-10 rounded-2xl bg-sand px-5 py-4 text-center text-[0.8125rem] leading-relaxed text-ink/65">
              <Icon name="user" size={15} className="mr-1.5 inline text-ink/40" />
              Have an account?{' '}
              <Link to="/login" className="font-medium text-plum underline underline-offset-2">
                Sign in
              </Link>{' '}
              to see all your orders in one place — but you never need one to track an order.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
