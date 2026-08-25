import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminApi, api } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, Field, Input, Select, Spinner, Tabs,
  Textarea, Toggle, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { ProductArt, ART_SHAPE_OPTIONS } from '@/components/product/ProductArt'
import { ImageManager } from '../components/ImageManager'
import { VideoManager } from '../components/VideoManager'
import { slugifyClient, taka } from '@/utils/format'

const BLANK = {
  name: '', nameBn: '', slug: '', sku: '',
  category: '', subcategory: '',
  price: 0, compareAt: 0, costPrice: 0,
  short: '', shortBn: '', description: '', descriptionBn: '', care: '',
  details: [], specifications: [], images: [], videos: [],
  art: { shape: 'jar', hue: 320 },
  colors: [], sizes: [],
  stock: 0, lowStockThreshold: 5, trackInventory: true,
  badge: '', tags: [],
  status: 'draft', featured: false,
  seo: { metaTitle: '', metaDescription: '', keywords: [] },
}

const TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'details', label: 'Description & specs' },
  { id: 'variants', label: 'Variants & stock' },
  { id: 'media', label: 'Media' },
  { id: 'seo', label: 'SEO' },
]

/** Editable list of plain strings (the "Details" bullets). */
function StringList({ items, onChange, placeholder, addLabel }) {
  return (
    <div className="space-y-2">
      {items.map((value, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(items.map((v, n) => (n === i ? e.target.value : v)))}
            placeholder={placeholder}
          />
          <Btn size="sm" variant="ghost" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="Remove">
            <Icon name="trash" size={14} />
          </Btn>
        </div>
      ))}
      <Btn size="xs" onClick={() => onChange([...items, ''])}>
        <Icon name="plus" size={12} /> {addLabel}
      </Btn>
    </div>
  )
}

/** Editable label/value spec rows. */
function SpecList({ items, onChange }) {
  const set = (i, key, value) => onChange(items.map((row, n) => (n === i ? { ...row, [key]: value } : row)))
  return (
    <div className="space-y-2">
      {items.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Input value={row.label ?? ''} onChange={(e) => set(i, 'label', e.target.value)} placeholder="Fabric" className="w-1/3" />
          <Input value={row.value ?? ''} onChange={(e) => set(i, 'value', e.target.value)} placeholder="100% premium georgette" />
          <Btn size="sm" variant="ghost" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="Remove">
            <Icon name="trash" size={14} />
          </Btn>
        </div>
      ))}
      <Btn size="xs" onClick={() => onChange([...items, { label: '', value: '' }])}>
        <Icon name="plus" size={12} /> Add specification
      </Btn>
    </div>
  )
}

