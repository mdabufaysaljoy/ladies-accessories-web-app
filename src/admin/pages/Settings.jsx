import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE, adminApi } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, Field, Input, NumberInput, Select, Spinner,
  Tabs, Textarea, Toggle, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { useSettings } from '@/context/SettingsContext'
import { formatDate } from '@/utils/format'

const TABS = [
  { id: 'brand', label: 'Brand identity' },
  { id: 'contact', label: 'Contact & social' },
  { id: 'storefront', label: 'Storefront' },
  { id: 'checkout', label: 'Checkout form' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'couriers', label: 'Couriers' },
  { id: 'payments', label: 'Payments' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'email', label: 'Email' },
  { id: 'content', label: 'FAQ & policies' },
]

/** Small helper for editing an array of objects inline. */
function Repeater({ items, onChange, blank, render, addLabel }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl border border-ink/10 p-3">
          <div className="min-w-0 flex-1">{render(item, (patch) => onChange(items.map((x, n) => (n === i ? { ...x, ...patch } : x))))}</div>
          <Btn size="sm" variant="ghost" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="Remove">
            <Icon name="trash" size={14} />
          </Btn>
        </div>
      ))}
      <Btn size="xs" onClick={() => onChange([...items, { ...blank }])}>
        <Icon name="plus" size={12} /> {addLabel}
      </Btn>
    </div>
  )
}

