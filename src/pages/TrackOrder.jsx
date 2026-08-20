import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useWhatsAppLink } from '@/context/SettingsContext'
import { useStore } from '@/context/StoreContext'
import { api } from '@/lib/api'
import { formatDate, taka } from '@/utils/format'

export default function TrackOrder() {
  const waLink = useWhatsAppLink('Hi! Can you check the status of my order? My number is ')
  const { orders, findOrder } = useStore()
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState(undefined) // undefined = not searched yet
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  usePageMeta('Track your order')

  /**
   * Looks up the order on the server, so it works from any device — not only
   * the one that placed it. The phone number is required because order numbers
   * alone are guessable.
   */
  const search = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { order } = await api.get(
        `/orders/track/${encodeURIComponent(code.trim())}?phone=${encodeURIComponent(phone.trim())}`,
      )
      setResult(order)
    } catch (err) {
      setResult(findOrder(code) ?? null)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Track order' }]}
        eyebrow="Order status"
        title="Where is my parcel?"
        lead="Enter the order number from your confirmation page or SMS. Orders placed on this device are listed below."
      />

      <div className="container-x py-12 md:py-16">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={search} className="space-y-2.5">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GBS-XXXXXX00"
                aria-label="Order number"
                required
                className="h-[3.25rem] flex-1 rounded-full border border-ink/15 bg-cream px-5 font-mono text-[0.9375rem] uppercase outline-none transition-colors focus:border-ink"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                aria-label="Mobile number used to order"
                inputMode="tel"
                required
                className="h-[3.25rem] flex-1 rounded-full border border-ink/15 bg-cream px-5 text-[0.9375rem] outline-none transition-colors focus:border-ink"
              />
              <Button type="submit" size="lg" loading={busy}>
                <Icon name="search" size={17} /> Track
              </Button>
            </div>
            <p className="px-2 text-[0.75rem] text-ink/45">
              Both fields are needed — the mobile number keeps your order private.
            </p>
          </form>

          {result === null && (
            <div className="mt-6 rounded-2xl bg-blush p-6 text-center">
              <p className="font-display text-lg">{error || 'No order found with that number'}</p>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink/60">
                Order history is stored on the device the order was placed from. If you ordered from
                another phone or browser, message us on WhatsApp with your mobile number and we will
                look it up.
              </p>
              <Button
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                className="mt-4"
              >
                <Icon name="whatsapp" size={15} /> Ask on WhatsApp
              </Button>
            </div>
          )}

          {result && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-ink/12">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-sand px-6 py-4">
                <div>
                  <p className="font-mono text-[0.9375rem] font-semibold">{result.orderNumber}</p>
                  <p className="text-[0.75rem] text-ink/50">Placed {formatDate(result.createdAt)}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-moss/12 px-3 py-1.5 text-[0.75rem] font-medium text-moss">
                  <Icon name="checkCircle" size={14} /> <span className="capitalize">{result.status}</span>
                </span>
              </div>
              <div className="px-6 py-5">
                <dl className="space-y-2.5 text-[0.875rem]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/55">Items</dt>
                    <dd>{result.lines.reduce((n, l) => n + l.qty, 0)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/55">Total</dt>
                    <dd className="font-semibold">{taka(result.totals.total)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/55">Delivery</dt>
                    <dd className="text-right">
                      {result.delivery.zoneLabel} · {result.delivery.eta}
                    </dd>
                  </div>
                </dl>
                <Button to={`/order/${result.orderNumber}`} variant="outline" size="md" full className="mt-5">
                  View full order
                </Button>
              </div>
            </div>
          )}

          {/* orders on this device */}
          {orders.length > 0 && (
            <div className="mt-14">
              <h2 className="font-display text-xl">Orders from this device</h2>
              <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
                {orders.map((o) => (
                  <li key={o.orderNumber}>
                    <Link
                      to={`/order/${o.orderNumber}`}
                      className="flex items-center justify-between gap-4 py-4 transition-colors hover:text-plum"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[0.875rem] font-medium">{o.orderNumber}</p>
                        <p className="mt-0.5 text-[0.75rem] text-ink/50">
                          {formatDate(o.createdAt)} · {o.lines.length}{' '}
                          {o.lines.length === 1 ? 'item' : 'items'} ·{' '}
                          {o.payment.method === 'cod' ? 'Cash on delivery' : 'Paid online'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[0.875rem] font-semibold">{taka(o.totals.total)}</span>
                        <Icon name="chevronRight" size={16} className="text-ink/30" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
