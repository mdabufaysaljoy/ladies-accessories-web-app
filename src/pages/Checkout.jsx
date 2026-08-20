import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { EmptyState, PageHeader, usePageMeta } from '@/components/common/PageShell'
import { Logo } from '@/components/layout/Logo'
import { DISTRICTS } from '@/data/content'
import { useSettings } from '@/context/SettingsContext'
import { useAccount } from '@/context/AccountContext'
import { api, customerApi } from '@/lib/api'
import { getPixelIds, trackBeginCheckout } from '@/lib/tracking'

import { useStore } from '@/context/StoreContext'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { cx, isValidBdPhone, isValidEmail, taka } from '@/utils/format'

const STEPS = [
  { id: 1, label: 'Information' },
  { id: 2, label: 'Delivery' },
  { id: 3, label: 'Payment' },
]

const BLANK = {
  fullName: '',
  phone: '',
  altPhone: '',
  email: '',
  district: 'Dhaka',
  area: '',
  address: '',
  notes: '',
  giftNote: '',
  isGift: false,
  saveInfo: true,
}

/* ------------------------------ form fields ------------------------------ */

function Field({ label, error, hint, required, children, className = '' }) {
  return (
    <label className={cx('block', className)}>
      <span className="flex items-baseline justify-between">
        <span className="text-[0.8125rem] font-medium text-ink/70">
          {label}
          {required && <span className="ml-0.5 text-rose">*</span>}
        </span>
        {hint && <span className="text-[0.6875rem] text-ink/40">{hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-[0.75rem] text-red-600">
          <Icon name="alert" size={13} /> {error}
        </span>
      )}
    </label>
  )
}

const inputClass = (error) =>
  cx(
    'h-12 w-full rounded-xl border bg-cream px-4 text-[0.9375rem] outline-none transition-colors',
    'placeholder:text-ink/30',
    error ? 'border-red-400 focus:border-red-500' : 'border-ink/15 focus:border-ink',
  )

/* -------------------------------- summary -------------------------------- */

function OrderSummary({ collapsible = false }) {
  const { lines, totals, coupon, applyCoupon, removeCoupon } = useStore()
  const [open, setOpen] = useState(!collapsible)
  const [code, setCode] = useState('')
  const [publicCoupons, setPublicCoupons] = useState([])

  useEffect(() => {
    api.get('/coupons/public').then((d) => setPublicCoupons(d.coupons ?? [])).catch(() => {})
  }, [])

  return (
    <div className="rounded-[1.5rem] bg-sand p-6 lg:p-7">
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between lg:hidden"
        >
          <span className="flex items-center gap-2 text-[0.9375rem] font-medium">
            <Icon name="bag" size={17} />
            {open ? 'Hide' : 'Show'} order summary
            <Icon
              name="chevronDown"
              size={15}
              className={cx('transition-transform duration-300', open && 'rotate-180')}
            />
          </span>
          <span className="font-display text-xl">{taka(totals.total)}</span>
        </button>
      )}

      <div className={cx(collapsible && !open && 'hidden')}>
        <h2 className={cx('font-display text-xl', collapsible && 'mt-5 lg:mt-0')}>
          Order summary
          <span className="ml-2 text-[0.875rem] font-sans text-ink/45">({totals.itemCount})</span>
        </h2>

        <ul className="mt-5 space-y-4">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-3.5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream">
                <ProductArt product={line} decorative={false} />
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.625rem] font-bold text-cream">
                  {line.qty}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-medium">{line.name}</p>
                {(line.color || line.size) && (
                  <p className="truncate text-[0.75rem] text-ink/50">
                    {[line.color, line.size].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[0.875rem] font-medium">{taka(line.price * line.qty)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-ink/12 pt-5">
          {coupon ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-moss/10 px-3.5 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-[0.8125rem]">
                <Icon name="checkCircle" size={15} className="shrink-0 text-moss" />
                <strong className="font-semibold">{coupon.code}</strong>
                <span className="truncate text-ink/55">{coupon.label}</span>
              </span>
              <button
                type="button"
                onClick={removeCoupon}
                className="shrink-0 text-[0.75rem] text-ink/50 underline underline-offset-2"
              >
                Remove
              </button>
            </div>
          ) : (
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
                placeholder="Discount code"
                aria-label="Discount code"
                className="h-11 min-w-0 flex-1 rounded-xl border border-ink/15 bg-cream px-3.5 text-[0.875rem] uppercase outline-none focus:border-ink"
              />
              <Button type="submit" variant="outline" size="md">
                Apply
              </Button>
            </form>
          )}
          {!coupon && publicCoupons.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {publicCoupons.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCode(c.code)}
                  title={c.label}
                  className="rounded-full border border-dashed border-ink/25 px-2.5 py-1 text-[0.6875rem] text-ink/55 hover:border-plum hover:text-plum"
                >
                  {c.code}
                </button>
              ))}
            </div>
          )}
        </div>

        <dl className="mt-6 space-y-3 border-t border-ink/12 pt-5 text-[0.9375rem]">
          <div className="flex justify-between">
            <dt className="text-ink/60">Subtotal</dt>
            <dd className="font-medium">{taka(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-moss">
              <dt>Discount</dt>
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
        </dl>
      </div>
    </div>
  )
}

