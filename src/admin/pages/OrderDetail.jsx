import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminApi, API_BASE } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, Field, Input, Modal, ORDER_TONE, PAYMENT_TONE,
  Select, Spinner, Textarea, Toggle, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { useSettings } from '@/context/SettingsContext'
import { cx, formatDate, taka } from '@/utils/format'

const FLOW = ['pending', 'confirmed', 'packed', 'shipped', 'delivered']
const METHOD_LABEL = {
  cod: 'Cash on delivery', sslcommerz: 'SSLCommerz', bkash: 'bKash checkout',
  'bkash-manual': 'bKash — Send Money', 'nagad-manual': 'Nagad — Send Money',
}

export default function OrderDetail() {
  const { id } = useParams()
  const { delivery } = useSettings()
  const { push, node } = useToasts()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [sms, setSms] = useState(null)
  const [smsText, setSmsText] = useState('')
  const [smsBusy, setSmsBusy] = useState(false)
  const [smsError, setSmsError] = useState('')
  const [shipModal, setShipModal] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notes, setNotes] = useState('')
  const [couriers, setCouriers] = useState([])
  const [courierBusy, setCourierBusy] = useState(false)

  /**
   * A single GSM-7 SMS is 160 characters; any Bangla, emoji or ৳ sign flips it
   * to Unicode where one part is 70. Measured here so the cost is visible
   * before sending, not after.
   */
  const smsMeasure = (() => {
    const gsm =
      "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
      '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
      '^{}\\[~]|€'
    const chars = [...smsText]
    const unicode = chars.some((c) => !gsm.includes(c))
    const limit = unicode ? 70 : 160
    const perMulti = unicode ? 67 : 153
    const length = chars.length
    return {
      length,
      unicode,
      limit,
      parts: length === 0 ? 0 : length <= limit ? 1 : Math.ceil(length / perMulti),
    }
  })()

  const loadSms = useCallback(async () => {
    setSmsError('')
    try {
      setSms(await adminApi.get(`/orders/${id}/sms`))
    } catch (err) {
      /**
       * `sms` stays null on failure, and null is also the loading state — so
       * without a separate error the card spins for ever and looks like a slow
       * network rather than a request that already came back 404 or 502.
       */
      setSms(null)
      setSmsError(err.message || 'Could not load the SMS panel')
    }
  }, [id])

  const sendOrderSms = async () => {
    setSmsBusy(true)
    try {
      const res = await adminApi.post(`/orders/${id}/sms`, { text: smsText })
      push(res.simulated ? 'SMS simulated — add an API key to send for real' : 'SMS sent', res.simulated ? 'info' : 'success')
      setSmsText('')
      setSms((prev) => (prev ? { ...prev, history: res.history } : prev))
    } catch (err) {
      // The gateway's own wording is more useful than anything we could invent.
      push(err.message, 'error')
      loadSms()
    } finally {
      setSmsBusy(false)
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await adminApi.get(`/orders/${id}`)
      setData(res)
      setNotes(res.order.internalNotes ?? '')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    load()
    loadSms()
  }, [load, loadSms])

  useEffect(() => {
    adminApi.get('/couriers').then((d) => setCouriers(d.couriers)).catch(() => {})
  }, [])

  if (loading) return <Spinner className="min-h-[60vh]" />

  if (!data) {
    return (
      <AdminPage title="Order not found">
        <Card>
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-sand">
              <Icon name="alert" size={24} className="text-ink/30" />
            </div>
            <p className="mt-4 text-[0.9375rem] font-medium">
              {loadError || 'We could not load that order'}
            </p>
            <p className="mt-1.5 max-w-sm text-[0.8125rem] text-ink/50">
              It may have been deleted, or the link may be wrong.
            </p>
            <Btn as={Link} to="/admin/orders" variant="primary" className="mt-5">
              Back to orders
            </Btn>
          </div>
        </Card>
      </AdminPage>
    )
  }

  const { order, customer, history } = data
  const stageIndex = FLOW.indexOf(order.status)
  const isClosed = ['cancelled', 'returned'].includes(order.status)

  const setStatus = async (status) => {
    setBusy(true)
    try {
      const res = await adminApi.patch(`/orders/${order._id}/status`, { status, notifyEmail })
      setData((d) => ({ ...d, order: res.order }))
      const mail = res.email
      push(
        mail?.simulated
          ? `Status updated. Email simulated (SMTP not configured).`
          : mail?.ok
            ? `Status updated and email sent to ${order.customer.email}`
            : 'Status updated',
      )
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveNotes = async () => {
    try {
      await adminApi.patch(`/orders/${order._id}`, { internalNotes: notes })
      push('Notes saved')
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const bookCourier = async (provider) => {
    setCourierBusy(true)
    try {
      const res = await adminApi.post(`/couriers/orders/${order._id}/consignment`, { provider })
      setData((d) => ({ ...d, order: res.order }))
      push(`Booked with ${res.order.delivery.courier} — ${res.consignment.consignmentId}`)
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setCourierBusy(false)
    }
  }

  const syncCourier = async () => {
    setCourierBusy(true)
    try {
      const res = await adminApi.post(`/couriers/orders/${order._id}/sync`)
      setData((d) => ({ ...d, order: res.order }))
      push(
        res.advancedTo
          ? `Courier says "${res.courierStatus}" — order moved to ${res.advancedTo}`
          : `Courier status: ${res.courierStatus}`,
      )
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setCourierBusy(false)
    }
  }

  const setRisk = async (riskFlag) => {
    try {
      const res = await adminApi.patch(`/orders/${order._id}`, { riskFlag })
      setData((d) => ({ ...d, order: res.order }))
      push(riskFlag === 'blocked' ? 'Customer blocked from future orders' : 'Risk flag updated')
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const waLink = `https://wa.me/${order.customer.phone}?text=${encodeURIComponent(
    `Assalamu alaikum ${order.customer.name}! This is about your order ${order.orderNumber}.`,
  )}`

  return (
    <AdminPage
      title={order.orderNumber}
      subtitle={`Placed ${formatDate(order.createdAt)} · ${order.source} · ${METHOD_LABEL[order.payment.method]}`}
      actions={
        <>
          <Btn as={Link} to="/admin/orders" size="md">
            <Icon name="chevronLeft" size={14} /> All orders
          </Btn>
          <Btn as="a" href={waLink} target="_blank" rel="noopener noreferrer" size="md">
            <Icon name="whatsapp" size={15} /> WhatsApp
          </Btn>
          <Btn as="a" href={`tel:${order.customer.phone}`} variant="primary" size="md">
            <Icon name="phone" size={15} /> Call customer
          </Btn>
        </>
      }
    >
      {node}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {/* status flow */}
          <Card title="Order status">
            {isClosed ? (
              <div className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-4">
                <Icon name="alert" size={20} className="shrink-0 text-red-600" />
                <div>
                  <p className="text-[0.9375rem] font-semibold capitalize text-red-700">{order.status}</p>
                  <p className="text-[0.8125rem] text-red-600/80">
                    Stock has been returned to inventory.
                  </p>
                </div>
              </div>
            ) : (
              <ol className="flex flex-wrap items-center gap-1.5">
                {FLOW.map((stage, i) => {
                  const done = i <= stageIndex
                  const isNext = i === stageIndex + 1
                  return (
                    <li key={stage} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy || i === stageIndex}
                        onClick={() => setStatus(stage)}
                        className={cx(
                          'rounded-lg px-3 py-2 text-[0.8125rem] font-medium capitalize transition-colors disabled:cursor-default',
                          done ? 'bg-moss text-white' : isNext ? 'border border-ink bg-white hover:bg-ink hover:text-cream' : 'border border-ink/12 text-ink/40 hover:border-ink/40 hover:text-ink/70',
                        )}
                      >
                        {done && <Icon name="check" size={12} strokeWidth={3} className="mr-1 inline" />}
                        {stage}
                      </button>
                      {i < FLOW.length - 1 && <span className="h-px w-3 bg-ink/15" />}
                    </li>
                  )
                })}
              </ol>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-4">
              <Toggle
                checked={notifyEmail}
                onChange={setNotifyEmail}
                label="Email the customer on status change"
                description={order.customer.email ? order.customer.email : 'No email on this order — nothing will send'}
              />
              <div className="flex gap-2">
                <Btn size="sm" onClick={() => setShipModal(true)}>
                  <Icon name="truck" size={14} /> Courier & tracking
                </Btn>
                {!isClosed && (
                  <Btn size="sm" variant="danger" onClick={() => setStatus('cancelled')} disabled={busy}>
                    Cancel order
                  </Btn>
                )}
              </div>
            </div>
          </Card>

          {/* items */}
          <Card title="Items" padded={false}>
            <ul className="divide-y divide-ink/6">
              {order.lines.map((line, i) => (
                <li key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sand">
                    <ProductArt product={line} decorative={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/product/${line.slug}`} target="_blank" className="text-[0.875rem] font-medium hover:text-plum">
                      {line.name}
                    </Link>
                    <p className="mt-0.5 text-[0.75rem] text-ink/50">
                      {[line.color, line.size, line.sku].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 text-[0.8125rem] text-ink/55">
                    {taka(line.price)} × {line.qty}
                  </span>
                  <span className="w-20 shrink-0 text-right text-[0.875rem] font-semibold">
                    {taka(line.price * line.qty)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-ink/8 px-5 py-4 text-[0.875rem]">
              <div className="flex justify-between"><dt className="text-ink/55">Subtotal</dt><dd>{taka(order.totals.subtotal)}</dd></div>
              {order.totals.discount > 0 && (
                <div className="flex justify-between text-moss">
                  <dt>Discount {order.coupon?.code && `(${order.coupon.code})`}</dt>
                  <dd>−{taka(order.totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-ink/55">Delivery</dt><dd>{order.totals.shipping ? taka(order.totals.shipping) : 'Free'}</dd></div>
              <div className="flex items-baseline justify-between border-t border-ink/10 pt-2.5">
                <dt className="font-display text-lg">Total</dt>
                <dd className="font-display text-xl">{taka(order.totals.total)}</dd>
              </div>
            </dl>
          </Card>

          {/* Order SMS — the fastest way to reach a Bangladeshi customer,
              and the one channel that reliably gets read before delivery. */}
          <Card
            title="Send SMS"
            description={sms?.configured ? `via ${sms.provider}` : 'Not configured — messages are simulated'}
          >
            {smsError ? (
              <div className="space-y-2.5">
                <p className="rounded-lg bg-red-50 px-3.5 py-3 text-[0.8125rem] text-red-700">
                  {smsError}
                </p>
                <Btn size="xs" onClick={loadSms}>Try again</Btn>
              </div>
            ) : !sms ? (
              <Spinner />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {sms.templates.map((t) => (
                    <Btn key={t.label} size="xs" onClick={() => setSmsText(t.text)}>
                      {t.label}
                    </Btn>
                  ))}
                </div>

                <Textarea
                  rows={3}
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  placeholder="Write a short update for the customer…"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={smsMeasure.parts > 1 ? 'warning' : 'neutral'}>
                    {smsMeasure.length}/{smsMeasure.limit} · {smsMeasure.parts || 0} SMS
                  </Badge>
                  <span className="text-[0.75rem] text-ink/50">to {sms.phone}</span>
                  <Btn
                    size="sm"
                    variant="primary"
                    className="ml-auto"
                    loading={smsBusy}
                    disabled={smsBusy || !smsText.trim()}
                    onClick={sendOrderSms}
                  >
                    <Icon name="mail" size={13} /> Send
                  </Btn>
                </div>

                {smsMeasure.unicode && smsMeasure.length > 0 && (
                  <p className="text-[0.75rem] leading-relaxed text-gold">
                    Bangla or a special character is in use, so one SMS holds 70 characters instead of 160.
                  </p>
                )}

                {sms.history?.length > 0 && (
                  <ul className="space-y-2 border-t border-ink/8 pt-3">
                    {[...sms.history].reverse().slice(0, 4).map((h, i) => (
                      <li key={i} className="text-[0.75rem]">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone={h.status === 'failed' ? 'danger' : h.status === 'simulated' ? 'warning' : 'success'}>
                            {h.status}
                          </Badge>
                          <span className="text-ink/45">{formatDate(h.at)} · {h.by}</span>
                        </span>
                        <span className="mt-0.5 block text-ink/60">{h.text}</span>
                        {h.error && <span className="block text-red-600">{h.error}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>

          {/* timeline */}
          <Card title="Timeline">
            <ol className="space-y-4">
              {[...order.timeline].reverse().map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand">
                    <span className="h-2 w-2 rounded-full bg-plum" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.875rem] font-medium capitalize">{t.status}</p>
                    {t.note && <p className="text-[0.8125rem] text-ink/60">{t.note}</p>}
                    <p className="mt-0.5 text-[0.6875rem] text-ink/40">
                      {new Date(t.at).toLocaleString('en-GB')} · {t.by}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* sidebar */}
        <div className="space-y-4">
          {/* payment */}
          <Card title="Payment">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.875rem] font-medium">{METHOD_LABEL[order.payment.method]}</p>
                {order.payment.channel && <p className="text-[0.75rem] text-ink/50">{order.payment.channel}</p>}
              </div>
              <Badge tone={PAYMENT_TONE[order.payment.status] ?? 'neutral'}>{order.payment.status}</Badge>
            </div>

            {order.payment.transactionId && (
              <p className="mt-3 rounded-lg bg-sand px-3 py-2 font-mono text-[0.75rem]">
                TrxID: {order.payment.transactionId}
              </p>
            )}
            {order.payment.validationId && (
              <p className="mt-2 rounded-lg bg-moss/10 px-3 py-2 font-mono text-[0.6875rem] text-moss">
                Validated: {order.payment.validationId}
              </p>
            )}
            {order.payment.advanceAmount > 0 && order.payment.status === 'unpaid' && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-gold/12 px-3 py-2.5 text-[0.75rem] text-ink/75">
                <Icon name="info" size={14} className="mt-0.5 shrink-0 text-gold" />
                Needs a {taka(order.payment.advanceAmount)} advance — order is over the COD threshold.
              </p>
            )}

            {order.payment.status !== 'paid' && (
              <Btn variant="success" size="sm" className="mt-4 w-full" onClick={() => setPayModal(true)}>
                <Icon name="check" size={14} /> Mark as paid
              </Btn>
            )}
          </Card>

          {/* customer */}
          <Card
            title="Customer"
            actions={
              customer && (
                <Btn as={Link} to={`/admin/customers/${customer._id}`} size="xs">Profile</Btn>
              )
            }
          >
            <p className="text-[0.9375rem] font-medium">{order.customer.name}</p>
            <address className="mt-2 space-y-1 text-[0.8125rem] not-italic leading-relaxed text-ink/65">
              <span className="block">{order.customer.address}</span>
              <span className="block">{order.customer.area}, {order.customer.district}</span>
              <a href={`tel:${order.customer.phone}`} className="block hover:text-plum">{order.customer.phone}</a>
              {order.customer.altPhone && (
                <a href={`tel:${order.customer.altPhone}`} className="block hover:text-plum">{order.customer.altPhone} (alt)</a>
              )}
              {order.customer.email && (
                <a href={`mailto:${order.customer.email}`} className="block hover:text-plum">{order.customer.email}</a>
              )}
            </address>

            {order.customer.notes && (
              <p className="mt-3 rounded-lg bg-sand px-3 py-2.5 text-[0.8125rem] text-ink/70">
                <strong className="font-medium">Note:</strong> {order.customer.notes}
              </p>
            )}
            {order.customer.isGift && (
              <p className="mt-3 rounded-lg bg-blush px-3 py-2.5 text-[0.8125rem] italic text-plum">
                <Icon name="gift" size={13} className="mr-1 inline" />
                {order.customer.giftNote || 'Gift wrap requested'}
              </p>
            )}

            {customer && (
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink/8 pt-3.5 text-[0.75rem]">
                <span className="text-ink/55">
                  {customer.orderCount} orders · {taka(customer.totalSpent)} lifetime
                </span>
                {customer.cancelledCount > 0 && (
                  <Badge tone="danger">{customer.cancelledCount} cancelled</Badge>
                )}
              </div>
            )}

            <div className="mt-4 border-t border-ink/8 pt-3.5">
              <Field label="Risk flag" hint="Blocks future COD orders">
                <Select value={order.riskFlag} onChange={(e) => setRisk(e.target.value)}>
                  <option value="none">No concerns</option>
                  <option value="watch">Watch — has refused before</option>
                  <option value="blocked">Blocked — refuse new orders</option>
                </Select>
              </Field>
            </div>
          </Card>

          {/* invoice */}
          <Card title="Invoice">
            {order.invoice?.number ? (
              <>
                <p className="font-mono text-[0.9375rem] font-semibold">{order.invoice.number}</p>
                <p className="mt-0.5 text-[0.75rem] text-ink/50">
                  Issued {formatDate(order.invoice.issuedAt)}
                </p>
              </>
            ) : (
              <p className="text-[0.8125rem] text-ink/50">No invoice number yet.</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Btn
                as="a"
                href={`${API_BASE}/orders/${order.orderNumber}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
              >
                <Icon name="eye" size={14} /> View
              </Btn>
              <Btn
                as="a"
                href={`${API_BASE}/orders/${order.orderNumber}/invoice?print=1`}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
              >
                Print
              </Btn>
              {order.customer.email && (
                <Btn
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await adminApi.post(`/orders/${order._id}/send-invoice`)
                      push(
                        res.result?.simulated
                          ? 'SMTP not configured — invoice email simulated'
                          : `Invoice emailed to ${order.customer.email}`,
                        res.result?.simulated ? 'info' : 'success',
                      )
                    } catch (err) {
                      push(err.message, 'error')
                    }
                  }}
                >
                  <Icon name="mail" size={14} /> Email
                </Btn>
              )}
            </div>
          </Card>

          {/* courier */}
          <Card
            title="Courier"
            actions={
              order.delivery?.consignmentId && (
                <Btn size="xs" loading={courierBusy} onClick={syncCourier}>
                  <Icon name="refresh" size={12} /> Refresh
                </Btn>
              )
            }
          >
            {order.delivery?.consignmentId ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.9375rem] font-medium">{order.delivery.courier}</p>
                  {order.delivery.courierStatus && (
                    <Badge tone="info">{order.delivery.courierStatus}</Badge>
                  )}
                </div>
                <dl className="mt-3 space-y-2 text-[0.8125rem]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink/55">Consignment</dt>
                    <dd className="font-mono text-[0.75rem]">{order.delivery.consignmentId}</dd>
                  </div>
                  {order.delivery.trackingCode && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink/55">Tracking</dt>
                      <dd className="font-mono text-[0.75rem]">{order.delivery.trackingCode}</dd>
                    </div>
                  )}
                  {order.delivery.lastSyncedAt && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink/55">Last checked</dt>
                      <dd>{new Date(order.delivery.lastSyncedAt).toLocaleString('en-GB')}</dd>
                    </div>
                  )}
                </dl>
                {order.delivery.trackingUrl && (
                  <Btn
                    as="a"
                    href={order.delivery.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    className="mt-3 w-full"
                  >
                    <Icon name="arrowUpRight" size={13} /> Open on courier site
                  </Btn>
                )}
              </>
            ) : (
              <>
                <p className="text-[0.8125rem] leading-relaxed text-ink/60">
                  No consignment booked yet. Booking sends the parcel details and the amount to
                  collect straight to the courier.
                </p>

                {couriers.filter((c) => c.enabled && c.configured).length === 0 ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-gold/12 px-3 py-2.5 text-[0.75rem] text-ink/70">
                    <Icon name="info" size={13} className="mt-0.5 shrink-0 text-gold" />
                    No courier is connected. Add your API keys in{' '}
                    <Link to="/admin/settings?tab=couriers" className="underline">
                      Settings &rarr; Couriers
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {couriers
                      .filter((c) => c.enabled && c.configured)
                      .map((c) => (
                        <Btn
                          key={c.id}
                          size="sm"
                          variant="primary"
                          loading={courierBusy}
                          onClick={() => bookCourier(c.id)}
                        >
                          <Icon name="truck" size={13} /> Send to {c.label}
                        </Btn>
                      ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* delivery */}
          <Card title="Delivery">
            <dl className="space-y-2 text-[0.8125rem]">
              <div className="flex justify-between gap-3"><dt className="text-ink/55">Zone</dt><dd className="text-right">{order.delivery.zoneLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/55">Estimated</dt><dd>{order.delivery.eta}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/55">Charge</dt><dd>{order.delivery.charge ? taka(order.delivery.charge) : 'Free'}</dd></div>
              {order.delivery.courier && (
                <div className="flex justify-between gap-3"><dt className="text-ink/55">Courier</dt><dd>{order.delivery.courier}</dd></div>
              )}
              {order.delivery.trackingNumber && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink/55">Tracking</dt>
                  <dd className="font-mono text-[0.75rem]">{order.delivery.trackingNumber}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* internal notes */}
          <Card title="Internal notes" description="Only your team sees this">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Called twice, no answer…" />
            <Btn size="sm" className="mt-2.5 w-full" onClick={saveNotes}>Save note</Btn>
          </Card>

          {history?.length > 0 && (
            <Card title="Other orders from this number">
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h._id}>
                    <Link to={`/admin/orders/${h._id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[0.8125rem] hover:bg-sand">
                      <span className="font-mono">{h.orderNumber}</span>
                      <Badge tone={ORDER_TONE[h.status] ?? 'neutral'} className="capitalize">{h.status}</Badge>
                      <span className="font-medium">{taka(h.totals.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <PaymentModal
        open={payModal}
        onClose={() => setPayModal(false)}
        order={order}
        onSaved={(o) => { setData((d) => ({ ...d, order: o })); push('Payment recorded') }}
        onError={(m) => push(m, 'error')}
      />
      <ShippingModal
        open={shipModal}
        onClose={() => setShipModal(false)}
        order={order}
        couriers={delivery.couriers ?? []}
        onSaved={(o) => { setData((d) => ({ ...d, order: o })); push('Delivery details saved') }}
        onError={(m) => push(m, 'error')}
      />
    </AdminPage>
  )
}

function PaymentModal({ open, onClose, order, onSaved, onError }) {
  const [amount, setAmount] = useState(order.totals.total)
  const [trxId, setTrxId] = useState(order.payment.transactionId ?? '')
  const [channel, setChannel] = useState(order.payment.channel || 'bKash')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const res = await adminApi.post(`/orders/${order._id}/confirm-payment`, {
        amount: Number(amount), transactionId: trxId, channel,
      })
      onSaved(res.order)
      onClose()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description="Verify the TrxID in your bKash/Nagad app before confirming."
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="success" loading={busy} onClick={save}>Mark paid</Btn></>}
    >
      <div className="space-y-4">
        <Field label="Amount received" hint={`Order total ${taka(order.totals.total)}`}>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Transaction ID" hint="From the customer's SMS">
          <Input value={trxId} onChange={(e) => setTrxId(e.target.value.toUpperCase())} placeholder="8N7A2K9XYZ" />
        </Field>
        <Field label="Paid via">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank transfer', 'Cash'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        {Number(amount) < order.totals.total && (
          <p className="flex items-start gap-2 rounded-lg bg-gold/12 px-3.5 py-2.5 text-[0.8125rem]">
            <Icon name="info" size={14} className="mt-0.5 shrink-0 text-gold" />
            This is less than the total — the order will be marked <strong>advance-paid</strong>, and the
            remaining {taka(order.totals.total - Number(amount))} collected on delivery.
          </p>
        )}
      </div>
    </Modal>
  )
}

function ShippingModal({ open, onClose, order, couriers, onSaved, onError }) {
  const [courier, setCourier] = useState(order.delivery.courier ?? '')
  const [tracking, setTracking] = useState(order.delivery.trackingNumber ?? '')
  const [url, setUrl] = useState(order.delivery.trackingUrl ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const res = await adminApi.patch(`/orders/${order._id}`, {
        delivery: { ...order.delivery, courier, trackingNumber: tracking, trackingUrl: url },
      })
      onSaved(res.order)
      onClose()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Courier & tracking"
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" loading={busy} onClick={save}>Save</Btn></>}
    >
      <div className="space-y-4">
        <Field label="Courier">
          <Select value={courier} onChange={(e) => setCourier(e.target.value)}>
            <option value="">Not assigned</option>
            {couriers.filter((c) => c.enabled !== false).map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Consignment / tracking number">
          <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. SF1234567890" />
        </Field>
        <Field label="Tracking URL" hint="Optional — included in the shipped email">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://steadfast.com.bd/t/…" />
        </Field>
      </div>
    </Modal>
  )
}
