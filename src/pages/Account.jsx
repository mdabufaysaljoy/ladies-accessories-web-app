import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useAccount, request } from '@/context/AccountContext'
import { API_BASE } from '@/lib/api'
import { useSettings } from '@/context/SettingsContext'
import { MyReviews } from '@/components/review/MyReviews'
import { DISTRICTS } from '@/data/content'
import { cx, formatDate, isValidBdPhone, sanitisePhoneInput, taka } from '@/utils/format'

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
  'h-11 w-full rounded-xl border border-ink/15 bg-cream px-4 text-[0.9375rem] outline-none transition-colors focus:border-ink'

function AddressForm({ initial, zones, defaults, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    label: 'Home',
    name: defaults?.name ?? '',
    phone: defaults?.phone ?? '',
    district: 'Dhaka',
    area: '',
    address: '',
    zoneId: zones[0]?.id ?? 'dhaka-city',
    ...initial,
  }))
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')

  /** Phone boxes hold digits only; the shape is still checked on submit. */
  const set = (k) => (e) => {
    const value = /phone/i.test(k) ? sanitisePhoneInput(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [k]: value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
    setServerError('')
  }

  // The zone list arrives from settings asynchronously — once it lands, adopt
  // the first zone rather than leaving zoneId undefined from the initial render.
  useEffect(() => {
    if (!form.zoneId && zones.length) setForm((f) => ({ ...f, zoneId: zones[0].id }))
  }, [zones, form.zoneId])

  const submit = async (e) => {
    e.preventDefault()

    // Mirrors the server's rules so the customer sees the problem inline
    // instead of the form silently doing nothing.
    const next = {}
    if (String(form.address).trim().length < 10) {
      next.address = 'Please write the full address — house, road and area'
    }
    if (!String(form.area).trim()) next.area = 'Which area or thana?'
    if (form.phone && !isValidBdPhone(form.phone)) next.phone = 'Enter a valid number (01XXXXXXXXX)'

    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    setServerError('')
    try {
      await onSave(form)
    } catch (err) {
      // Without this the rejection is swallowed and the button just spins back
      // to idle with no explanation — the original bug.
      setServerError(err.message ?? 'Could not save this address. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const fieldError = (key) =>
    errors[key] ? (
      <span className="mt-1 block text-[0.75rem] text-red-600">{errors[key]}</span>
    ) : null

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-ink/12 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[0.75rem] font-medium text-ink/60">Label</span>
          <input value={form.label} onChange={set('label')} placeholder="Home / Office" className={cx('mt-1', inputClass)} />
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-medium text-ink/60">Recipient name</span>
          <input value={form.name} onChange={set('name')} placeholder="Full name" className={cx('mt-1', inputClass)} />
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-medium text-ink/60">Mobile number</span>
          <input
            value={form.phone}
            onChange={set('phone')}
            placeholder="01XXXXXXXXX"
            inputMode="tel"
            className={cx('mt-1', inputClass, errors.phone && 'border-red-400')}
          />
          {fieldError('phone')}
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-medium text-ink/60">
            Area / Thana <span className="text-rose">*</span>
          </span>
          <input
            value={form.area}
            onChange={set('area')}
            placeholder="e.g. Dhanmondi"
            className={cx('mt-1', inputClass, errors.area && 'border-red-400')}
          />
          {fieldError('area')}
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-medium text-ink/60">District</span>
          <select value={form.district} onChange={set('district')} className={cx('mt-1', inputClass, 'cursor-pointer')}>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-medium text-ink/60">Delivery area</span>
          <select value={form.zoneId ?? ''} onChange={set('zoneId')} className={cx('mt-1', inputClass, 'cursor-pointer')}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label} — {taka(z.charge)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-[0.75rem] font-medium text-ink/60">
          Full address <span className="text-rose">*</span>
        </span>
        <textarea
          value={form.address}
          onChange={set('address')}
          rows={2}
          placeholder="House 12, Road 5, Block C — beside the mosque"
          className={cx('mt-1', inputClass, 'h-auto resize-none py-3', errors.address && 'border-red-400')}
        />
        {fieldError('address')}
      </label>

      {serverError && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[0.8125rem] text-red-700">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          {serverError}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="md" loading={busy}>
          Save address
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function Account() {
  const { customer, loading, isSignedIn, logout, addAddress, updateAddress, removeAddress, updateProfile } = useAccount()
  const { zones } = useSettings()
  const navigate = useNavigate()

  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')

  usePageMeta('My account')

  useEffect(() => {
    if (!loading && !isSignedIn) navigate('/login', { replace: true, state: { from: '/account' } })
  }, [loading, isSignedIn, navigate])

  const loadOrders = useCallback(async () => {
    try {
      const data = await request('/account/orders')
      setOrders(data.orders)
    } catch {
      setOrders([])
    }
  }, [])

  useEffect(() => {
    if (isSignedIn) loadOrders()
  }, [isSignedIn, loadOrders])

  if (loading || !customer) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ink/15 border-t-plum" />
      </div>
    )
  }

  const flash = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'My account' }]}
        eyebrow={`Hello, ${customer.name?.split(' ')[0] ?? 'there'}`}
        title="My account"
        lead={`${customer.orderCount} ${customer.orderCount === 1 ? 'order' : 'orders'} · ${taka(customer.totalSpent)} lifetime`}
      >
        <div className="mt-8 flex flex-wrap gap-2">
          {[
            { id: 'orders', label: 'My orders' },
            { id: 'reviews', label: 'My reviews' },
            { id: 'addresses', label: 'Saved addresses' },
            { id: 'profile', label: 'Profile' },
          ].map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setTab(x.id)}
              className={cx(
                'rounded-full px-4 py-2 text-[0.8125rem] font-medium transition-colors',
                tab === x.id ? 'bg-ink text-cream' : 'border border-ink/15 hover:border-ink',
              )}
            >
              {x.label}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              await logout()
              navigate('/')
            }}
            className="ml-auto rounded-full px-4 py-2 text-[0.8125rem] font-medium text-ink/55 hover:text-red-600"
          >
            Sign out
          </button>
        </div>
      </PageHeader>

      <div className="container-x py-12 md:py-16">
        {notice && (
          <p className="mb-6 flex items-center gap-2 rounded-xl bg-moss/10 px-4 py-3 text-[0.875rem] text-moss">
            <Icon name="checkCircle" size={16} /> {notice}
          </p>
        )}

        {/* ------------------------------ orders ------------------------------ */}
        {tab === 'orders' && (
          <div className="mx-auto max-w-3xl">
            {!orders ? (
              <div className="py-16 text-center text-ink/45">Loading your orders…</div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl bg-sand p-10 text-center">
                <p className="font-display text-xl">No orders yet</p>
                <p className="mt-2 text-[0.875rem] text-ink/55">Everything you order will show up here.</p>
                <Button to="/shop" className="mt-5">
                  Start shopping
                </Button>
              </div>
            ) : (
              <ul className="space-y-4">
                {orders.map((o) => (
                  <li key={o._id} className="overflow-hidden rounded-2xl border border-ink/12">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-sand px-5 py-3.5">
                      <div>
                        <p className="font-mono text-[0.875rem] font-semibold">{o.orderNumber}</p>
                        <p className="text-[0.75rem] text-ink/50">
                          {formatDate(o.createdAt)} · {o.lines.reduce((n, l) => n + l.qty, 0)} items
                          {o.invoice?.number && ` · ${o.invoice.number}`}
                        </p>
                      </div>
                      <span
                        className={cx(
                          'rounded-full px-3 py-1 text-[0.6875rem] font-semibold capitalize',
                          STATUS_TONE[o.status] ?? 'bg-ink/8 text-ink/70',
                        )}
                      >
                        {o.status}
                      </span>
                    </div>

                    <div className="px-5 py-4">
                      <ul className="space-y-1.5 text-[0.875rem] text-ink/70">
                        {o.lines.slice(0, 3).map((l, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="truncate">
                              {l.name} <span className="text-ink/40">×{l.qty}</span>
                            </span>
                            <span className="shrink-0">{taka(l.price * l.qty)}</span>
                          </li>
                        ))}
                        {o.lines.length > 3 && (
                          <li className="text-[0.75rem] text-ink/45">+{o.lines.length - 3} more</li>
                        )}
                      </ul>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-3.5">
                        <span className="font-display text-lg">{taka(o.totals.total)}</span>
                        <div className="flex gap-2">
                          <Button
                            href={`${API_BASE}/orders/${o.orderNumber}/invoice?phone=${encodeURIComponent(customer.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outline"
                            size="sm"
                          >
                            Invoice
                          </Button>
                          <Button to={`/track-order?order=${o.orderNumber}`} size="sm">
                            Track
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ----------------------------- addresses ---------------------------- */}
        {/* ------------------------------ reviews ----------------------------- */}
        {tab === 'reviews' && (
          <div className="mx-auto max-w-3xl">
            <MyReviews />
          </div>
        )}

        {tab === 'addresses' && (
          <div className="mx-auto max-w-2xl space-y-4">
            {customer.addresses.length === 0 && !showForm && (
              <div className="rounded-2xl bg-sand p-10 text-center">
                <p className="font-display text-xl">No saved addresses</p>
                <p className="mt-2 text-[0.875rem] text-ink/55">
                  Save one and it will fill in automatically at checkout.
                </p>
              </div>
            )}

            {customer.addresses.map((a) =>
              editing === a.id ? (
                <AddressForm
                  key={a.id}
                  initial={a}
                  zones={zones}
                  onCancel={() => setEditing(null)}
                  onSave={async (form) => {
                    await updateAddress(a.id, form)
                    setEditing(null)
                    flash('Address updated')
                  }}
                />
              ) : (
                <div key={a.id} className="flex items-start gap-4 rounded-2xl border border-ink/12 p-5">
                  <Icon name="pin" size={18} className="mt-0.5 shrink-0 text-ink/35" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[0.9375rem] font-medium">
                      {a.label}
                      {a.isDefault && (
                        <span className="rounded-full bg-moss/12 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-moss">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[0.875rem] leading-relaxed text-ink/65">
                      {a.address}
                      <br />
                      {[a.area, a.district].filter(Boolean).join(', ')}
                      {a.phone && <> · {a.phone}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(a.id)}>
                      Edit
                    </Button>
                    {!a.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await updateAddress(a.id, { isDefault: true })
                          flash('Default address updated')
                        }}
                      >
                        Make default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={async () => {
                        await removeAddress(a.id)
                        flash('Address removed')
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ),
            )}

            {showForm ? (
              <AddressForm
                zones={zones}
                defaults={{ name: customer.name, phone: customer.phone?.replace(/^88/, '') }}
                onCancel={() => setShowForm(false)}
                onSave={async (form) => {
                  // Errors propagate to AddressForm, which shows them inline.
                  await addAddress(form)
                  setShowForm(false)
                  flash('Address saved')
                }}
              />
            ) : (
              <Button variant="outline" onClick={() => setShowForm(true)}>
                <Icon name="plus" size={16} /> Add an address
              </Button>
            )}
          </div>
        )}

        {/* ------------------------------ profile ----------------------------- */}
        {tab === 'profile' && (
          <div className="mx-auto max-w-md">
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                await updateProfile({
                  name: fd.get('name'),
                  email: fd.get('email'),
                  acceptsMarketing: fd.get('acceptsMarketing') === 'on',
                })
                flash('Profile updated')
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="text-[0.8125rem] font-medium text-ink/70">Full name</span>
                <input name="name" defaultValue={customer.name} className={cx('mt-1.5', inputClass)} />
              </label>
              <label className="block">
                <span className="text-[0.8125rem] font-medium text-ink/70">Email</span>
                <input name="email" type="email" defaultValue={customer.email ?? ''} className={cx('mt-1.5', inputClass)} />
              </label>
              <label className="block">
                <span className="text-[0.8125rem] font-medium text-ink/70">Mobile number</span>
                <input value={customer.phone} disabled className={cx('mt-1.5', inputClass, 'bg-sand text-ink/50')} />
                <span className="mt-1 block text-[0.75rem] text-ink/45">
                  Your number is your account ID — message us to change it.
                </span>
              </label>
              <label className="flex items-center gap-2.5">
                <input type="checkbox" name="acceptsMarketing" defaultChecked={customer.acceptsMarketing} />
                <span className="text-[0.875rem]">Email me about new products and offers</span>
              </label>
              <Button type="submit" size="lg">
                Save changes
              </Button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}
