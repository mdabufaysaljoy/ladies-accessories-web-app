import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, Field, Input, Select, Spinner,
  Tabs, Textarea, Toggle, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { useSettings } from '@/context/SettingsContext'

const TABS = [
  { id: 'brand', label: 'Brand identity' },
  { id: 'contact', label: 'Contact & social' },
  { id: 'storefront', label: 'Storefront' },
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { push, node } = useToasts()
  const { reload } = useSettings()

  const load = useCallback(async () => {
    try {
      const [s, st, co] = await Promise.all([
        adminApi.get('/settings/admin'),
        adminApi.get('/settings/integration-status').catch(() => null),
        adminApi.get('/couriers').catch(() => null),
      ])
      setData(s.settings)
      setStatus(st)
      setCourierStatus(co?.couriers ?? null)
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
              <Field label="Business name (Bangla)">
                <Input value={data.brand.nameBn} onChange={(e) => set('brand', { nameBn: e.target.value })} />
              </Field>
              <Field label="Tagline" hint="Shown under the logo and in the browser tab">
                <Input value={data.brand.tagline} onChange={(e) => set('brand', { tagline: e.target.value })} />
              </Field>
              <Field label="Tagline (Bangla)">
                <Input value={data.brand.taglineBn} onChange={(e) => set('brand', { taglineBn: e.target.value })} />
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
              <Field label="Shop address (Bangla)">
                <Textarea rows={2} value={data.contact.addressBn} onChange={(e) => set('contact', { addressBn: e.target.value })} />
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
                blank={{ text: '', textBn: '', enabled: true }}
                addLabel="Add announcement"
                render={(item, patch) => (
                  <div className="space-y-2">
                    <Input value={item.text ?? ''} onChange={(e) => patch({ text: e.target.value })} placeholder="Free delivery on orders over ৳2,000" />
                    <Input value={item.textBn ?? ''} onChange={(e) => patch({ textBn: e.target.value })} placeholder="২০০০৳ এর উপরে ফ্রি ডেলিভারি" />
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
              <Field label="Headline (Bangla)">
                <Input value={data.storefront.heroHeadlineBn} onChange={(e) => set('storefront', { heroHeadlineBn: e.target.value })} />
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
                <Field label="Default language">
                  <Select value={data.storefront.language} onChange={(e) => set('storefront', { language: e.target.value })}>
                    <option value="en">English</option>
                    <option value="bn">বাংলা (Bangla)</option>
                  </Select>
                </Field>
                <Toggle
                  checked={data.storefront.allowLanguageToggle}
                  onChange={(v) => set('storefront', { allowLanguageToggle: v })}
                  label="Show the EN / বাংলা switch"
                  description="Customers can pick their language in the header"
                />
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
              blank={{ id: '', label: '', labelBn: '', charge: 100, eta: '', etaBn: '', enabled: true }}
              addLabel="Add zone"
              render={(item, patch) => (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={item.label ?? ''} onChange={(e) => patch({ label: e.target.value })} placeholder="Inside Dhaka City" />
                    <Input type="number" value={item.charge ?? 0} onChange={(e) => patch({ charge: Number(e.target.value) })} className="w-24" placeholder="৳" />
                  </div>
                  <div className="flex gap-2">
                    <Input value={item.labelBn ?? ''} onChange={(e) => patch({ labelBn: e.target.value })} placeholder="ঢাকা সিটির ভিতরে" />
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
                  <Input type="number" value={data.delivery.freeShippingThreshold} onChange={(e) => set('delivery', { freeShippingThreshold: Number(e.target.value) })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="COD advance required above (৳)" hint="Protects against refused parcels">
                    <Input type="number" value={data.delivery.codAdvanceThreshold} onChange={(e) => set('delivery', { codAdvanceThreshold: Number(e.target.value) })} />
                  </Field>
                  <Field label="Advance amount (৳)">
                    <Input type="number" value={data.delivery.codAdvanceAmount} onChange={(e) => set('delivery', { codAdvanceAmount: Number(e.target.value) })} />
                  </Field>
                </div>
                <Field label="Return window (days)">
                  <Input type="number" value={data.delivery.returnWindowDays} onChange={(e) => set('delivery', { returnWindowDays: Number(e.target.value) })} className="w-32" />
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
                  <Input
                    type="number"
                    min="0"
                    value={data.couriers.statusSyncMinutes}
                    onChange={(e) => set('couriers', { statusSyncMinutes: Number(e.target.value) })}
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
                <Input
                  type="number"
                  value={data.invoice.nextNumber}
                  onChange={(e) => set('invoice', { nextNumber: Number(e.target.value) })}
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
              <code className="mt-1 block break-all font-mono text-[0.75rem] text-ink/60">
                {window.location.origin.replace('5173', '4000')}/api/inbox/webhook/meta
              </code>
              <p className="mt-1.5 text-[0.6875rem] text-ink/45">
                Paste this into Meta → Webhooks. It must be publicly reachable over HTTPS in production
                (use ngrok or similar for local testing).
              </p>
            </div>
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

            <Card title="Analytics & tracking">
              <div className="space-y-4">
                <Field label="Facebook Pixel ID">
                  <Input value={data.integrations.analytics.facebookPixelId ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { facebookPixelId: e.target.value })} placeholder="1234567890" />
                </Field>
                <Field label="Google Analytics ID">
                  <Input value={data.integrations.analytics.googleAnalyticsId ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { googleAnalyticsId: e.target.value })} placeholder="G-XXXXXXXXXX" />
                </Field>
                <Field label="Google Tag Manager ID">
                  <Input value={data.integrations.analytics.googleTagManagerId ?? ''} onChange={(e) => setDeep('integrations', 'analytics', { googleTagManagerId: e.target.value })} placeholder="GTM-XXXXXXX" />
                </Field>
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
                  <Input type="number" value={data.integrations.email.smtpPort} onChange={(e) => setDeep('integrations', 'email', { smtpPort: Number(e.target.value) })} />
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
              blank={{ q: '', a: '', qBn: '', aBn: '' }}
              addLabel="Add question"
              render={(item, patch) => (
                <div className="space-y-2">
                  <Input value={item.q ?? ''} onChange={(e) => patch({ q: e.target.value })} placeholder="How long does delivery take?" />
                  <Textarea rows={3} value={item.a ?? ''} onChange={(e) => patch({ a: e.target.value })} placeholder="Inside Dhaka: 1–2 working days…" />
                  <Input value={item.qBn ?? ''} onChange={(e) => patch({ qBn: e.target.value })} placeholder="ডেলিভারিতে কত সময় লাগে?" />
                  <Textarea rows={2} value={item.aBn ?? ''} onChange={(e) => patch({ aBn: e.target.value })} placeholder="ঢাকার ভিতরে ১–২ কর্মদিবস…" />
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