/* -------------------------------- checkout -------------------------------- */

export default function Checkout() {
  const navigate = useNavigate()
  const { lines, totals, coupon, zone, zoneId, setZoneId, clearCart, placeOrder, toast } = useStore()
  const { zones, delivery, isBn } = useSettings()
  const { customer: account, isSignedIn, defaultAddress } = useAccount()
  const [saved, setSaved] = useLocalStorage('gbs.customer', BLANK)
  const [saveAddress, setSaveAddress] = useState(true)
  const [methods, setMethods] = useState([])
  const [trxId, setTrxId] = useState('')

  const [form, setForm] = useState(() => ({ ...BLANK, ...saved }))
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState('cod')
  const [submitting, setSubmitting] = useState(false)
  const [agreed, setAgreed] = useState(false)

  usePageMeta('Checkout')

  /**
   * InitiateCheckout, once per visit to this page. `lines` is deliberately not
   * a dependency — editing quantities here should not re-fire the event and
   * inflate the funnel.
   */
  const checkoutTracked = useRef(false)
  useEffect(() => {
    if (checkoutTracked.current || lines.length === 0) return
    checkoutTracked.current = true
    trackBeginCheckout(lines, totals.total)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  /**
   * Fills the form from the signed-in account — name, phone, email, and the
   * default saved address. Everything stays fully editable afterwards; this
   * only seeds the initial values.
   *
   * `autofilledFor` guards it so it runs once per account/address rather than
   * on every render: without that, a customer editing a pre-filled field would
   * have their typing reverted on the next render pass.
   */
  const [autofilledFor, setAutofilledFor] = useState(null)

  useEffect(() => {
    if (!isSignedIn || !account) return

    const stamp = `${account.id}:${defaultAddress?.id ?? 'none'}`
    if (autofilledFor === stamp) return

    setForm((f) => ({
      ...f,
      fullName: account.name || f.fullName,
      phone: account.phone?.replace(/^88/, '') || f.phone,
      email: account.email || f.email,
      ...(defaultAddress
        ? {
            district: defaultAddress.district || f.district,
            area: defaultAddress.area || f.area,
            address: defaultAddress.address || f.address,
          }
        : {}),
    }))
    if (defaultAddress?.zoneId) setZoneId(defaultAddress.zoneId)
    setAutofilledFor(stamp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, account?.id, defaultAddress?.id, autofilledFor])

  useEffect(() => {
    api
      .get('/payments/methods')
      .then((d) => {
        setMethods(d.methods)
        if (d.methods.length && !d.methods.some((m) => m.id === method)) setMethod(d.methods[0].id)
      })
      .catch(() => setMethods([{ id: 'cod', name: 'Cash on Delivery', tagline: 'Pay the courier when your parcel arrives', badge: 'Most popular' }]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeMethod = methods.find((m) => m.id === method)
  const codAdvance =
    method === 'cod' && totals.total > (delivery.codAdvanceThreshold ?? 5000)
      ? (delivery.codAdvanceAmount ?? 200)
      : 0

  const validateStep1 = () => {
    const next = {}
    if (form.fullName.trim().length < 3) next.fullName = 'Please enter your full name'
    if (!isValidBdPhone(form.phone)) next.phone = 'Enter a valid Bangladeshi mobile number (01XXXXXXXXX)'
    if (form.altPhone && !isValidBdPhone(form.altPhone)) next.altPhone = 'This number does not look right'
    if (form.email && !isValidEmail(form.email)) next.email = 'Enter a valid email address'
    if (form.address.trim().length < 10)
      next.address = 'Please give a full address — house, road and area'
    if (!form.area.trim()) next.area = 'Which area or thana?'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const goNext = () => {
    if (step === 1 && !validateStep1()) {
      toast('Please fix the highlighted fields', { kind: 'error' })
      return
    }
    setStep((s) => Math.min(3, s + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * The server recomputes every price, discount and delivery charge from the
   * database — what we send here is intent, not authority. That is deliberate:
   * a browser can be edited, a server-side total cannot.
   */
  const submit = async () => {
    if (!agreed) {
      toast('Please accept the terms to place your order', { kind: 'error' })
      return
    }
    if (!validateStep1()) {
      setStep(1)
      toast('Some delivery details need fixing', { kind: 'error' })
      return
    }
    if (activeMethod?.requiresTransactionId && trxId.trim().length < 6) {
      toast('Please enter the transaction ID from your payment SMS', { kind: 'error' })
      return
    }

    setSubmitting(true)
    if (form.saveInfo) setSaved({ ...form, notes: '', giftNote: '' })

    try {
      const { order } = await customerApi.post('/orders', {
        customer: {
          name: form.fullName.trim(),
          phone: form.phone.trim(),
          altPhone: form.altPhone.trim(),
          email: form.email.trim(),
          district: form.district,
          area: form.area.trim(),
          address: form.address.trim(),
          notes: form.notes.trim(),
          isGift: form.isGift,
          giftNote: form.isGift ? form.giftNote.trim() : '',
        },
        lines: lines.map((l) => ({ productId: l.id, slug: l.slug, qty: l.qty, color: l.color, size: l.size })),
        zoneId,
        couponCode: coupon?.code,
        payment: { method, transactionId: trxId.trim() },
        source: 'web',
        saveAddress: isSignedIn && saveAddress,
        /**
         * Meta's browser cookies, handed over explicitly. They are first-party
         * to the storefront, so on the split-domain deploy the API host never
         * sees them — without this the server-side Purchase has almost nothing
         * to match a shopper on.
         */
        tracking: { ...getPixelIds(), sourceUrl: window.location.href },
      })

      // Redirect-based gateways hand off to the provider; everything else is done.
      if (method === 'sslcommerz' || method === 'bkash') {
        const endpoint = method === 'sslcommerz' ? '/payments/sslcommerz/init' : '/payments/bkash/create'
        const session = await api.post(endpoint, { orderNumber: order.orderNumber })
        clearCart()
        window.location.href = session.gatewayUrl
        return
      }

      placeOrder(order)
      navigate(`/order/${order.orderNumber}`, { replace: true })
    } catch (error) {
      setSubmitting(false)
      toast(error.message ?? 'Could not place your order. Please try again.', { kind: 'error' })
    }
  }

  const summaryLines = useMemo(() => lines.length, [lines])

  if (summaryLines === 0) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Checkout' }]} title="Checkout" tone="plain" />
        <EmptyState
          title="Your bag is empty"
          body="Add something to your bag before checking out."
          action="Browse products"
          actionTo="/shop"
        />
      </>
    )
  }

  return (
    <div className="bg-cream">
      {/* focused checkout header — no nav distractions */}
      <div className="border-b border-ink/8">
        <div className="container-x flex items-center justify-between py-5">
          <Logo />
          <Link
            to="/cart"
            className="flex items-center gap-2 text-[0.8125rem] text-ink/55 hover:text-ink"
          >
            <Icon name="bag" size={16} /> Back to bag
          </Link>
        </div>
      </div>

      <div className="container-x py-8 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
          <div className="min-w-0">
            {/* stepper */}
            <ol className="flex items-center gap-2">
              {STEPS.map((s, i) => {
                const done = step > s.id
                const active = step === s.id
                return (
                  <li key={s.id} className="flex flex-1 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => s.id < step && setStep(s.id)}
                      disabled={s.id > step}
                      className={cx(
                        'flex items-center gap-2.5 text-left transition-colors',
                        s.id < step && 'cursor-pointer hover:text-plum',
                      )}
                    >
                      <span
                        className={cx(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.8125rem] font-semibold transition-all duration-300',
                          done
                            ? 'bg-moss text-white'
                            : active
                              ? 'bg-ink text-cream'
                              : 'border border-ink/20 text-ink/35',
                        )}
                      >
                        {done ? <Icon name="check" size={15} strokeWidth={2.5} /> : s.id}
                      </span>
                      <span
                        className={cx(
                          'hidden text-[0.875rem] font-medium sm:block',
                          active ? 'text-ink' : 'text-ink/45',
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <span
                        className={cx(
                          'h-px flex-1 transition-colors duration-500',
                          step > s.id ? 'bg-moss' : 'bg-ink/12',
                        )}
                      />
                    )}
                  </li>
                )
              })}
            </ol>

            {/* mobile summary */}
            <div className="mt-8 lg:hidden">
              <OrderSummary collapsible />
            </div>

            {/* ------------------------------ step 1 ------------------------------ */}
            {step === 1 && (
              <section className="mt-9 animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
                <h1 className="text-[1.75rem] leading-tight">Delivery information</h1>
                <p className="mt-2 text-[0.9375rem] text-ink/60">
                  We will call this number before dispatching your parcel.
                </p>

                {/* Accounts are optional — this is a convenience, never a gate. */}
                {isSignedIn ? (
                  <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-moss/10 px-4 py-3">
                    <Icon name="checkCircle" size={17} className="shrink-0 text-moss" />
                    <p className="min-w-0 flex-1 text-[0.8125rem] text-ink/75">
                      Signed in as <strong className="font-semibold">{account.name}</strong>
                      {defaultAddress ? ' — your saved address is filled in below.' : '.'}
                    </p>
                    {account.addresses.length > 1 && (
                      <select
                        onChange={(e) => {
                          const a = account.addresses.find((x) => x.id === e.target.value)
                          if (!a) return
                          setForm((f) => ({
                            ...f,
                            district: a.district || f.district,
                            area: a.area ?? '',
                            address: a.address ?? '',
                          }))
                          if (a.zoneId) setZoneId(a.zoneId)
                        }}
                        defaultValue={defaultAddress?.id}
                        className="h-9 rounded-lg border border-ink/15 bg-cream px-3 text-[0.8125rem]"
                      >
                        {account.addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label} — {a.area}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <p className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-sand px-4 py-3 text-[0.8125rem] text-ink/70">
                    <Icon name="user" size={16} className="shrink-0 text-ink/40" />
                    Have an account?
                    <Link to="/login" state={{ from: '/checkout' }} className="font-medium text-plum underline underline-offset-2">
                      Sign in
                    </Link>
                    to fill this in automatically — or just carry on as a guest.
                  </p>
                )}

                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" required error={errors.fullName} className="sm:col-span-2">
                    <input
                      value={form.fullName}
                      onChange={set('fullName')}
                      placeholder="e.g. Nusrat Jahan"
                      autoComplete="name"
                      className={inputClass(errors.fullName)}
                    />
                  </Field>

                  <Field label="Mobile number" required error={errors.phone}>
                    <input
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="01XXXXXXXXX"
                      inputMode="tel"
                      autoComplete="tel"
                      className={inputClass(errors.phone)}
                    />
                  </Field>

                  <Field label="Alternative number" hint="Optional" error={errors.altPhone}>
                    <input
                      value={form.altPhone}
                      onChange={set('altPhone')}
                      placeholder="01XXXXXXXXX"
                      inputMode="tel"
                      className={inputClass(errors.altPhone)}
                    />
                  </Field>

                  <Field
                    label="Email"
                    hint="Optional — for the receipt"
                    error={errors.email}
                    className="sm:col-span-2"
                  >
                    <input
                      value={form.email}
                      onChange={set('email')}
                      type="email"
                      placeholder="you@email.com"
                      autoComplete="email"
                      className={inputClass(errors.email)}
                    />
                  </Field>

                  <Field label="District" required>
                    <select
                      value={form.district}
                      onChange={set('district')}
                      className={cx(inputClass(false), 'cursor-pointer')}
                    >
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Area / Thana" required error={errors.area}>
                    <input
                      value={form.area}
                      onChange={set('area')}
                      placeholder="e.g. Dhanmondi"
                      className={inputClass(errors.area)}
                    />
                  </Field>

                  <Field
                    label="Full address"
                    required
                    error={errors.address}
                    hint="House, road, block"
                    className="sm:col-span-2"
                  >
                    <textarea
                      value={form.address}
                      onChange={set('address')}
                      rows={3}
                      placeholder="House 42, Road 11, Block C — beside the mosque"
                      autoComplete="street-address"
                      className={cx(inputClass(errors.address), 'h-auto resize-none py-3.5')}
                    />
                  </Field>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.saveInfo}
                      onChange={set('saveInfo')}
                      className="peer sr-only"
                    />
                    <span
                      className={cx(
                        'grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-[0.3rem] border transition-all',
                        form.saveInfo ? 'border-ink bg-ink text-cream' : 'border-ink/25',
                      )}
                    >
                      {form.saveInfo && <Icon name="check" size={12} strokeWidth={3} />}
                    </span>
                    <span className="text-[0.875rem] text-ink/70">
                      Save this information for next time (stored on this device only)
                    </span>
                  </label>

                  {isSignedIn && (
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        className={cx(
                          'grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-[0.3rem] border transition-all',
                          saveAddress ? 'border-ink bg-ink text-cream' : 'border-ink/25',
                        )}
                      >
                        {saveAddress && <Icon name="check" size={12} strokeWidth={3} />}
                      </span>
                      <span className="text-[0.875rem] text-ink/70">
                        Also save this address to my account
                      </span>
                    </label>
                  )}
                </div>

                <div className="mt-9 flex flex-wrap gap-3">
                  <Button size="lg" onClick={goNext}>
                    Continue to delivery <Icon name="arrowRight" size={17} />
                  </Button>
                  <Button to="/cart" variant="ghost" size="lg">
                    Back to bag
                  </Button>
                </div>
              </section>
            )}

            {/* ------------------------------ step 2 ------------------------------ */}
            {step === 2 && (
              <section className="mt-9 animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
                <h1 className="text-[1.75rem] leading-tight">Delivery method</h1>
                <p className="mt-2 text-[0.9375rem] text-ink/60">
                  Delivering to{' '}
                  <strong className="font-medium text-ink">
                    {form.area}, {form.district}
                  </strong>
                  .{' '}
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="underline underline-offset-2 hover:text-plum"
                  >
                    Change
                  </button>
                </p>

                <div className="mt-7 space-y-3">
                  {zones.map((z) => {
                    const active = zoneId === z.id
                    const free = totals.qualifiesFreeShipping
                    return (
                      <label
                        key={z.id}
                        className={cx(
                          'flex cursor-pointer items-center gap-4 rounded-2xl border p-5 transition-all duration-300',
                          active ? 'border-ink bg-sand shadow-soft' : 'border-ink/15 hover:border-ink/40',
                        )}
                      >
                        <input
                          type="radio"
                          name="zone"
                          checked={active}
                          onChange={() => setZoneId(z.id)}
                          className="sr-only"
                        />
                        <span
                          className={cx(
                            'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
                            active ? 'border-ink' : 'border-ink/25',
                          )}
                        >
                          {active && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.9375rem] font-medium">
                            {isBn && z.labelBn ? z.labelBn : z.label}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] text-ink/55">
                            <Icon name="clock" size={13} /> {isBn && z.etaBn ? z.etaBn : z.eta}
                          </span>
                        </span>
                        <span className="shrink-0 text-[0.9375rem] font-semibold">
                          {free ? <span className="text-moss">Free</span> : taka(z.charge)}
                        </span>
                      </label>
                    )
                  })}
                </div>

                {totals.qualifiesFreeShipping && (
                  <p className="mt-4 flex items-center gap-2 rounded-xl bg-moss/10 px-4 py-3 text-[0.875rem] text-moss">
                    <Icon name="checkCircle" size={17} className="shrink-0" />
                    Your order qualifies for free delivery.
                  </p>
                )}

                <div className="mt-8 space-y-5">
                  <Field label="Delivery notes" hint="Optional">
                    <textarea
                      value={form.notes}
                      onChange={set('notes')}
                      rows={2}
                      placeholder="Landmark, preferred delivery time, or anything the courier should know"
                      className={cx(inputClass(false), 'h-auto resize-none py-3.5')}
                    />
                  </Field>

                  <div className="rounded-2xl border border-ink/15 p-5">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={form.isGift}
                        onChange={set('isGift')}
                        className="sr-only"
                      />
                      <span
                        className={cx(
                          'grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-[0.3rem] border transition-all',
                          form.isGift ? 'border-ink bg-ink text-cream' : 'border-ink/25',
                        )}
                      >
                        {form.isGift && <Icon name="check" size={12} strokeWidth={3} />}
                      </span>
                      <span className="flex items-center gap-2 text-[0.9375rem] font-medium">
                        <Icon name="gift" size={17} className="text-plum" />
                        This is a gift
                      </span>
                      <span className="ml-auto text-[0.75rem] text-ink/45">Free wrapping</span>
                    </label>

                    <div
                      className={cx(
                        'grid transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
                        form.isGift ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                      )}
                    >
                      <div className="overflow-hidden">
                        <textarea
                          value={form.giftNote}
                          onChange={set('giftNote')}
                          rows={2}
                          maxLength={200}
                          placeholder="Write the message we should hand-write on the card…"
                          className={cx(inputClass(false), 'h-auto resize-none py-3.5')}
                        />
                        <p className="mt-1.5 text-right text-[0.6875rem] text-ink/40">
                          {form.giftNote.length}/200 — the price is hidden on gift orders
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-9 flex flex-wrap gap-3">
                  <Button size="lg" onClick={goNext}>
                    Continue to payment <Icon name="arrowRight" size={17} />
                  </Button>
                  <Button variant="ghost" size="lg" onClick={() => setStep(1)}>
                    Back
                  </Button>
                </div>
              </section>
            )}

            {/* ------------------------------ step 3 ------------------------------ */}
            {step === 3 && (
              <section className="mt-9 animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
                <h1 className="text-[1.75rem] leading-tight">Payment</h1>
                <p className="mt-2 text-[0.9375rem] text-ink/60">
                  All transactions are encrypted. We never store your card or wallet details.
                </p>

                <div className="mt-7 space-y-3">
                  {methods.map((m) => {
                    const active = method === m.id
                    return (
                      <div
                        key={m.id}
                        className={cx(
                          'overflow-hidden rounded-2xl border transition-all duration-300',
                          active ? 'border-ink bg-sand shadow-soft' : 'border-ink/15 hover:border-ink/40',
                        )}
                      >
                        <label className="flex cursor-pointer items-start gap-4 p-5">
                          <input
                            type="radio"
                            name="payment"
                            checked={active}
                            onChange={() => setMethod(m.id)}
                            className="sr-only"
                          />
                          <span
                            className={cx(
                              'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
                              active ? 'border-ink' : 'border-ink/25',
                            )}
                          >
                            {active && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[0.9375rem] font-semibold">
                                {isBn && m.nameBn ? m.nameBn : m.name}
                              </span>
                              {m.badge && (
                                <span className="rounded-full bg-blush px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-plum">
                                  {m.badge}
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block text-[0.8125rem] text-ink/60">
                              {isBn && m.taglineBn ? m.taglineBn : m.tagline}
                            </span>
                          </span>
                          <Icon
                            name={m.id === 'cod' ? 'cash' : 'lock'}
                            size={20}
                            className="shrink-0 text-ink/35"
                          />
                        </label>

                        <div
                          className={cx(
                            'grid transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
                            active ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                          )}
                        >
                          <div className="overflow-hidden">
                            <div className="border-t border-ink/10 px-5 py-4">
                              {m.detail && (
                                <p className="text-[0.8125rem] leading-relaxed text-ink/60">{m.detail}</p>
                              )}

                              {/* Manual wallet payment — the dominant flow for small BD shops */}
                              {m.requiresTransactionId && (
                                <div className="mt-4 space-y-3">
                                  <div className="flex items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3">
                                    <div>
                                      <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-ink/45">
                                        {m.id === 'bkash-manual' ? 'bKash' : 'Nagad'} · {m.accountType ?? 'personal'}
                                      </p>
                                      <p className="mt-0.5 font-mono text-lg font-semibold">{m.number}</p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(m.number)
                                        toast('Number copied', { kind: 'success' })
                                      }}
                                    >
                                      Copy
                                    </Button>
                                  </div>

                                  <ol className="space-y-1.5 text-[0.8125rem] text-ink/65">
                                    <li>1. Send <strong className="font-semibold text-ink">{taka(totals.total)}</strong> to the number above</li>
                                    <li>2. Copy the TrxID from the confirmation SMS</li>
                                    <li>3. Paste it below and place your order</li>
                                  </ol>

                                  <Field label="Transaction ID (TrxID)" required>
                                    <input
                                      value={trxId}
                                      onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                                      placeholder="8N7A2K9XYZ"
                                      className={inputClass(false)}
                                    />
                                  </Field>

                                  <p className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-ink/55">
                                    <Icon name="info" size={13} className="mt-0.5 shrink-0 text-plum" />
                                    We verify every TrxID before dispatch. If it does not match we will
                                    call you — nothing is lost.
                                  </p>
                                </div>
                              )}

                              {m.id === 'cod' && codAdvance > 0 && (
                                <p className="mt-3 flex items-start gap-2 rounded-xl bg-gold/12 px-3.5 py-2.5 text-[0.8125rem] text-ink/75">
                                  <Icon name="info" size={15} className="mt-0.5 shrink-0 text-gold" />
                                  Orders above {taka(delivery.codAdvanceThreshold)} need a {taka(codAdvance)} advance
                                  to confirm. We will send a bKash number after you place the order, and it is
                                  deducted from your total.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* review */}
                <div className="mt-8 rounded-2xl border border-ink/12 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[0.9375rem] font-semibold">Delivering to</h2>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[0.75rem] font-medium text-plum underline underline-offset-2"
                    >
                      Edit
                    </button>
                  </div>
                  <address className="mt-2.5 text-[0.875rem] not-italic leading-relaxed text-ink/65">
                    <strong className="font-medium text-ink">{form.fullName}</strong>
                    <br />
                    {form.address}
                    <br />
                    {form.area}, {form.district}
                    <br />
                    {form.phone}
                    {form.altPhone && ` · ${form.altPhone}`}
                  </address>
                  <p className="mt-3 flex items-center gap-2 border-t border-ink/10 pt-3 text-[0.8125rem] text-ink/60">
                    <Icon name="truck" size={15} className="shrink-0 text-ink/40" />
                    {zone.label} · {zone.eta} ·{' '}
                    {totals.shipping === 0 ? 'Free delivery' : taka(totals.shipping)}
                  </p>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={cx(
                      'mt-0.5 grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-[0.3rem] border transition-all',
                      agreed ? 'border-ink bg-ink text-cream' : 'border-ink/25',
                    )}
                  >
                    {agreed && <Icon name="check" size={12} strokeWidth={3} />}
                  </span>
                  <span className="text-[0.8125rem] leading-relaxed text-ink/65">
                    I agree to the{' '}
                    <Link to="/policy/terms" className="underline underline-offset-2 hover:text-plum">
                      terms of service
                    </Link>{' '}
                    and the{' '}
                    <Link to="/policy/returns" className="underline underline-offset-2 hover:text-plum">
                      return policy
                    </Link>
                    . I confirm the delivery details above are correct.
                  </span>
                </label>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button size="lg" onClick={submit} loading={submitting} disabled={submitting}>
                    {method === 'sslcommerz' || method === 'bkash' ? (
                      <>
                        <Icon name="lock" size={17} /> Pay {taka(totals.total)} securely
                      </>
                    ) : (
                      <>Place order · {taka(totals.total)}</>
                    )}
                  </Button>
                  <Button variant="ghost" size="lg" onClick={() => setStep(2)} disabled={submitting}>
                    Back
                  </Button>
                </div>

              </section>
            )}
          </div>

          {/* desktop summary */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <OrderSummary />
              <ul className="mt-5 space-y-2.5 px-2 text-[0.75rem] text-ink/55">
                <li className="flex items-center gap-2">
                  <Icon name="lock" size={14} className="shrink-0 text-ink/40" />
                  256-bit encrypted checkout via SSLCommerz
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="shield" size={14} className="shrink-0 text-ink/40" />
                  100% authentic products, guaranteed
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="phone" size={14} className="shrink-0 text-ink/40" />
                  We call before every dispatch
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