function SecretField({ label, hint, isSet, value, onChange, placeholder }) {
  return (
    <Field
      label={
        <span className="flex items-center gap-2">
          {label}
          {isSet && <Badge tone="success">Saved</Badge>}
        </span>
      }
      hint={hint}
    >
      <Input
        type="password"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSet ? '•••••••••••• (leave blank to keep)' : placeholder}
        autoComplete="new-password"
      />
    </Field>
  )
}

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'brand'
  const [data, setData] = useState(null)
  const [status, setStatus] = useState(null)
  const [courierStatus, setCourierStatus] = useState(null)
  const [catalogue, setCatalogue] = useState([])
  const [pageSub, setPageSub] = useState(null)
  const [webhookLog, setWebhookLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { push, node } = useToasts()

  /**
   * The callback URL Meta must be given. `API_BASE` already resolves to the
   * deployed API origin (VITE_API_URL), so this stays correct on a split-domain
   * deploy where the admin panel and the API live on different hosts.
   */
  const webhookUrl = `${API_BASE.startsWith('http') ? API_BASE : window.location.origin + API_BASE}/inbox/webhook/meta`
  const { reload } = useSettings()

  const load = useCallback(async () => {
    try {
      const [s, st, co, prods, sub, hooks] = await Promise.all([
        adminApi.get('/settings/admin'),
        adminApi.get('/settings/integration-status').catch(() => null),
        adminApi.get('/couriers').catch(() => null),
        // For the hero product pickers — active products only, since an
        // archived one would render a dead card on the homepage.
        adminApi.get('/products/admin/list?status=active&limit=300').catch(() => null),
        adminApi.get('/inbox/messenger/subscription').catch(() => null),
        adminApi.get('/inbox/webhook/log').catch(() => null),
      ])
      setData(s.settings)
      setStatus(st)
      setCourierStatus(co?.couriers ?? null)
      setCatalogue(prods?.products ?? [])
      setPageSub(sub)
      setWebhookLog(hooks)
      setDirty(false)
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const set = (section, patch) => {
    setData((d) => ({ ...d, [section]: { ...d[section], ...patch } }))
    setDirty(true)
  }
  const setDeep = (section, sub, patch) => {
    setData((d) => ({ ...d, [section]: { ...d[section], [sub]: { ...d[section][sub], ...patch } } }))
    setDirty(true)
  }
  const setRoot = (key, value) => {
    setData((d) => ({ ...d, [key]: value }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await adminApi.patch('/settings', data)
      setData(res.settings)
      setDirty(false)
      await reload()
      const [st, co] = await Promise.all([
        adminApi.get('/settings/integration-status').catch(() => null),
        adminApi.get('/couriers').catch(() => null),
      ])
      setStatus(st)
      setCourierStatus(co?.couriers ?? null)
      push('Settings saved — the storefront is updated')
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  /** Fires a real event at Meta so the shop can confirm the token works. */
  const testPixel = async () => {
    try {
      const res = await adminApi.post('/track/test', {})
      push(
        res.simulated
          ? 'Pixel not fully configured — the event was simulated'
          : `Test event accepted by Meta${res.fbTraceId ? ` (trace ${res.fbTraceId})` : ''}`,
        res.simulated ? 'info' : 'success',
      )
    } catch (err) {
      push(err.message, 'error')
    }
  }

  /** Subscribe the Facebook Page to this app's webhook. */
  const connectPage = async () => {
    try {
      const res = await adminApi.post('/inbox/messenger/subscribe', {})
      push(`Page connected — listening for ${res.fields?.length ?? 0} event types`)
      setPageSub(await adminApi.get('/inbox/messenger/subscription').catch(() => null))
    } catch (err) {
      // Meta's own wording is far more useful here than anything we'd invent.
      push(err.message, 'error')
    }
  }

  const testEmail = async () => {
    try {
      const res = await adminApi.post('/settings/test-email', {})
      push(res.simulated ? 'SMTP not configured — email was simulated' : `Test email sent to ${res.to}`, res.simulated ? 'info' : 'success')
    } catch (err) {
      push(err.message, 'error')
    }
  }

  if (loading) return <Spinner className="min-h-[60vh]" />
  if (!data) return null

  return (
    <AdminPage
      title="Settings"
      subtitle="Everything on your storefront, editable without a developer"
      actions={
        <>
          {dirty && <Badge tone="warning">Unsaved changes</Badge>}
          <Btn variant="primary" size="md" loading={saving} onClick={save} disabled={!dirty}>
            Save changes
          </Btn>
        </>
      }
    >
      {node}

      <div className="mb-5">
        <Tabs tabs={TABS} active={tab} onChange={(v) => setParams({ tab: v })} />
      </div>

      {/* ------------------------------ brand ------------------------------ */}
      {tab === 'brand' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Identity" description="Your shop name and how it appears everywhere">
            <div className="space-y-4">
              <Field label="Business name" required>
                <Input value={data.brand.name} onChange={(e) => set('brand', { name: e.target.value })} />
              </Field>
              <Field label="Tagline" hint="Shown under the logo and in the browser tab">
                <Input value={data.brand.tagline} onChange={(e) => set('brand', { tagline: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Logo letter" hint="Fallback mark">
                  <Input maxLength={2} value={data.brand.logoMark} onChange={(e) => set('brand', { logoMark: e.target.value })} />
                </Field>
                <Field label="Established">
                  <Input value={data.brand.established} onChange={(e) => set('brand', { established: e.target.value })} />
                </Field>
                <Field label="City label">
                  <Input value={data.brand.locationLabel} onChange={(e) => set('brand', { locationLabel: e.target.value })} />
                </Field>
              </div>
              <Field label="Logo image URL" hint="Upload in Media, then paste the URL">
                <Input value={data.brand.logoUrl} onChange={(e) => set('brand', { logoUrl: e.target.value })} placeholder="/uploads/logo.png" />
              </Field>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Brand colours" description="Applied live across the storefront">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(data.brand.colors ?? {}).map(([key, value]) => (
                  <label key={key} className="block">
                    <span className="text-[0.75rem] font-medium capitalize text-ink/65">{key}</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => setDeep('brand', 'colors', { [key]: e.target.value })}
                        className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-ink/15 bg-white p-1"
                      />
                      <Input value={value} onChange={(e) => setDeep('brand', 'colors', { [key]: e.target.value })} className="font-mono text-[0.75rem]" />
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-blush px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-ink/65">
                <Icon name="info" size={13} className="mt-0.5 shrink-0 text-plum" />
                Colours apply after saving and a page refresh on the storefront.
              </p>
            </Card>

            <Card title="Preview">
              <div
                className="rounded-xl p-6"
                style={{ backgroundColor: data.brand.colors?.blush, color: data.brand.colors?.ink }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-xl font-display text-lg"
                    style={{ backgroundColor: data.brand.colors?.ink, color: data.brand.colors?.cream }}
                  >
                    {data.brand.logoMark}
                  </span>
                  <div>
                    <p className="font-display text-lg leading-tight">{data.brand.name}</p>
                    <p className="text-[0.6875rem] uppercase tracking-[0.16em] opacity-50">
                      {data.brand.locationLabel} · Est. {data.brand.established}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[0.875rem] opacity-70">{data.brand.tagline}</p>
                <button
                  type="button"
                  className="mt-4 rounded-full px-5 py-2.5 text-[0.8125rem] font-medium"
                  style={{ backgroundColor: data.brand.colors?.plum, color: data.brand.colors?.cream }}
                >
                  Shop the collection
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ----------------------------- contact ----------------------------- */}
      {tab === 'contact' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Contact details" description="Used in the header, footer, emails and WhatsApp links">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" hint="Displayed publicly">
                  <Input value={data.contact.phone} onChange={(e) => set('contact', { phone: e.target.value })} />
                </Field>
                <Field label="Second phone" hint="Optional">
                  <Input value={data.contact.phoneSecondary} onChange={(e) => set('contact', { phoneSecondary: e.target.value })} />
                </Field>
              </div>
              <Field label="WhatsApp number" required hint="Country code, digits only — e.g. 8801712345678">
                <Input value={data.contact.whatsapp} onChange={(e) => set('contact', { whatsapp: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="WhatsApp greeting" hint="Pre-filled message when a customer taps the chat button">
                <Input value={data.contact.whatsappGreeting} onChange={(e) => set('contact', { whatsappGreeting: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Public email">
                  <Input type="email" value={data.contact.email} onChange={(e) => set('contact', { email: e.target.value })} />
                </Field>
                <Field label="Support email">
                  <Input type="email" value={data.contact.supportEmail} onChange={(e) => set('contact', { supportEmail: e.target.value })} />
                </Field>
              </div>
              <Field label="Shop address">
                <Textarea rows={2} value={data.contact.address} onChange={(e) => set('contact', { address: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opening hours">
                  <Input value={data.contact.hours} onChange={(e) => set('contact', { hours: e.target.value })} />
                </Field>
                <Field label="Trade licence no.">
                  <Input value={data.contact.tradeLicence} onChange={(e) => set('contact', { tradeLicence: e.target.value })} />
                </Field>
              </div>
              <Field label="BIN / VAT number" hint="Optional — shown in the footer if set">
                <Input value={data.contact.binNumber} onChange={(e) => set('contact', { binNumber: e.target.value })} />
              </Field>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Social links" description="Shown in the footer">
              <Repeater
                items={data.socials ?? []}
                onChange={(v) => setRoot('socials', v)}
                blank={{ name: '', href: '', icon: 'facebook', enabled: true }}
                addLabel="Add social link"
                render={(item, patch) => (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={item.name ?? ''} onChange={(e) => patch({ name: e.target.value })} placeholder="Facebook" className="w-1/3" />
                      <Input value={item.href ?? ''} onChange={(e) => patch({ href: e.target.value })} placeholder="https://facebook.com/…" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Select value={item.icon ?? 'facebook'} onChange={(e) => patch({ icon: e.target.value })} className="w-auto">
                        {['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp'].map((i) => <option key={i}>{i}</option>)}
                      </Select>
                      <Toggle checked={item.enabled !== false} onChange={(v) => patch({ enabled: v })} label="Visible" />
                    </div>
                  </div>
                )}
              />
            </Card>

            <Card title="Announcement bar" description="Scrolling messages at the very top of the site">
              <Repeater
                items={data.announcements ?? []}
                onChange={(v) => setRoot('announcements', v)}
                blank={{ text: '', enabled: true }}
                addLabel="Add announcement"
                render={(item, patch) => (
                  <div className="space-y-2">
                    <Input value={item.text ?? ''} onChange={(e) => patch({ text: e.target.value })} placeholder="Free delivery on orders over ৳2,000" />
                    <Toggle checked={item.enabled !== false} onChange={(v) => patch({ enabled: v })} label="Visible" />
                  </div>
                )}
              />
            </Card>
          </div>
        </div>
      )}

      {/* ---------------------------- storefront --------------------------- */}
      {tab === 'storefront' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Homepage hero">
            <div className="space-y-4">
              <Field label="Headline">
                <Input value={data.storefront.heroHeadline} onChange={(e) => set('storefront', { heroHeadline: e.target.value })} />
              </Field>
              <Field label="Sub-text">
                <Textarea rows={3} value={data.storefront.heroSubtext} onChange={(e) => set('storefront', { heroSubtext: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Button label">
                  <Input value={data.storefront.heroCtaLabel} onChange={(e) => set('storefront', { heroCtaLabel: e.target.value })} />
                </Field>
                <Field label="Button link">
                  <Input value={data.storefront.heroCtaHref} onChange={(e) => set('storefront', { heroCtaHref: e.target.value })} />
                </Field>
              </div>
              <Field
                label="Featured products"
                hint="The three products shown in the hero, in order"
              >
                <div className="space-y-2">
                  {[
                    { i: 0, label: 'Large card' },
                    { i: 1, label: 'Floating card' },
                    { i: 2, label: 'Small thumbnail' },
                  ].map(({ i, label }) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-[0.75rem] text-ink/50">{label}</span>
                      <Select
                        value={data.storefront.heroProducts?.[i] ?? ''}
                        onChange={(e) => {
                          const next = [...(data.storefront.heroProducts ?? [])]
                          // Keep the array dense so slot 3 cannot be set while
                          // slot 2 is empty and shift the whole composition.
                          next[i] = e.target.value
                          set('storefront', { heroProducts: next.filter((v, n) => v || n < next.length - 1) })
                        }}
                      >
                        <option value="">Auto — pick a featured product</option>
                        {catalogue.map((p) => (
                          <option key={p._id} value={p.slug}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </Field>

              {/* The three-product bundle further down the home page. */}
              <Field
                label="Routine bundle products"
                hint="The three products in “A routine that actually fits humid weather”. Leave on Auto to use your bestsellers; the section hides itself if fewer than three are available."
              >
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-[0.75rem] text-ink/50">Step {i + 1}</span>
                      <Select
                        value={data.storefront.routineProducts?.[i] ?? ''}
                        onChange={(e) => {
                          const next = [...(data.storefront.routineProducts ?? ['', '', ''])]
                          next[i] = e.target.value
                          set('storefront', { routineProducts: next })
                        }}
                      >
                        <option value="">Auto — use a bestseller</option>
                        {catalogue.map((p) => (
                          <option key={p._id} value={p.slug}>{p.name}</option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </Field>

              <Field
                label="“Our story” product"
                hint="The product pictured beside the story panel. Auto uses your best seller."
              >
                <Select
                  value={data.storefront.storyProduct ?? ''}
                  onChange={(e) => set('storefront', { storyProduct: e.target.value })}
                >
                  <option value="">Auto — use a bestseller</option>
                  {catalogue.map((p) => (
                    <option key={p._id} value={p.slug}>{p.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Badge text" hint="The small pill above the headline">
                <Input
                  value={data.storefront.heroBadge ?? ''}
                  onChange={(e) => set('storefront', { heroBadge: e.target.value })}
                  placeholder="New season hijabs just landed"
                />
              </Field>

              <Field label="Hero statistics">
                <Repeater
                  items={data.storefront.stats ?? []}
                  onChange={(v) => set('storefront', { stats: v })}
                  blank={{ value: '', label: '' }}
                  addLabel="Add statistic"
                  render={(item, patch) => (
                    <div className="flex gap-2">
                      <Input value={item.value ?? ''} onChange={(e) => patch({ value: e.target.value })} placeholder="12,000+" className="w-1/3" />
                      <Input value={item.label ?? ''} onChange={(e) => patch({ label: e.target.value })} placeholder="Orders delivered" />
                    </div>
                  )}
                />
              </Field>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Behaviour">
              <div className="space-y-4">
                <Toggle
                  checked={data.storefront.showQuickOrder}
                  onChange={(v) => set('storefront', { showQuickOrder: v })}
                  label="Quick order button"
                  description="One-step order form — name, phone, address. Very popular in Bangladesh."
                />
                <Toggle
                  checked={data.storefront.showWhatsAppFab}
                  onChange={(v) => set('storefront', { showWhatsAppFab: v })}
                  label="Floating WhatsApp button"
                />
                {/* `!== false` so a shop whose settings predate this field
                    still sees the section as on, matching the server default. */}
                <Toggle
                  checked={data.storefront.showCategorySection !== false}
                  onChange={(v) => set('storefront', { showCategorySection: v })}
                  label="“Shop by category” section"
                  description="The category tiles on the home page. Categories appear here in the order set on the Categories page."
                />
                {data.storefront.showCategorySection !== false && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Section heading">
                      <Input
                        value={data.storefront.categorySectionTitle ?? ''}
                        onChange={(e) => set('storefront', { categorySectionTitle: e.target.value })}
                        placeholder="Five edits, one standard"
                      />
                    </Field>
                    <Field label="Section blurb">
                      <Input
                        value={data.storefront.categorySectionBody ?? ''}
                        onChange={(e) => set('storefront', { categorySectionBody: e.target.value })}
                        placeholder="Everything here has been used by us first."
                      />
                    </Field>
                  </div>
                )}
                <Field label="Currency symbol">
                  <Input value={data.storefront.currencySymbol} onChange={(e) => set('storefront', { currencySymbol: e.target.value })} className="w-24" />
                </Field>
              </div>
            </Card>

            <Card title="Maintenance mode">
              <Toggle
                checked={data.storefront.maintenanceMode}
                onChange={(v) => set('storefront', { maintenanceMode: v })}
                label="Put the shop in maintenance mode"
                description="Visitors see a notice instead of being able to order"
              />
              {data.storefront.maintenanceMode && (
                <Field label="Message shown to visitors" className="mt-4">
                  <Textarea rows={3} value={data.storefront.maintenanceMessage} onChange={(e) => set('storefront', { maintenanceMessage: e.target.value })} placeholder="We are restocking — back on Saturday!" />
                </Field>
              )}
            </Card>

            <Card title="SEO defaults">
              <div className="space-y-4">
                <Field label="Meta title">
                  <Input value={data.seo?.metaTitle ?? ''} onChange={(e) => set('seo', { metaTitle: e.target.value })} />
                </Field>
                <Field label="Meta description">
                  <Textarea rows={3} value={data.seo?.metaDescription ?? ''} onChange={(e) => set('seo', { metaDescription: e.target.value })} />
                </Field>
              </div>
            </Card>

            <Card
              title="Product page"
              description="The reassurance rows and spec table under every product"
            >
              <div className="space-y-4">
                <Toggle
                  checked={data.productPage?.showAssurances !== false}
                  onChange={(v) => set('productPage', { showAssurances: v })}
                  label="Show the delivery / payment / returns rows"
                />

                {data.productPage?.showAssurances !== false && (
                  <Field label="Rows">
                    <Repeater
                      items={data.productPage?.assurances ?? []}
                      onChange={(v) => set('productPage', { assurances: v })}
                      blank={{ icon: 'checkCircle', title: '', body: '', link: '', linkLabel: '', enabled: true }}
                      addLabel="Add row"
                      render={(item, patch) => (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Select
                              value={item.icon ?? 'checkCircle'}
                              onChange={(e) => patch({ icon: e.target.value })}
                              className="w-36 shrink-0"
                            >
                              {['truck', 'cash', 'refresh', 'shield', 'checkCircle', 'gift', 'leaf', 'clock'].map((ic) => (
                                <option key={ic} value={ic}>{ic}</option>
                              ))}
                            </Select>
                            <Input
                              value={item.title ?? ''}
                              onChange={(e) => patch({ title: e.target.value })}
                              placeholder="Bold part — e.g. Free delivery over {freeShipping}."
                            />
                          </div>
                          <Textarea
                            rows={2}
                            value={item.body ?? ''}
                            onChange={(e) => patch({ body: e.target.value })}
                            placeholder="The rest of the sentence"
                          />
                          <div className="flex gap-2">
                            <Input
                              value={item.link ?? ''}
                              onChange={(e) => patch({ link: e.target.value })}
                              placeholder="/policy/returns (optional link)"
                            />
                            <Input
                              value={item.linkLabel ?? ''}
                              onChange={(e) => patch({ linkLabel: e.target.value })}
                              placeholder="Link text"
                            />
                          </div>
                          <Toggle
                            checked={item.enabled !== false}
                            onChange={(v) => patch({ enabled: v })}
                            label="Visible"
                          />
                        </div>
                      )}
                    />
                  </Field>
                )}

                <div className="rounded-xl bg-blush px-4 py-3 text-[0.75rem] leading-relaxed text-ink/70">
                  <Icon name="info" size={14} className="mr-1.5 inline text-plum" />
                  These placeholders fill themselves in from your delivery settings, so the numbers
                  never go stale: <code>{'{freeShipping}'}</code> the free-delivery amount,{' '}
                  <code>{'{deliveryZones}'}</code> your zones and timings,{' '}
                  <code>{'{returnDays}'}</code> the returns window.
                </div>

                <div className="space-y-3 border-t border-ink/10 pt-4">
                  <Toggle
                    checked={data.productPage?.showSpecifications !== false}
                    onChange={(v) => set('productPage', { showSpecifications: v })}
                    label="Show the specifications table"
                  />
                  <p className="text-[0.75rem] leading-relaxed text-ink/55">
                    Built from the key / value specs you enter on each product, under
                    Description &amp; specs.
                  </p>
                  {data.productPage?.showSpecifications !== false && (
                    <Field label="Table heading">
                      <Input
                        value={data.productPage?.specificationsTitle ?? ''}
                        onChange={(e) => set('productPage', { specificationsTitle: e.target.value })}
                        placeholder="Specifications"
                      />
                    </Field>
                  )}
                </div>
              </div>
            </Card>

            <Card
              title="Image optimisation"
              description="Applied to every image uploaded from now on"
            >
              <div className="space-y-4">
                <Field label="Stored format" hint="WebP is the safe default">
                  <Select
                    value={data.media?.format ?? 'webp'}
                    onChange={(e) => set('media', { format: e.target.value })}
                  >
                    <option value="webp">WebP — smaller, works everywhere</option>
                    <option value="avif">AVIF — smallest, slower to process</option>
                    <option value="original">Keep original — no optimisation</option>
                  </Select>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Quality (${data.media?.quality ?? 78})`} hint="78 is visually lossless for photos">
                    <NumberInput
                      type="range"
                      min={40}
                      max={100}
                      value={data.media?.quality ?? 78}
                      onChange={(v) => set('media', { quality: v })}
                    />
                  </Field>
                  <Field label="Maximum width" hint="Longest edge, in pixels">
                    <NumberInput
                     
                      min={600}
                      max={4000}
                      value={data.media?.maxWidth ?? 2000}
                      onChange={(v) => set('media', { maxWidth: v })}
                    />
                  </Field>
                </div>

                <div className="rounded-xl bg-blush px-4 py-3 text-[0.8125rem] leading-relaxed text-ink/70">
                  <Icon name="info" size={14} className="mr-1.5 inline text-plum" />
                  A photo straight from a phone is typically 4–6 MB; stored as WebP it comes out
                  around 100 KB — the single biggest thing you can do for page speed on mobile
                  data. Camera location data is stripped at the same time. Images already uploaded
                  are left as they are.
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ----------------------------- checkout ---------------------------- */}
      {tab === 'checkout' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Optional fields"
            description="Switch a field off to remove it from the checkout entirely"
          >
            <div className="space-y-5">
              <div className="rounded-xl border border-ink/10 p-4">
                <Toggle
                  checked={(data.checkout?.altPhone ?? 'optional') !== 'off'}
                  onChange={(v) => set('checkout', { altPhone: v ? 'optional' : 'off' })}
                  label="Alternative phone number"
                />
                <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/55">
                  A second number to try when the courier cannot reach the first.
                </p>
                {(data.checkout?.altPhone ?? 'optional') !== 'off' && (
                  <div className="mt-3 border-t border-ink/8 pt-3">
                    <Toggle
                      checked={data.checkout?.altPhone === 'required'}
                      onChange={(v) => set('checkout', { altPhone: v ? 'required' : 'optional' })}
                      label="Make it compulsory"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-ink/10 p-4">
                <Toggle
                  checked={(data.checkout?.email ?? 'optional') !== 'off'}
                  onChange={(v) => set('checkout', { email: v ? 'optional' : 'off' })}
                  label="Email address"
                />
                <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/55">
                  Order confirmation and invoice emails need one. Switch it off and customers get
                  updates by phone only.
                </p>
                {(data.checkout?.email ?? 'optional') !== 'off' && (
                  <div className="mt-3 border-t border-ink/8 pt-3">
                    <Toggle
                      checked={data.checkout?.email === 'required'}
                      onChange={(v) => set('checkout', { email: v ? 'required' : 'optional' })}
                      label="Make it compulsory"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-ink/10 p-4">
                <Toggle
                  checked={data.checkout?.giftOption !== false}
                  onChange={(v) => set('checkout', { giftOption: v })}
                  label="“This is a gift” option"
                />
                <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/55">
                  Lets a shopper add a gift note. The price is hidden on the delivery slip for gift
                  orders.
                </p>
              </div>

              <div className="rounded-xl border border-ink/10 p-4">
                <Toggle
                  checked={data.checkout?.notes !== false}
                  onChange={(v) => set('checkout', { notes: v })}
                  label="Delivery notes box"
                />
                <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/55">
                  A free-text box for landmarks or a preferred delivery time.
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Terms & conditions" description="The tick box on the payment step">
              <div className="rounded-xl border border-ink/10 p-4">
                <Toggle
                  checked={data.checkout?.requireTerms !== false}
                  onChange={(v) => set('checkout', { requireTerms: v })}
                  label="“I agree to the terms of service” tick box"
                />
                <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/55">
                  When it is on, the order cannot be placed until the shopper ticks it.
                </p>
              </div>

              {data.checkout?.requireTerms !== false && (
                <Field
                  label="Wording"
                  hint="Links to your terms and returns pages are added after it"
                  className="mt-4"
                >
                  <Input
                    value={data.checkout?.termsLabel ?? ''}
                    onChange={(e) => set('checkout', { termsLabel: e.target.value })}
                    placeholder="I agree to the terms of service and the return policy."
                  />
                </Field>
              )}

              {data.checkout?.requireTerms === false && (
                <p className="mt-4 rounded-xl bg-gold/10 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink/70">
                  <Icon name="alert" size={14} className="mr-1.5 inline text-gold" />
                  With the tick box off, the checkout tells shoppers that placing the order accepts
                  your terms and return policy. Keeping an explicit tick is the safer record if a
                  customer ever disputes a return.
                </p>
              )}
            </Card>

            <Card title="Always asked for">
              <p className="text-[0.8125rem] leading-relaxed text-ink/60">
                Full name, mobile number, district, area and full address cannot be switched off —
                a courier cannot deliver an order without them.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Full name', 'Mobile number', 'District', 'Area / Thana', 'Full address'].map((f) => (
                  <Badge key={f} tone="neutral">{f}</Badge>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ----------------------------- delivery ---------------------------- */}
      {tab === 'delivery' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Delivery zones"
            description="The three delivery packages a customer chooses from at checkout"
          >
            <Repeater
              items={data.delivery.zones ?? []}
              onChange={(v) => set('delivery', { zones: v })}
              blank={{ id: '', label: '', charge: 100, eta: '', enabled: true }}
              addLabel="Add zone"
              render={(item, patch) => (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={item.label ?? ''} onChange={(e) => patch({ label: e.target.value })} placeholder="Inside Dhaka City" />
                    <NumberInput value={item.charge ?? 0} onChange={(v) => patch({ charge: v })} className="w-24" placeholder="৳" />
                  </div>
                  <div className="flex gap-2">
                    <Input value={item.eta ?? ''} onChange={(e) => patch({ eta: e.target.value })} placeholder="1–2 working days" />
                  </div>

                  <div className="flex items-center gap-3">
                    <Input value={item.id ?? ''} onChange={(e) => patch({ id: e.target.value })} placeholder="zone-id" className="w-40 font-mono text-[0.75rem]" />
                    <Toggle checked={item.enabled !== false} onChange={(v) => patch({ enabled: v })} label="Available" />
                  </div>
                </div>
              )}
            />

          </Card>

          <div className="space-y-4">
            <Card title="Thresholds">
              <div className="space-y-4">
                <Field label="Free delivery above (৳)" hint="Set 0 to always charge">
                  <NumberInput value={data.delivery.freeShippingThreshold} onChange={(v) => set('delivery', { freeShippingThreshold: v })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="COD advance required above (৳)" hint="Protects against refused parcels">
                    <NumberInput value={data.delivery.codAdvanceThreshold} onChange={(v) => set('delivery', { codAdvanceThreshold: v })} />
                  </Field>
                  <Field label="Advance amount (৳)">
                    <NumberInput value={data.delivery.codAdvanceAmount} onChange={(v) => set('delivery', { codAdvanceAmount: v })} />
                  </Field>
                </div>
                <Field label="Return window (days)">
                  <NumberInput value={data.delivery.returnWindowDays} onChange={(v) => set('delivery', { returnWindowDays: v })} className="w-32" />
                </Field>
              </div>
            </Card>

            <Card title="Courier partners" description="Choices when marking an order shipped">
              <Repeater
                items={data.delivery.couriers ?? []}
                onChange={(v) => set('delivery', { couriers: v })}
                blank={{ name: '', enabled: true }}
                addLabel="Add courier"
                render={(item, patch) => (
                  <div className="flex items-center gap-3">
                    <Input value={item.name ?? ''} onChange={(e) => patch({ name: e.target.value })} placeholder="Steadfast Courier" />
                    <Toggle checked={item.enabled !== false} onChange={(v) => patch({ enabled: v })} label="Active" />
                  </div>
                )}
              />
            </Card>
          </div>
        </div>
      )}


      {/* ----------------------------- couriers ---------------------------- */}
      {tab === 'couriers' && (
        <div className="space-y-4">
          <Card
            title="Automation"
            description="What happens without anyone touching the dashboard"
          >
            <div className="space-y-4">
              <Toggle
                checked={data.couriers.autoCreateConsignment}
                onChange={(v) => set('couriers', { autoCreateConsignment: v })}
                label="Automatically book the courier"
                description="Creates a consignment as soon as an order is marked shipped. If the courier is down the order still ships — the failure is logged on the order timeline."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Courier to use" hint="Which provider automatic bookings go to">
                  <Select
                    value={data.couriers.defaultProvider}
                    onChange={(e) => set('couriers', { defaultProvider: e.target.value })}
                  >
                    <option value="steadfast">Steadfast Courier</option>
                    <option value="pathao">Pathao Courier</option>
                    <option value="redx">RedX</option>
                  </Select>
                </Field>
                <Field label="Status check interval (minutes)" hint="0 turns polling off">
                  <NumberInput
                   
                    min="0"
                    value={data.couriers.statusSyncMinutes}
                    onChange={(v) => set('couriers', { statusSyncMinutes: v })}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card
            title="Steadfast Courier"
            description="Nationwide COD courier — the most common choice in Bangladesh"
            actions={
              <Badge tone={courierStatus?.find((c) => c.id === 'steadfast')?.configured ? 'success' : 'neutral'}>
                {courierStatus?.find((c) => c.id === 'steadfast')?.configured ? 'Connected' : 'Not connected'}
              </Badge>
            }
          >
            <Toggle
              checked={data.couriers.steadfast.enabled}
              onChange={(v) => setDeep('couriers', 'steadfast', { enabled: v })}
              label="Use Steadfast"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SecretField
                label="API key"
                isSet={data.couriers.steadfast.apiKeySet}
                value={data.couriers.steadfast.apiKey}
                onChange={(v) => setDeep('couriers', 'steadfast', { apiKey: v })}
              />
              <SecretField
                label="Secret key"
                isSet={data.couriers.steadfast.secretKeySet}
                value={data.couriers.steadfast.secretKey}
                onChange={(v) => setDeep('couriers', 'steadfast', { secretKey: v })}
              />
            </div>
            <p className="mt-4 text-[0.75rem] leading-relaxed text-ink/55">
              Get these from your Steadfast merchant panel under Developer &rarr; API keys.
            </p>
          </Card>

          <Card
            title="Pathao Courier"
            description="OAuth-based — needs your merchant login as well as the app credentials"
            actions={
              <Badge tone={courierStatus?.find((c) => c.id === 'pathao')?.configured ? 'success' : 'neutral'}>
                {courierStatus?.find((c) => c.id === 'pathao')?.configured ? 'Connected' : 'Not connected'}
              </Badge>
            }
          >
            <Toggle
              checked={data.couriers.pathao.enabled}
              onChange={(v) => setDeep('couriers', 'pathao', { enabled: v })}
              label="Use Pathao"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Client ID">
                <Input
                  value={data.couriers.pathao.clientId ?? ''}
                  onChange={(e) => setDeep('couriers', 'pathao', { clientId: e.target.value })}
                />
              </Field>
              <SecretField
                label="Client secret"
                isSet={data.couriers.pathao.clientSecretSet}
                value={data.couriers.pathao.clientSecret}
                onChange={(v) => setDeep('couriers', 'pathao', { clientSecret: v })}
              />
              <Field label="Merchant username (email)">
                <Input
                  value={data.couriers.pathao.username ?? ''}
                  onChange={(e) => setDeep('couriers', 'pathao', { username: e.target.value })}
                />
              </Field>
              <SecretField
                label="Merchant password"
                isSet={data.couriers.pathao.passwordSet}
                value={data.couriers.pathao.password}
                onChange={(v) => setDeep('couriers', 'pathao', { password: v })}
              />
              <Field label="Store ID" hint="Your Pathao pickup store">
                <Input
                  value={data.couriers.pathao.storeId ?? ''}
                  onChange={(e) => setDeep('couriers', 'pathao', { storeId: e.target.value })}
                />
              </Field>
              <div className="flex items-end pb-2">
                <Toggle
                  checked={data.couriers.pathao.sandbox}
                  onChange={(v) => setDeep('couriers', 'pathao', { sandbox: v })}
                  label="Sandbox mode"
                />
              </div>
            </div>
          </Card>

          <Card
            title="RedX"
            description="Single access token, plus the pickup store to collect from"
            actions={
              <Badge tone={courierStatus?.find((c) => c.id === 'redx')?.configured ? 'success' : 'neutral'}>
                {courierStatus?.find((c) => c.id === 'redx')?.configured ? 'Connected' : 'Not connected'}
              </Badge>
            }
          >
            <Toggle
              checked={data.couriers.redx.enabled}
              onChange={(v) => setDeep('couriers', 'redx', { enabled: v })}
              label="Use RedX"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SecretField
                label="Access token"
                isSet={data.couriers.redx.accessTokenSet}
                value={data.couriers.redx.accessToken}
                onChange={(v) => setDeep('couriers', 'redx', { accessToken: v })}
              />
              <Field label="Pickup store ID">
                <Input
                  value={data.couriers.redx.pickupStoreId ?? ''}
                  onChange={(e) => setDeep('couriers', 'redx', { pickupStoreId: e.target.value })}
                />
              </Field>
              <div className="flex items-end pb-2 sm:col-span-2">
                <Toggle
                  checked={data.couriers.redx.sandbox}
                  onChange={(v) => setDeep('couriers', 'redx', { sandbox: v })}
                  label="Sandbox mode"
                />
              </div>
            </div>
          </Card>

          <Card title="Order notifications" description="Emails triggered by orders">
            <div className="space-y-4">
              <Toggle
                checked={data.notifications.emailAdminOnNewOrder}
                onChange={(v) => set('notifications', { emailAdminOnNewOrder: v })}
                label="Email me when a customer orders"
                description="A summary with the items, address and payment method"
              />
              <Field label="Send those alerts to" hint="Leave blank to use your public email">
                <Input
                  type="email"
                  value={data.notifications.adminNotifyEmail ?? ''}
                  onChange={(e) => set('notifications', { adminNotifyEmail: e.target.value })}
                  placeholder={data.contact.email}
                />
              </Field>
              <Toggle
                checked={data.notifications.emailCustomerOnNewOrder}
                onChange={(v) => set('notifications', { emailCustomerOnNewOrder: v })}
                label="Email the customer their invoice on order"
              />
              <Toggle
                checked={data.notifications.emailCustomerOnStatusChange}
                onChange={(v) => set('notifications', { emailCustomerOnStatusChange: v })}
                label="Email the customer on every status change"
                description="Confirmed, packed, shipped (with tracking) and delivered"
              />
            </div>
          </Card>

          <Card title="Invoice" description="Numbering and the wording on every invoice">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Number prefix">
                <Input
                  value={data.invoice.prefix}
                  onChange={(e) => set('invoice', { prefix: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Next number" hint="Increments automatically">
                <NumberInput
                 
                  value={data.invoice.nextNumber}
                  onChange={(v) => set('invoice', { nextNumber: v })}
                />
              </Field>
              <Field label="Footer note" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={data.invoice.footerNote}
                  onChange={(e) => set('invoice', { footerNote: e.target.value })}
                />
              </Field>
              <Field label="Terms line" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={data.invoice.termsNote}
                  onChange={(e) => set('invoice', { termsNote: e.target.value })}
                />
              </Field>
              <Field label="Signature name">
                <Input
                  value={data.invoice.signatureName ?? ''}
                  onChange={(e) => set('invoice', { signatureName: e.target.value })}
                  placeholder={data.brand.name}
                />
              </Field>
              <div className="flex items-end pb-2">
                <Toggle
                  checked={data.invoice.showLogo}
                  onChange={(v) => set('invoice', { showLogo: v })}
                  label="Show logo on invoices"
                  description="Uses the logo URL from Brand identity"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ----------------------------- payments ---------------------------- */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Cash on delivery" description="How most Bangladeshi customers pay">
              <Toggle checked={data.payments.cod.enabled} onChange={(v) => setDeep('payments', 'cod', { enabled: v })} label="Accept cash on delivery" />
              <Field label="Instructions shown at checkout" className="mt-4">
                <Textarea rows={2} value={data.payments.cod.instructions} onChange={(e) => setDeep('payments', 'cod', { instructions: e.target.value })} />
              </Field>
            </Card>

            <Card
              title="bKash — Send Money"
              description="Customer sends money manually and gives you the TrxID"
              actions={status?.payments?.bkashManual?.configured && <Badge tone="success">Ready</Badge>}
            >
              <Toggle checked={data.payments.bkashManual.enabled} onChange={(v) => setDeep('payments', 'bkashManual', { enabled: v })} label="Accept bKash Send Money" />
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="bKash number" required>
                    <Input value={data.payments.bkashManual.number} onChange={(e) => setDeep('payments', 'bkashManual', { number: e.target.value })} placeholder="01712345678" />
                  </Field>
                  <Field label="Account type">
                    <Select value={data.payments.bkashManual.accountType} onChange={(e) => setDeep('payments', 'bkashManual', { accountType: e.target.value })}>
                      <option value="personal">Personal</option>
                      <option value="agent">Agent</option>
                      <option value="merchant">Merchant</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Instructions">
                  <Textarea rows={2} value={data.payments.bkashManual.instructions} onChange={(e) => setDeep('payments', 'bkashManual', { instructions: e.target.value })} />
                </Field>
              </div>
            </Card>
          </div>

          <Card
            title="SSLCommerz"
            description="Card, net banking and every wallet through one gateway"
            actions={
              <Badge tone={status?.payments?.sslcommerz?.configured ? 'success' : 'neutral'}>
                {status?.payments?.sslcommerz?.configured ? 'Configured' : 'Not configured'}
              </Badge>
            }
          >
            <Toggle checked={data.payments.sslcommerz.enabled} onChange={(v) => setDeep('payments', 'sslcommerz', { enabled: v })} label="Accept SSLCommerz payments" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Store ID">
                <Input value={data.payments.sslcommerz.storeId ?? ''} onChange={(e) => setDeep('payments', 'sslcommerz', { storeId: e.target.value })} placeholder="yourstore0live" />
              </Field>
              <SecretField
                label="Store password"
                isSet={data.payments.sslcommerz.storePasswordSet}
                value={data.payments.sslcommerz.storePassword}
                onChange={(v) => setDeep('payments', 'sslcommerz', { storePassword: v })}
                placeholder="yourstore0live@ssl"
              />
              <div className="sm:col-span-2">
                <Toggle
                  checked={data.payments.sslcommerz.sandbox}
                  onChange={(v) => setDeep('payments', 'sslcommerz', { sandbox: v })}
                  label="Sandbox mode"
                  description="Keep on until you have tested. Turn off to take real money."
                />
              </div>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-blush px-3.5 py-3 text-[0.75rem] leading-relaxed text-ink/70">
              <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-plum" />
              Credentials are encrypted before they are stored and are never sent to the browser — the
              server calls SSLCommerz directly and validates every transaction before marking an order paid.
            </p>
          </Card>

          <Card
            title="bKash Checkout API"
            description="In-app bKash payment (requires a bKash merchant account)"
            actions={
              <Badge tone={status?.payments?.bkash?.configured ? 'success' : 'neutral'}>
                {status?.payments?.bkash?.configured ? 'Configured' : 'Not configured'}
              </Badge>
            }
          >
            <Toggle checked={data.payments.bkash.enabled} onChange={(v) => setDeep('payments', 'bkash', { enabled: v })} label="Accept bKash Checkout" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Username">
                <Input value={data.payments.bkash.username ?? ''} onChange={(e) => setDeep('payments', 'bkash', { username: e.target.value })} />
              </Field>
              <SecretField
                label="Password"
                isSet={data.payments.bkash.passwordSet}
                value={data.payments.bkash.password}
                onChange={(v) => setDeep('payments', 'bkash', { password: v })}
              />
              <Field label="App key">
                <Input value={data.payments.bkash.appKey ?? ''} onChange={(e) => setDeep('payments', 'bkash', { appKey: e.target.value })} />
              </Field>
              <SecretField
                label="App secret"
                isSet={data.payments.bkash.appSecretSet}
                value={data.payments.bkash.appSecret}
                onChange={(v) => setDeep('payments', 'bkash', { appSecret: v })}
              />
              <div className="sm:col-span-2">
                <Toggle checked={data.payments.bkash.sandbox} onChange={(v) => setDeep('payments', 'bkash', { sandbox: v })} label="Sandbox mode" />
              </div>
            </div>
          </Card>

          <Card title="Nagad — Send Money">
            <Toggle checked={data.payments.nagadManual.enabled} onChange={(v) => setDeep('payments', 'nagadManual', { enabled: v })} label="Accept Nagad Send Money" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Nagad number">
                <Input value={data.payments.nagadManual.number} onChange={(e) => setDeep('payments', 'nagadManual', { number: e.target.value })} />
              </Field>
              <Field label="Instructions">
                <Input value={data.payments.nagadManual.instructions} onChange={(e) => setDeep('payments', 'nagadManual', { instructions: e.target.value })} />
              </Field>
            </div>
          </Card>
        </div>
      )}

      {/* --------------------------- integrations -------------------------- */}
      {tab === 'integrations' && (
        <div className="space-y-4">
          <Card title="Meta app" description="Shared credentials for WhatsApp, Messenger and Instagram">
            <div className="grid gap-4 sm:grid-cols-2">
              <SecretField
                label="App secret"
                hint="Verifies incoming webhooks"
                isSet={data.integrations.meta.appSecretSet}
                value={data.integrations.meta.appSecret}
                onChange={(v) => setDeep('integrations', 'meta', { appSecret: v })}
              />
              <Field label="Webhook verify token" hint="Any string — paste the same one into Meta">
                <Input value={data.integrations.meta.verifyToken ?? ''} onChange={(e) => setDeep('integrations', 'meta', { verifyToken: e.target.value })} placeholder="goods-by-sadia-verify" />
              </Field>
            </div>
            <div className="mt-4 rounded-lg bg-sand px-3.5 py-3">
              <p className="text-[0.75rem] font-medium">Webhook callback URL</p>
              {/* Built from the configured API origin, not from the browser's.
                  Guessing it by swapping a dev port printed the *storefront*
                  domain in production, which Meta cannot verify. */}
              <code className="mt-1 block break-all font-mono text-[0.75rem] text-ink/60">
                {webhookUrl}
              </code>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Btn
                  size="xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(webhookUrl)
                      push('Callback URL copied')
                    } catch {
                      push('Could not copy — select it manually', 'error')
                    }
                  }}
                >
                  <Icon name="grid" size={12} /> Copy URL
                </Btn>
              </div>
              <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink/45">
                Paste this exactly into Meta → Webhooks, including the <code>/api</code> part. It must
                be publicly reachable over HTTPS in production (use ngrok or similar for local testing).
              </p>
            </div>
          </Card>

          <Card
            title="Webhook deliveries"
            description="What Meta has actually sent this server in the last 7 days"
            actions={
              <Btn
                size="xs"
                variant="ghost"
                onClick={async () => setWebhookLog(await adminApi.get('/inbox/webhook/log').catch(() => null))}
              >
                <Icon name="refresh" size={12} /> Refresh
              </Btn>
            }
          >
            {!webhookLog?.events?.length ? (
              <div className="rounded-xl bg-gold/10 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink/75">
                <Icon name="alert" size={14} className="mr-1.5 inline text-gold" />
                Meta has not called this server yet. Verifying the webhook is not enough on its own —
                subscribe the webhook to the <strong>messages</strong> field in Meta, then press
                “Connect Page to webhook” below. If it is still empty after sending yourself a test
                message, Meta is not reaching this server at all.
              </div>
            ) : (
              <ul className="space-y-2">
                {webhookLog.events.slice(0, 8).map((e) => (
                  <li key={e._id} className="rounded-xl border border-ink/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={e.status === 'accepted' ? (e.ingested > 0 ? 'success' : 'warning') : 'danger'}>
                        {e.status === 'accepted' ? (e.ingested > 0 ? `${e.ingested} message` : 'nothing to store') : 'rejected'}
                      </Badge>
                      <span className="text-[0.75rem] text-ink/45">{e.object || 'unknown'}</span>
                      <span className="ml-auto text-[0.75rem] text-ink/45">{formatDate(e.createdAt)}</span>
                    </div>
                    {e.reason && (
                      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink/65">{e.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              title="WhatsApp"
              actions={<Badge tone={status?.chat?.whatsapp?.configured ? 'success' : 'neutral'}>{status?.chat?.whatsapp?.configured ? 'Ready' : 'Not set'}</Badge>}
            >
              <Toggle checked={data.integrations.meta.whatsapp.enabled} onChange={(v) => setDeep('integrations', 'meta', { whatsapp: { ...data.integrations.meta.whatsapp, enabled: v } })} label="Enable WhatsApp inbox" />
              <div className="mt-4 space-y-4">
                <Field label="Phone number ID">
                  <Input value={data.integrations.meta.whatsapp.phoneNumberId ?? ''} onChange={(e) => setDeep('integrations', 'meta', { whatsapp: { ...data.integrations.meta.whatsapp, phoneNumberId: e.target.value } })} />
                </Field>
                <SecretField
                  label="Access token"
                  isSet={data.integrations.meta.whatsapp.accessTokenSet}
                  value={data.integrations.meta.whatsapp.accessToken}
                  onChange={(v) => setDeep('integrations', 'meta', { whatsapp: { ...data.integrations.meta.whatsapp, accessToken: v } })}
                />
              </div>
            </Card>

            <Card
              title="Messenger"
              actions={<Badge tone={status?.chat?.messenger?.configured ? 'success' : 'neutral'}>{status?.chat?.messenger?.configured ? 'Ready' : 'Not set'}</Badge>}
            >
              <Toggle checked={data.integrations.meta.messenger.enabled} onChange={(v) => setDeep('integrations', 'meta', { messenger: { ...data.integrations.meta.messenger, enabled: v } })} label="Enable Messenger inbox" />
              <div className="mt-4 space-y-4">
                <Field label="Page ID">
                  <Input value={data.integrations.meta.messenger.pageId ?? ''} onChange={(e) => setDeep('integrations', 'meta', { messenger: { ...data.integrations.meta.messenger, pageId: e.target.value } })} />
                </Field>
                <SecretField
                  label="Page access token"
                  isSet={data.integrations.meta.messenger.pageAccessTokenSet}
                  value={data.integrations.meta.messenger.pageAccessToken}
                  onChange={(v) => setDeep('integrations', 'meta', { messenger: { ...data.integrations.meta.messenger, pageAccessToken: v } })}
                />

                {/* Verifying the webhook is not enough on its own — the Page
                    has to be subscribed to it before any message arrives. */}
                <div className="border-t border-ink/10 pt-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Btn size="sm" onClick={connectPage} disabled={dirty}>
                      <Icon name="whatsapp" size={13} /> Connect Page to webhook
                    </Btn>
                    {pageSub && (
                      <Badge tone={pageSub.subscribed ? 'success' : 'warning'}>
                        {pageSub.subscribed ? 'Subscribed' : 'Not subscribed'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/55">
                    {dirty
                      ? 'Save your changes first, then connect.'
                      : 'Required step. Until the Page is subscribed, Messenger delivers nothing even with a verified webhook.'}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              title="Instagram"
              actions={<Badge tone={status?.chat?.instagram?.configured ? 'success' : 'neutral'}>{status?.chat?.instagram?.configured ? 'Ready' : 'Not set'}</Badge>}
            >
              <Toggle checked={data.integrations.meta.instagram.enabled} onChange={(v) => setDeep('integrations', 'meta', { instagram: { ...data.integrations.meta.instagram, enabled: v } })} label="Enable Instagram inbox" />
              <div className="mt-4 space-y-4">
                <Field label="Instagram account ID">
                  <Input value={data.integrations.meta.instagram.accountId ?? ''} onChange={(e) => setDeep('integrations', 'meta', { instagram: { ...data.integrations.meta.instagram, accountId: e.target.value } })} />
                </Field>
                <SecretField
                  label="Access token"
                  isSet={data.integrations.meta.instagram.accessTokenSet}
                  value={data.integrations.meta.instagram.accessToken}
                  onChange={(v) => setDeep('integrations', 'meta', { instagram: { ...data.integrations.meta.instagram, accessToken: v } })}
                />
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="SMS notifications" description="Order updates by SMS — the channel most BD customers actually read">
              <Toggle checked={data.integrations.sms.enabled} onChange={(v) => setDeep('integrations', 'sms', { enabled: v })} label="Enable SMS" />
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Provider">
                    <Select value={data.integrations.sms.provider} onChange={(e) => setDeep('integrations', 'sms', { provider: e.target.value })}>
                      <option value="bulksmsbd">BulkSMSBD</option>
                      <option value="ssl">SSL Wireless</option>
                      <option value="alpha">Alpha SMS</option>
                    </Select>
                  </Field>
                  <Field label="Sender ID">
                    <Input value={data.integrations.sms.senderId ?? ''} onChange={(e) => setDeep('integrations', 'sms', { senderId: e.target.value })} />
                  </Field>
                </div>
                <SecretField
                  label="API key"
                  isSet={data.integrations.sms.apiKeySet}
                  value={data.integrations.sms.apiKey}
                  onChange={(v) => setDeep('integrations', 'sms', { apiKey: v })}
                />
              </div>
            </Card>

            <Card
              title="Facebook / Meta tracking"
              description="Pixel in the browser, Conversions API from the server"
              actions={
                <Badge tone={data.integrations.analytics.facebookCapiEnabled && data.integrations.analytics.facebookAccessTokenSet ? 'success' : data.integrations.analytics.facebookPixelId ? 'warning' : 'neutral'}>
                  {data.integrations.analytics.facebookCapiEnabled && data.integrations.analytics.facebookAccessTokenSet
                    ? 'Pixel + CAPI'
                    : data.integrations.analytics.facebookPixelId
                      ? 'Pixel only'
                      : 'Off'}
                </Badge>
              }
            >
              <div className="space-y-4">
                <Field label="Pixel ID" hint="Events Manager → Data sources → your pixel. Just the number.">
                  <Input value={data.integrations.analytics.facebookPixelId ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { facebookPixelId: e.target.value })} placeholder="1234567890123456" />
                </Field>

                <div className="rounded-xl border border-ink/10 p-3">
                  <Toggle
                    checked={Boolean(data.integrations.analytics.facebookCapiEnabled)}
                    onChange={(v) => setDeep('integrations', 'analytics', { facebookCapiEnabled: v })}
                    label="Send events from the server (Conversions API)"
                  />
                  <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/55">
                    Roughly a third of shoppers block the browser pixel. With this on, every
                    event is also sent server-to-server and deduplicated, so your ad reporting
                    and optimisation see the sales you actually made.
                  </p>
                </div>

                <SecretField
                  label="Conversions API access token"
                  hint="Events Manager → Settings → Conversions API → Generate access token"
                  isSet={data.integrations.analytics.facebookAccessTokenSet}
                  value={data.integrations.analytics.facebookAccessToken}
                  onChange={(v) => setDeep('integrations', 'analytics', { facebookAccessToken: v })}
                  placeholder="EAAG..."
                />

                <Field label="Test event code" hint="Only while testing — clear it once events look right in Events Manager.">
                  <Input value={data.integrations.analytics.facebookTestEventCode ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { facebookTestEventCode: e.target.value })} placeholder="TEST12345" />
                </Field>

                <Field label="Domain verification code" hint="Business Settings → Brand safety → Domains. Paste the content value only.">
                  <Input value={data.integrations.analytics.facebookDomainVerification ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { facebookDomainVerification: e.target.value })} placeholder="abc123def456..." />
                </Field>

                <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                  <Btn size="sm" variant="ghost" onClick={testPixel} disabled={dirty}>
                    <Icon name="sparkle" size={14} /> Send test event
                  </Btn>
                  <span className="text-[0.75rem] text-ink/50">
                    {dirty ? 'Save your changes first' : 'Then check Events Manager → Test events'}
                  </span>
                </div>
              </div>
            </Card>

            <Card title="Google tracking" description="Analytics, Ads conversions and Tag Manager">
              <div className="space-y-4">
                <Field label="Google Analytics 4 ID" hint="Admin → Data streams → Measurement ID">
                  <Input value={data.integrations.analytics.googleAnalyticsId ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { googleAnalyticsId: e.target.value })} placeholder="G-XXXXXXXXXX" />
                </Field>
                <Field label="Google Ads conversion ID" hint="Google Ads → Goals → Conversions → your action">
                  <Input value={data.integrations.analytics.googleAdsConversionId ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { googleAdsConversionId: e.target.value })} placeholder="AW-123456789" />
                </Field>
                <Field label="Purchase conversion label" hint="The label shown next to the conversion ID in the tag setup">
                  <Input value={data.integrations.analytics.googleAdsPurchaseLabel ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { googleAdsPurchaseLabel: e.target.value })} placeholder="AbC-D_efG12h34i5j6" />
                </Field>
                <Field label="Google Tag Manager ID" hint="Optional — only if you manage tags through GTM instead.">
                  <Input value={data.integrations.analytics.googleTagManagerId ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { googleTagManagerId: e.target.value })} placeholder="GTM-XXXXXXX" />
                </Field>
                <Field label="Search Console verification" hint="The google-site-verification content value.">
                  <Input value={data.integrations.analytics.googleSiteVerification ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { googleSiteVerification: e.target.value })} placeholder="abc123..." />
                </Field>

                <div className="border-t border-ink/10 pt-3">
                  <Toggle
                    checked={Boolean(data.integrations.analytics.debug)}
                    onChange={(v) => setDeep('integrations', 'analytics', { debug: v })}
                    label="Log every tracked event on the server"
                  />
                  <p className="mt-2 text-[0.75rem] text-ink/55">
                    For debugging only — leave off in normal operation.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------ email ------------------------------ */}
      {tab === 'email' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="SMTP settings"
            description="Used for order updates and campaigns"
            actions={<Badge tone={status?.email?.ok ? 'success' : 'warning'}>{status?.email?.ok ? 'Connected' : status?.email?.simulated ? 'Simulated' : 'Error'}</Badge>}
          >
            <div className="space-y-4">
              <Field label="Provider">
                <Select value={data.integrations.email.provider} onChange={(e) => setDeep('integrations', 'email', { provider: e.target.value })}>
                  <option value="none">Not configured (emails are simulated)</option>
                  <option value="smtp">SMTP</option>
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From name">
                  <Input value={data.integrations.email.fromName} onChange={(e) => setDeep('integrations', 'email', { fromName: e.target.value })} />
                </Field>
                <Field label="From email">
                  <Input type="email" value={data.integrations.email.fromEmail} onChange={(e) => setDeep('integrations', 'email', { fromEmail: e.target.value })} />
                </Field>
              </div>
              <Field label="Reply-to" hint="Optional">
                <Input type="email" value={data.integrations.email.replyTo ?? ''} onChange={(e) => setDeep('integrations', 'email', { replyTo: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <Field label="SMTP host">
                  <Input value={data.integrations.email.smtpHost ?? ''} onChange={(e) => setDeep('integrations', 'email', { smtpHost: e.target.value })} placeholder="smtp.gmail.com" />
                </Field>
                <Field label="Port">
                  <NumberInput value={data.integrations.email.smtpPort} onChange={(v) => setDeep('integrations', 'email', { smtpPort: v })} />
                </Field>
              </div>
              <Field label="SMTP username">
                <Input value={data.integrations.email.smtpUser ?? ''} onChange={(e) => setDeep('integrations', 'email', { smtpUser: e.target.value })} />
              </Field>
              <SecretField
                label="SMTP password"
                hint="Use an app password, not your login password"
                isSet={data.integrations.email.smtpPasswordSet}
                value={data.integrations.email.smtpPassword}
                onChange={(v) => setDeep('integrations', 'email', { smtpPassword: v })}
              />
              <Toggle
                checked={data.integrations.email.smtpSecure}
                onChange={(v) => setDeep('integrations', 'email', { smtpSecure: v })}
                label="Use TLS/SSL"
                description="On for port 465, off for 587"
              />
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Test your setup">
              <p className="text-[0.875rem] leading-relaxed text-ink/65">
                Save your settings first, then send a test email to{' '}
                <strong className="font-medium text-ink">{data.contact.email}</strong> to confirm
                everything works before customers rely on it.
              </p>
              {status?.email?.message && (
                <p className={`mt-3 rounded-lg px-3.5 py-2.5 text-[0.8125rem] ${status.email.ok ? 'bg-moss/10 text-moss' : 'bg-gold/12 text-ink/70'}`}>
                  {status.email.message}
                </p>
              )}
              <Btn variant="primary" size="md" className="mt-4" onClick={testEmail}>
                <Icon name="mail" size={15} /> Send test email
              </Btn>
            </Card>

            <Card title="Automatic emails" description="Sent when you change an order's status">
              <ul className="space-y-2.5 text-[0.8125rem]">
                {[
                  ['Order confirmed', 'When you confirm a pending order'],
                  ['Packed', 'When you mark the parcel packed'],
                  ['Shipped', 'Includes the courier and tracking number'],
                  ['Delivered', 'With a reminder about the return window'],
                  ['Payment received', 'When an online payment is validated'],
                ].map(([name, when]) => (
                  <li key={name} className="flex items-start gap-2.5">
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-moss" />
                    <span>
                      <strong className="font-medium">{name}</strong>
                      <span className="block text-ink/50">{when}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ----------------------------- content ----------------------------- */}
      {tab === 'content' && (
        <div className="space-y-4">
          <Card title="Frequently asked questions" description="Shown on the FAQ, contact and product pages">
            <Repeater
              items={data.faqs ?? []}
              onChange={(v) => setRoot('faqs', v)}
              blank={{ q: '', a: '' }}
              addLabel="Add question"
              render={(item, patch) => (
                <div className="space-y-2">
                  <Input value={item.q ?? ''} onChange={(e) => patch({ q: e.target.value })} placeholder="How long does delivery take?" />
                  <Textarea rows={3} value={item.a ?? ''} onChange={(e) => patch({ a: e.target.value })} placeholder="Inside Dhaka: 1–2 working days…" />
                </div>
              )}
            />
          </Card>

          <Card title="Policy pages" description="Shipping, returns, privacy and terms">
            <Repeater
              items={data.policies ?? []}
              onChange={(v) => setRoot('policies', v)}
              blank={{ slug: '', title: '', lead: '', updated: '', sections: [] }}
              addLabel="Add policy page"
              render={(item, patch) => (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={item.slug ?? ''} onChange={(e) => patch({ slug: e.target.value })} placeholder="shipping" className="w-40 font-mono text-[0.75rem]" />
                    <Input value={item.title ?? ''} onChange={(e) => patch({ title: e.target.value })} placeholder="Delivery & shipping" />
                    <Input value={item.updated ?? ''} onChange={(e) => patch({ updated: e.target.value })} placeholder="1 August 2026" className="w-40" />
                  </div>
                  <Input value={item.lead ?? ''} onChange={(e) => patch({ lead: e.target.value })} placeholder="Where we deliver, what it costs…" />
                  <div className="space-y-2 rounded-lg bg-sand/60 p-2.5">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink/45">Sections</p>
                    {(item.sections ?? []).map((sec, si) => (
                      <div key={si} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Input
                            value={sec.heading ?? ''}
                            onChange={(e) => patch({ sections: item.sections.map((s, n) => (n === si ? { ...s, heading: e.target.value } : s)) })}
                            placeholder="Coverage"
                          />
                          <Textarea
                            rows={3}
                            value={(sec.body ?? []).join('\n\n')}
                            onChange={(e) => patch({ sections: item.sections.map((s, n) => (n === si ? { ...s, body: e.target.value.split('\n\n').filter(Boolean) } : s)) })}
                            placeholder="One paragraph per blank line…"
                          />
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => patch({ sections: item.sections.filter((_, n) => n !== si) })} aria-label="Remove section">
                          <Icon name="trash" size={13} />
                        </Btn>
                      </div>
                    ))}
                    <Btn size="xs" onClick={() => patch({ sections: [...(item.sections ?? []), { heading: '', body: [] }] })}>
                      <Icon name="plus" size={12} /> Add section
                    </Btn>
                  </div>
                </div>
              )}
            />
          </Card>
        </div>
      )}
    </AdminPage>
  )
}
