import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { QtyStepper } from '@/components/product/VariantPicker'
import { customerApi } from '@/lib/api'
import { getPixelIds } from '@/lib/tracking'
import { useSettings } from '@/context/SettingsContext'
import { useStore } from '@/context/StoreContext'
import { useEscape, useScrollLock } from '@/hooks/useScrollLock'
import { cx, isValidBdPhone, qualifiesForFreeShipping, sanitisePhoneInput, taka } from '@/utils/format'

/**
 * One-step order form — name, phone, address, done.
 *
 * This is how most Bangladeshi shops actually sell: customers do not want to
 * build a cart and walk a three-step checkout, they want to order the item in
 * front of them in fifteen seconds and pay the courier.
 */
export function QuickOrder({ product, open, onClose, color, size, initialQty = 1 }) {
  const navigate = useNavigate()
  const { zones, delivery } = useSettings()
  const { toast, placeOrder } = useStore()

  const [qty, setQty] = useState(initialQty)
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? 'dhaka-city')
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useScrollLock(open)
  useEscape(open, onClose)

  if (!open || !product) return null

  const zone = zones.find((z) => z.id === zoneId) ?? zones[0]
  const sizeOption = product.sizes?.find((s) => s.label === size)
  const unitPrice = product.price + (sizeOption?.priceDelta ?? 0)
  const subtotal = unitPrice * qty
  const freeShipping = qualifiesForFreeShipping(subtotal, delivery)
  const shipping = freeShipping ? 0 : (zone?.charge ?? 0)
  const total = subtotal + shipping

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 3) next.name = 'Please enter your full name'
    if (!isValidBdPhone(form.phone)) next.phone = 'Enter a valid mobile number (01XXXXXXXXX)'
    if (form.address.trim().length < 10) next.address = 'Please give a full address'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const { order } = await customerApi.post('/orders', {
        customer: {
          name: form.name,
          phone: form.phone,
          address: form.address,
          district: zoneId === 'outside' ? '' : 'Dhaka',
          area: '',
        },
        lines: [{ productId: product.id, slug: product.slug, qty, color, size }],
        zoneId,
        payment: { method: 'cod' },
        source: 'quick-order',
        // Same attribution data the full checkout sends — quick orders are a
        // large share of COD sales and must not lose their ad source.
        tracking: { ...getPixelIds(), sourceUrl: window.location.href },
      })
      placeOrder(order)
      onClose()
      toast('Order placed! We will call you shortly.', { kind: 'success' })
      navigate(`/order/${order.orderNumber}`)
    } catch (error) {
      toast(error.message, { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const inputClass = (error) =>
    cx(
      'h-12 w-full rounded-xl border bg-cream px-4 text-[0.9375rem] outline-none transition-colors placeholder:text-ink/30',
      error ? 'border-red-400' : 'border-ink/15 focus:border-ink',
    )

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={'Quick order'}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-cream animate-[fade-up_0.35s_cubic-bezier(0.16,1,0.3,1)_both] sm:max-w-lg sm:rounded-[1.75rem]"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink/8 bg-cream/95 px-5 py-4 backdrop-blur-md">
          <div>
            <h2 className="font-display text-xl leading-tight">{'Quick order'}</h2>
            <p className="text-[0.75rem] text-ink/55">
              {'Cash on delivery — no advance needed'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/45 hover:bg-ink/[0.06] hover:text-ink"
          >
            <Icon name="close" size={17} />
          </button>
        </header>

        <div className="px-5 py-5">
          {/* item */}
          <div className="flex items-center gap-3.5 rounded-2xl bg-sand p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream">
              <ProductArt product={product} decorative={false} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-medium">{product.name}</p>
              {(color || size) && (
                <p className="text-[0.75rem] text-ink/50">{[color, size].filter(Boolean).join(' · ')}</p>
              )}
              <p className="mt-0.5 text-[0.875rem] font-semibold">{taka(unitPrice)}</p>
            </div>
            <QtyStepper value={qty} onChange={setQty} max={Math.max(1, product.stock || 99)} size="sm" />
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <label className="block">
              <span className="text-[0.8125rem] font-medium text-ink/70">
                {'Your name'} <span className="text-rose">*</span>
              </span>
              <input
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((x) => ({ ...x, name: undefined })) }}
                placeholder={'e.g. Nusrat Jahan'}
                autoComplete="name"
                className={cx('mt-1.5', inputClass(errors.name))}
              />
              {errors.name && <span className="mt-1 block text-[0.75rem] text-red-600">{errors.name}</span>}
            </label>

            <label className="block">
              <span className="text-[0.8125rem] font-medium text-ink/70">
                {'Mobile number'} <span className="text-rose">*</span>
              </span>
              <input
                value={form.phone}
                onChange={(e) => { setForm((f) => ({ ...f, phone: sanitisePhoneInput(e.target.value) })); setErrors((x) => ({ ...x, phone: undefined })) }}
                placeholder="01XXXXXXXXX"
                inputMode="tel"
                autoComplete="tel"
                className={cx('mt-1.5', inputClass(errors.phone))}
              />
              {errors.phone && <span className="mt-1 block text-[0.75rem] text-red-600">{errors.phone}</span>}
            </label>

            <label className="block">
              <span className="text-[0.8125rem] font-medium text-ink/70">
                {'Full address'} <span className="text-rose">*</span>
              </span>
              <textarea
                value={form.address}
                onChange={(e) => { setForm((f) => ({ ...f, address: e.target.value })); setErrors((x) => ({ ...x, address: undefined })) }}
                rows={2}
                placeholder={'House, road, area'}
                className={cx('mt-1.5 h-auto resize-none py-3', inputClass(errors.address))}
              />
              {errors.address && <span className="mt-1 block text-[0.75rem] text-red-600">{errors.address}</span>}
            </label>

            <label className="block">
              <span className="text-[0.8125rem] font-medium text-ink/70">{'Delivery area'}</span>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className={cx('mt-1.5 cursor-pointer', inputClass(false))}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label} — {taka(z.charge)}
                  </option>
                ))}
              </select>
            </label>

            {/* totals */}
            <dl className="space-y-1.5 rounded-2xl bg-sand px-4 py-3.5 text-[0.875rem]">
              <div className="flex justify-between">
                <dt className="text-ink/60">{'Subtotal'}</dt>
                <dd>{taka(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">{'Delivery'}</dt>
                <dd>{shipping === 0 ? <span className="text-moss">{'Free'}</span> : taka(shipping)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-ink/12 pt-2">
                <dt className="font-display text-lg">{'Total'}</dt>
                <dd className="font-display text-xl">{taka(total)}</dd>
              </div>
            </dl>

            <Button type="submit" size="lg" full loading={busy} disabled={busy}>
              <Icon name="cash" size={18} />
              {'Confirm order'} · {taka(total)}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-center text-[0.6875rem] leading-relaxed text-ink/50">
              <Icon name="phone" size={12} />
              We will call to confirm before dispatch. Pay the courier on delivery.
            </p>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  )
}