export default function ProductEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const { push, node } = useToasts()

  const [form, setForm] = useState(BLANK)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('basics')
  const [errors, setErrors] = useState({})

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }
  const setNested = (path, value) =>
    setForm((f) => {
      const [a, b] = path.split('.')
      return { ...f, [a]: { ...f[a], [b]: value } }
    })

  useEffect(() => {
    api.get('/categories?all=true').then((d) => {
      setCategories(d.categories)
      if (isNew) setForm((f) => (f.category ? f : { ...f, category: d.categories[0]?.slug ?? '' }))
    }).catch(() => {})
  }, [isNew])

  useEffect(() => {
    if (isNew) return
    adminApi
      .get(`/products/admin/${id}`)
      .then((d) => setForm({ ...BLANK, ...d.product, seo: { ...BLANK.seo, ...d.product.seo } }))
      .catch((err) => push(err.message, 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew])

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === form.category),
    [categories, form.category],
  )

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'A product name is required'
    if (!form.category) next.category = 'Choose a category'
    if (!(Number(form.price) > 0)) next.price = 'Price must be greater than zero'
    if (form.compareAt && Number(form.compareAt) <= Number(form.price)) {
      next.compareAt = 'Compare-at price should be higher than the selling price'
    }
    setErrors(next)
    if (Object.keys(next).length) {
      setTab('basics')
      push('Please fix the highlighted fields', 'error')
    }
    return Object.keys(next).length === 0
  }

  const save = useCallback(
    async (overrides = {}) => {
      if (!validate()) return
      setSaving(true)
      try {
        const payload = {
          ...form,
          ...overrides,
          price: Number(form.price),
          compareAt: Number(form.compareAt) || 0,
          costPrice: Number(form.costPrice) || 0,
          stock: Number(form.stock) || 0,
          lowStockThreshold: Number(form.lowStockThreshold) || 0,
          details: form.details.filter(Boolean),
          specifications: form.specifications.filter((s) => s.label || s.value),
        }
        if (isNew) {
          const { product } = await adminApi.post('/products', payload)
          push('Product created')
          navigate(`/admin/products/${product._id}`, { replace: true })
        } else {
          const { product } = await adminApi.patch(`/products/${id}`, payload)
          setForm({ ...BLANK, ...product, seo: { ...BLANK.seo, ...product.seo } })
          push('Changes saved')
        }
      } catch (err) {
        push(err.message, 'error')
        if (err.details) setErrors(err.details)
      } finally {
        setSaving(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, id, isNew],
  )

  if (loading) return <Spinner className="min-h-[60vh]" />

  const margin = form.costPrice > 0 ? Math.round(((form.price - form.costPrice) / form.price) * 100) : null

  return (
    <AdminPage
      title={isNew ? 'New product' : form.name || 'Edit product'}
      subtitle={isNew ? 'Add a product to your catalogue' : `goodsbysadia.com/product/${form.slug}`}
      actions={
        <>
          <Btn as={Link} to="/admin/products" size="md">
            <Icon name="chevronLeft" size={14} /> Products
          </Btn>
          {!isNew && form.status === 'active' && (
            <Btn as={Link} to={`/product/${form.slug}`} target="_blank" size="md">
              <Icon name="arrowUpRight" size={14} /> View
            </Btn>
          )}
          {form.status !== 'active' && (
            <Btn variant="success" size="md" loading={saving} onClick={() => save({ status: 'active' })}>
              Publish
            </Btn>
          )}
          <Btn variant="primary" size="md" loading={saving} onClick={() => save()}>
            Save
          </Btn>
        </>
      }
    >
      {node}

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <Card padded={false}>
          <div className="px-3 pt-2">
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
          </div>

          <div className="p-5">
            {tab === 'basics' && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Product name" required error={errors.name} className="sm:col-span-2">
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      set('name', e.target.value)
                      // The server has the final say (it resolves collisions
                      // with -2, -3); this only keeps the SEO preview truthful
                      // while the product is still being written.
                      if (isNew) set('slug', slugifyClient(e.target.value))
                    }}
                    placeholder="Signature Georgette Hijab"
                  />
                </Field>

                <Field label="Bangla name" hint="Optional — shown when the site is in Bangla">
                  <Input value={form.nameBn} onChange={(e) => set('nameBn', e.target.value)} placeholder="সিগনেচার জর্জেট হিজাব" />
                </Field>

                <Field label="Category" required error={errors.category}>
                  <Select value={form.category} onChange={(e) => { set('category', e.target.value); set('subcategory', '') }}>
                    <option value="">Choose a category…</option>
                    {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </Select>
                </Field>

                <Field label="Type / subcategory">
                  <Select value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)}>
                    <option value="">None</option>
                    {(activeCategory?.subcategories ?? []).map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </Field>

                <Field label="Selling price (৳)" required error={errors.price}>
                  <Input type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
                </Field>

                <Field label="Compare-at price (৳)" hint="Shown struck through" error={errors.compareAt}>
                  <Input type="number" min="0" value={form.compareAt} onChange={(e) => set('compareAt', e.target.value)} />
                </Field>

                <Field label="Cost price (৳)" hint={margin != null ? `${margin}% margin` : 'For your margin report — never public'}>
                  <Input type="number" min="0" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
                </Field>

                <Field label="Short description" hint="One line, shown on cards" className="sm:col-span-2">
                  <Input value={form.short} onChange={(e) => set('short', e.target.value)} placeholder="Weightless georgette with a soft matte fall." />
                </Field>

                <Field label="Short description (Bangla)" className="sm:col-span-2">
                  <Input value={form.shortBn} onChange={(e) => set('shortBn', e.target.value)} placeholder="হালকা জর্জেট, সারাদিন পরে থাকলেও সরে যায় না।" />
                </Field>

                <Field label="Badge" hint="Corner label on the card">
                  <Input value={form.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Bestseller / New / Gift" />
                </Field>

                <Field label="Tags" hint="Comma separated">
                  <Input
                    value={form.tags.join(', ')}
                    onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
                    placeholder="bestseller, everyday"
                  />
                </Field>
              </div>
            )}

            {tab === 'details' && (
              <div className="space-y-6">
                <Field label="Full description" hint="Shown in the Description accordion">
                  <Textarea rows={7} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </Field>
                <Field label="Full description (Bangla)">
                  <Textarea rows={5} value={form.descriptionBn} onChange={(e) => set('descriptionBn', e.target.value)} />
                </Field>
                <Field label="Detail bullets" hint="Ticked list under “Details & specification”">
                  <StringList
                    items={form.details}
                    onChange={(v) => set('details', v)}
                    placeholder="190 × 75 cm — generous rectangular cut"
                    addLabel="Add bullet"
                  />
                </Field>
                <Field label="Specifications" hint="Structured label / value table">
                  <SpecList items={form.specifications} onChange={(v) => set('specifications', v)} />
                </Field>
                <Field label="How to use & care">
                  <Textarea rows={3} value={form.care} onChange={(e) => set('care', e.target.value)} />
                </Field>
              </div>
            )}

            {tab === 'variants' && (
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="Stock quantity">
                    <Input type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} disabled={!form.trackInventory} />
                  </Field>
                  <Field label="Low stock alert at">
                    <Input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} />
                  </Field>
                  <div className="flex items-end pb-2">
                    <Toggle
                      checked={form.trackInventory}
                      onChange={(v) => set('trackInventory', v)}
                      label="Track inventory"
                      description="Off = always in stock"
                    />
                  </div>
                </div>

                <Field label="Colours" hint="Shown as swatches on the product page">
                  <div className="space-y-2">
                    {form.colors.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={c.hex || '#cccccc'}
                          onChange={(e) => set('colors', form.colors.map((x, n) => (n === i ? { ...x, hex: e.target.value } : x)))}
                          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-ink/15 bg-white p-1"
                          aria-label="Colour"
                        />
                        <Input
                          value={c.name ?? ''}
                          onChange={(e) => set('colors', form.colors.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))}
                          placeholder="Dusty Rose"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={c.stock ?? 0}
                          onChange={(e) => set('colors', form.colors.map((x, n) => (n === i ? { ...x, stock: Number(e.target.value) } : x)))}
                          className="w-24"
                          placeholder="Qty"
                        />
                        <Btn size="sm" variant="ghost" onClick={() => set('colors', form.colors.filter((_, n) => n !== i))} aria-label="Remove">
                          <Icon name="trash" size={14} />
                        </Btn>
                      </div>
                    ))}
                    <Btn size="xs" onClick={() => set('colors', [...form.colors, { name: '', hex: '#c4787f', stock: 0 }])}>
                      <Icon name="plus" size={12} /> Add colour
                    </Btn>
                  </div>
                </Field>

                <Field label="Sizes / volumes" hint="Price delta is added to the base price">
                  <div className="space-y-2">
                    {form.sizes.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={s.label ?? ''}
                          onChange={(e) => set('sizes', form.sizes.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)))}
                          placeholder="100 ml"
                        />
                        <Input
                          type="number"
                          value={s.priceDelta ?? 0}
                          onChange={(e) => set('sizes', form.sizes.map((x, n) => (n === i ? { ...x, priceDelta: Number(e.target.value) } : x)))}
                          className="w-28"
                          placeholder="+৳"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={s.stock ?? 0}
                          onChange={(e) => set('sizes', form.sizes.map((x, n) => (n === i ? { ...x, stock: Number(e.target.value) } : x)))}
                          className="w-24"
                          placeholder="Qty"
                        />
                        <Btn size="sm" variant="ghost" onClick={() => set('sizes', form.sizes.filter((_, n) => n !== i))} aria-label="Remove">
                          <Icon name="trash" size={14} />
                        </Btn>
                      </div>
                    ))}
                    <Btn size="xs" onClick={() => set('sizes', [...form.sizes, { label: '', priceDelta: 0, stock: 0 }])}>
                      <Icon name="plus" size={12} /> Add size
                    </Btn>
                  </div>
                </Field>
              </div>
            )}

            {tab === 'media' && (
              <div className="space-y-6">
                <Field label="Product photos" hint="First one is the main image">
                  <ImageManager
                    value={form.images ?? []}
                    onChange={(images) => set('images', images)}
                    alt={form.name}
                  />
                </Field>

                <Field
                  label="Product videos"
                  hint="YouTube links — shown in the gallery after the photos"
                >
                  <VideoManager
                    value={form.videos ?? []}
                    onChange={(videos) => set('videos', videos)}
                  />
                </Field>

                <div className="rounded-xl bg-blush px-4 py-3 text-[0.8125rem] leading-relaxed text-ink/70">
                  <Icon name="info" size={14} className="mr-1.5 inline text-plum" />
                  With no photo uploaded the product falls back to generated artwork, so a listing is
                  never a broken image. The style and colour below control that fallback.
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Artwork style">
                    <Select value={form.art?.shape} onChange={(e) => setNested('art.shape', e.target.value)}>
                      {ART_SHAPE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </Field>
                  <Field label={`Artwork hue (${form.art?.hue ?? 0}°)`}>
                    <input
                      type="range" min="0" max="360"
                      value={form.art?.hue ?? 0}
                      onChange={(e) => setNested('art.hue', Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full accent-plum"
                      style={{ background: 'linear-gradient(to right, hsl(0 60% 60%), hsl(60 60% 60%), hsl(120 60% 60%), hsl(180 60% 60%), hsl(240 60% 60%), hsl(300 60% 60%), hsl(360 60% 60%))' }}
                    />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'seo' && (
              <div className="space-y-5">
                <Field label="Meta title" hint={`${(form.seo.metaTitle || form.name).length}/60`}>
                  <Input value={form.seo.metaTitle} onChange={(e) => setNested('seo.metaTitle', e.target.value)} placeholder={form.name} />
                </Field>
                <Field label="Meta description" hint={`${(form.seo.metaDescription || form.short).length}/160`}>
                  <Textarea rows={3} value={form.seo.metaDescription} onChange={(e) => setNested('seo.metaDescription', e.target.value)} placeholder={form.short} />
                </Field>
                <Field label="Keywords" hint="Comma separated">
                  <Input
                    value={(form.seo.keywords ?? []).join(', ')}
                    onChange={(e) => setNested('seo.keywords', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
                    placeholder="hijab, georgette, bangladesh"
                  />
                </Field>

                <div className="rounded-xl border border-ink/10 p-4">
                  <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-ink/40">Search preview</p>
                  <p className="mt-2 text-[1.0625rem] leading-snug text-[#1a0dab]">{form.seo.metaTitle || form.name || 'Product name'}</p>
                  <p className="text-[0.75rem] text-[#006621]">goodsbysadia.com › product › {form.slug || 'slug'}</p>
                  <p className="mt-1 text-[0.8125rem] leading-snug text-ink/60">
                    {form.seo.metaDescription || form.short || 'Add a short description to control how this looks in Google.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* preview + publish state */}
        <div className="space-y-4">
          <Card title="Preview">
            <div className="aspect-square overflow-hidden rounded-xl bg-sand">
              {/* keyed on the photo so swapping images repaints immediately */}
              <ProductArt key={form.images?.[0]?.url ?? `${form.art?.shape}-${form.art?.hue}`} product={form} />
            </div>
            <p className="mt-2 text-[0.6875rem] text-ink/45">
              {form.images?.length
                ? `Showing your uploaded photo${form.images.length > 1 ? ` (1 of ${form.images.length})` : ''}`
                : 'Showing generated artwork — upload a photo in the Image tab'}
            </p>
            <p className="mt-3 text-[0.9375rem] font-medium leading-snug">{form.name || 'Product name'}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-xl">{taka(form.price)}</span>
              {form.compareAt > form.price && (
                <span className="text-[0.8125rem] text-ink/40 line-through">{taka(form.compareAt)}</span>
              )}
            </div>
            {form.short && <p className="mt-2 text-[0.8125rem] leading-snug text-ink/55">{form.short}</p>}
          </Card>

          <Card title="Visibility">
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Active — visible in the shop</option>
                <option value="draft">Draft — hidden</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <div className="mt-4">
              <Toggle
                checked={form.featured}
                onChange={(v) => set('featured', v)}
                label="Featured product"
                description="Pushed to the top of category and home listings"
              />
            </div>
          </Card>

          {!isNew && (
            <Card title="Performance">
              <dl className="space-y-2 text-[0.8125rem]">
                <div className="flex justify-between"><dt className="text-ink/55">Units sold</dt><dd className="font-medium">{form.soldCount ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-ink/55">Page views</dt><dd className="font-medium">{form.viewCount ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-ink/55">Rating</dt><dd className="font-medium">{form.rating || '—'} ({form.reviewCount ?? 0})</dd></div>
                {margin != null && (
                  <div className="flex justify-between border-t border-ink/8 pt-2">
                    <dt className="text-ink/55">Margin</dt>
                    <dd><Badge tone={margin > 40 ? 'success' : margin > 20 ? 'warning' : 'danger'}>{margin}%</Badge></dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </AdminPage>
  )
}
