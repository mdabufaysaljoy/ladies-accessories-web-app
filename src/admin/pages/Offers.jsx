import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, ConfirmDialog, EmptyRow, Field, Input, NumberInput,
  Modal, Select, Spinner, Textarea, Toggle, useToasts,
} from '../components/ui'
import { MediaPicker } from '../components/ImageManager'
import { Icon } from '@/components/ui/Icon'
import { ProductArt, ART_SHAPE_OPTIONS } from '@/components/product/ProductArt'
import { useSettings } from '@/context/SettingsContext'
import { cx } from '@/utils/format'

const BLANK = {
  eyebrow: '',
  title: '',
  body: '',
  ctaLabel: 'Shop now', ctaHref: '/shop',
  badge: '',
  layout: 'compact',
  theme: 'plum',
  imageUrl: '',
  art: { shape: 'giftbox', hue: 330 },
  countdownEnabled: false,
  endsAt: '',
  enabled: true,
  order: 0,
}

const THEME_SWATCH = {
  plum: 'bg-plum', ink: 'bg-ink', sand: 'bg-sand border border-ink/15', blush: 'bg-blush border border-ink/15',
}

/** Local datetime string for <input type="datetime-local">. */
const toLocalInput = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Offers() {
  const [promos, setPromos] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editIndex, setEditIndex] = useState(-1)
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const { push, node } = useToasts()
  const { reload } = useSettings()

  const load = useCallback(async () => {
    try {
      const { settings } = await adminApi.get('/settings/admin')
      setPromos({
        enabled: settings.promotions?.enabled ?? true,
        heading: settings.promotions?.heading ?? '',
        subheading: settings.promotions?.subheading ?? '',
        offers: settings.promotions?.offers ?? [],
      })
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const persist = async (next, message) => {
    setSaving(true)
    try {
      await adminApi.patch('/settings', { promotions: next })
      setPromos(next)
      await reload()
      push(message ?? 'Offers saved')
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!promos) return <Spinner className="min-h-[60vh]" />

  const saveOffer = (offer) => {
    const cleaned = { ...offer, endsAt: offer.endsAt ? new Date(offer.endsAt).toISOString() : null }
    const offers =
      editIndex >= 0
        ? promos.offers.map((o, i) => (i === editIndex ? cleaned : o))
        : [...promos.offers, { ...cleaned, order: promos.offers.length }]

    persist({ ...promos, offers }, editIndex >= 0 ? 'Offer updated' : 'Offer created')
    setEditing(null)
    setEditIndex(-1)
  }

  const move = (from, to) => {
    if (to < 0 || to >= promos.offers.length) return
    const offers = [...promos.offers]
    const [item] = offers.splice(from, 1)
    offers.splice(to, 0, item)
    persist({ ...promos, offers: offers.map((o, i) => ({ ...o, order: i })) }, 'Order updated')
  }

  const liveCount = promos.offers.filter((o) => o.enabled !== false).length

  return (
    <AdminPage
      title="Offers"
      subtitle="The limited-time offers band on your home page"
      actions={
        <>
          <Btn as="a" href="/" target="_blank" rel="noopener noreferrer" size="md">
            <Icon name="arrowUpRight" size={14} /> View home page
          </Btn>
          <Btn
            variant="primary"
            size="md"
            onClick={() => {
              setEditing({ ...BLANK })
              setEditIndex(-1)
            }}
          >
            <Icon name="plus" size={15} /> New offer
          </Btn>
        </>
      }
    >
      {node}

      <Card
        title="Section visibility"
        description="Turn the whole offers band on or off without deleting anything"
        className="mb-4"
      >
        <Toggle
          checked={promos.enabled}
          onChange={(v) => persist({ ...promos, enabled: v }, v ? 'Offers section is now visible' : 'Offers section hidden')}
          label="Show the offers section on the home page"
          description={
            promos.enabled
              ? `${liveCount} ${liveCount === 1 ? 'offer is' : 'offers are'} live right now`
              : 'Customers cannot see any offers'
          }
          disabled={saving}
        />

        <div className="mt-5 grid gap-4 border-t border-ink/8 pt-5 sm:grid-cols-2">
          <Field label="Section heading" hint="Leave blank to hide the heading">
            <Input
              value={promos.heading}
              onChange={(e) => setPromos((p) => ({ ...p, heading: e.target.value }))}
              onBlur={() => persist(promos)}
              placeholder="Limited time offers"
            />
          </Field>
          <Field label="Sub-heading" className="sm:col-span-2">
            <Input
              value={promos.subheading}
              onChange={(e) => setPromos((p) => ({ ...p, subheading: e.target.value }))}
              onBlur={() => persist(promos)}
              placeholder="Ends when the timer does — no extensions."
            />
          </Field>
        </div>
      </Card>

      {promos.offers.length === 0 ? (
        <Card>
          <EmptyRow
            icon="gift"
            title="No offers yet"
            body="Create one to fill the offers band on your home page."
            action={
              <Btn variant="primary" onClick={() => { setEditing({ ...BLANK }); setEditIndex(-1) }}>
                New offer
              </Btn>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {promos.offers.map((offer, i) => {
            const expired = offer.countdownEnabled && offer.endsAt && new Date(offer.endsAt) <= Date.now()
            return (
              <Card key={i} padded={false}>
                <div className="flex gap-4 p-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sand">
                    {offer.imageUrl ? (
                      <img src={offer.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ProductArt product={{ art: offer.art, name: offer.title }} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={offer.layout === 'large' ? 'info' : 'neutral'}>{offer.layout}</Badge>
                      <span className={cx('h-4 w-4 rounded-full', THEME_SWATCH[offer.theme])} title={offer.theme} />
                      {offer.enabled === false && <Badge tone="neutral">Hidden</Badge>}
                      {expired && <Badge tone="danger">Expired</Badge>}
                      {offer.countdownEnabled && !expired && <Badge tone="warning">Countdown</Badge>}
                    </div>

                    {offer.eyebrow && (
                      <p className="mt-2 text-[0.6875rem] uppercase tracking-[0.14em] text-ink/45">
                        {offer.eyebrow}
                      </p>
                    )}
                    <p className="mt-0.5 truncate text-[0.9375rem] font-medium">{offer.title || 'Untitled offer'}</p>
                    <p className="mt-0.5 line-clamp-2 text-[0.75rem] text-ink/50">{offer.body}</p>
                    {offer.endsAt && (
                      <p className="mt-1 text-[0.6875rem] text-ink/45">
                        Ends {new Date(offer.endsAt).toLocaleString('en-GB')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-ink/8 px-4 py-2.5">
                  <Btn size="xs" onClick={() => move(i, i - 1)} disabled={i === 0 || saving}>
                    <Icon name="chevronUp" size={12} />
                  </Btn>
                  <Btn size="xs" onClick={() => move(i, i + 1)} disabled={i === promos.offers.length - 1 || saving}>
                    <Icon name="chevronDown" size={12} />
                  </Btn>
                  <Btn
                    size="xs"
                    onClick={() =>
                      persist(
                        { ...promos, offers: promos.offers.map((o, n) => (n === i ? { ...o, enabled: o.enabled === false } : o)) },
                        offer.enabled === false ? 'Offer shown' : 'Offer hidden',
                      )
                    }
                    disabled={saving}
                  >
                    {offer.enabled === false ? 'Show' : 'Hide'}
                  </Btn>
                  <Btn
                    size="xs"
                    variant="primary"
                    className="ml-auto"
                    onClick={() => {
                      setEditing({ ...BLANK, ...offer, endsAt: toLocalInput(offer.endsAt) })
                      setEditIndex(i)
                    }}
                  >
                    Edit
                  </Btn>
                  <Btn size="xs" variant="danger" onClick={() => setConfirm({ offer, index: i })}>
                    <Icon name="trash" size={12} />
                  </Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <OfferEditor
        offer={editing}
        onClose={() => { setEditing(null); setEditIndex(-1) }}
        onSave={saveOffer}
        isNew={editIndex < 0}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={`Delete “${confirm?.offer.title || 'this offer'}”?`}
        body="It disappears from the home page immediately. If you only want to pause it, use Hide instead."
        onConfirm={() =>
          persist(
            { ...promos, offers: promos.offers.filter((_, n) => n !== confirm.index) },
            'Offer deleted',
          )
        }
      />
    </AdminPage>
  )
}

function OfferEditor({ offer, onClose, onSave, isNew }) {
  const [form, setForm] = useState(BLANK)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (offer) setForm({ ...BLANK, ...offer, art: { ...BLANK.art, ...offer.art } })
  }, [offer])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal
      open={Boolean(offer)}
      onClose={onClose}
      title={isNew ? 'New offer' : 'Edit offer'}
      description="Everything here appears on the home page as soon as you save."
      size="lg"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => onSave(form)} disabled={!form.title.trim()}>
            Save offer
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        {/* live preview */}
        <div
          className={cx(
            'relative overflow-hidden rounded-2xl p-6',
            form.theme === 'plum' && 'bg-plum text-cream',
            form.theme === 'ink' && 'bg-ink text-cream',
            form.theme === 'sand' && 'bg-sand text-ink',
            form.theme === 'blush' && 'bg-blush text-ink',
          )}
        >
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              {form.eyebrow && (
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] opacity-70">
                  {form.eyebrow}
                </p>
              )}
              <p className="mt-1.5 font-display text-xl leading-tight">{form.title || 'Offer title'}</p>
              {form.body && <p className="mt-1.5 text-[0.8125rem] opacity-70">{form.body}</p>}
              {form.ctaLabel && (
                <span className="mt-3 inline-block rounded-full bg-cream/20 px-3.5 py-1.5 text-[0.75rem] font-medium">
                  {form.ctaLabel}
                </span>
              )}
            </div>
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ProductArt product={{ art: form.art, name: form.title }} />
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow" hint="Small label above the title">
            <Input value={form.eyebrow} onChange={set('eyebrow')} placeholder="Limited — today only" />
          </Field>

          <Field label="Title" required className="sm:col-span-2">
            <Input value={form.title} onChange={set('title')} placeholder="Up to 30% off the hijab edit" />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={2} value={form.body} onChange={set('body')} />
          </Field>

          <Field label="Button label">
            <Input value={form.ctaLabel} onChange={set('ctaLabel')} placeholder="Shop the edit" />
          </Field>
          <Field label="Button link" hint="Where the button goes">
            <Input value={form.ctaHref} onChange={set('ctaHref')} placeholder="/shop/hijabs" />
          </Field>

          <Field label="Layout" hint="One large offer sits beside the compact ones">
            <Select value={form.layout} onChange={set('layout')}>
              <option value="large">Large — wide slot with countdown</option>
              <option value="compact">Compact — image card</option>
            </Select>
          </Field>
          <Field label="Colour theme">
            <Select value={form.theme} onChange={set('theme')}>
              <option value="plum">Plum</option>
              <option value="ink">Ink</option>
              <option value="sand">Sand</option>
              <option value="blush">Blush</option>
            </Select>
          </Field>

          <Field label="Corner badge" hint="Compact cards only">
            <Input value={form.badge} onChange={set('badge')} placeholder="Gifting" />
          </Field>
          <Field label="Sort order">
            <NumberInput value={form.order} onChange={(v) => setForm((f) => ({ ...f, order: v }))} />
          </Field>
        </div>

        {/* image */}
        <Field label="Offer image" hint="Optional — falls back to generated artwork">
          <div className="flex flex-wrap items-center gap-2">
            {form.imageUrl && (
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-ink/12">
                <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <Btn size="sm" onClick={() => setPickerOpen(true)}>
              <Icon name="eye" size={14} /> {form.imageUrl ? 'Change image' : 'Upload or choose image'}
            </Btn>
            {form.imageUrl && (
              <Btn size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}>
                Remove
              </Btn>
            )}
          </div>
        </Field>

        {!form.imageUrl && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Artwork style">
              <Select value={form.art.shape} onChange={(e) => setForm((f) => ({ ...f, art: { ...f.art, shape: e.target.value } }))}>
                {ART_SHAPE_OPTIONS.map((sh) => <option key={sh}>{sh}</option>)}
              </Select>
            </Field>
            <Field label={`Artwork hue (${form.art.hue}°)`}>
              <input
                type="range" min="0" max="360"
                value={form.art.hue}
                onChange={(e) => setForm((f) => ({ ...f, art: { ...f.art, hue: Number(e.target.value) } }))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full accent-plum"
                style={{ background: 'linear-gradient(to right, hsl(0 60% 60%), hsl(120 60% 60%), hsl(240 60% 60%), hsl(360 60% 60%))' }}
              />
            </Field>
          </div>
        )}

        {/* countdown */}
        <div className="rounded-xl border border-ink/12 p-4">
          <Toggle
            checked={form.countdownEnabled}
            onChange={(v) => setForm((f) => ({ ...f, countdownEnabled: v }))}
            label="Show a countdown timer"
            description="Leave the end date blank for a timer that resets at midnight every day"
          />
          {form.countdownEnabled && (
            <Field label="Ends at" hint="Blank = resets daily at midnight" className="mt-4">
              <Input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />
            </Field>
          )}
        </div>

        <Toggle
          checked={form.enabled !== false}
          onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
          label="Visible on the home page"
        />
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        multiple={false}
        onSelect={(urls) => setForm((f) => ({ ...f, imageUrl: urls[0] ?? '' }))}
      />
    </Modal>
  )
}
