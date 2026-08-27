import { useCallback, useEffect, useState } from 'react'
import { adminApi, api } from '@/lib/api'
import { invalidateCategories } from '@/hooks/useCategories'
import {
  AdminPage, Badge, Btn, Card, Field, Input, Modal,
  Spinner, Table, Td, Textarea, Toggle, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { MediaPicker } from '../components/ImageManager'
import { ART_SHAPE_OPTIONS } from '@/components/product/ProductArt'
import { slugifyClient } from '@/utils/format'

const BLANK = {
  name: '', nameBn: '', slug: '', tagline: '', taglineBn: '', blurb: '',
  imageUrl: '',
  subcategories: [], art: { shape: 'jar', hue: 320 }, order: 0, active: true, featured: true,
  showInNav: true,
}

export default function Categories() {
  const [categories, setCategories] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const { push, node } = useToasts()

  /**
   * `hide` keeps the record and drops it off the site; `delete` removes it for
   * good, forcing past the product-count guard because the dialog has already
   * spelled out that consequence.
   */
  const removeCategory = async (mode) => {
    try {
      const query = mode === 'hide' ? '?mode=hide' : '?force=true'
      await adminApi.delete(`/categories/${confirm._id}${query}`)
      push(mode === 'hide' ? 'Category hidden' : 'Category deleted')
      setConfirm(null)
      load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const load = useCallback(async () => {
    // The storefront memoises categories process-wide; clear it here so the
    // header and menus pick up this change without a page reload.
    invalidateCategories()
    try {
      const d = await api.get('/categories?all=true')
      setCategories(d.categories)
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <AdminPage
      title="Categories"
      subtitle="The shop's navigation and product taxonomy"
      actions={
        <Btn variant="primary" size="md" onClick={() => setEditing({ ...BLANK })}>
          <Icon name="plus" size={15} /> Add category
        </Btn>
      }
    >
      {node}

      <Card padded={false}>
        {!categories ? (
          <Spinner />
        ) : (
          <Table
            head={[
              { label: 'Category' }, { label: 'Types' }, { label: 'Products', align: 'center' },
              { label: 'Status' }, { label: '', align: 'right' },
            ]}
          >
            {categories.map((c) => (
              <tr key={c._id} className="group hover:bg-sand/50">
                <Td>
                  <span className="block font-medium">{c.name}</span>
                  <span className="block text-[0.6875rem] text-ink/45">/{c.slug} · {c.tagline}</span>
                </Td>
                <Td className="text-[0.75rem] text-ink/55">
                  {(c.subcategories ?? []).slice(0, 3).join(', ')}
                  {c.subcategories?.length > 3 && ` +${c.subcategories.length - 3}`}
                </Td>
                <Td align="center" className="font-medium">{c.productCount}</Td>
                <Td>
                  <Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? 'Active' : 'Hidden'}</Badge>
                  {c.active && c.showInNav !== false && (
                    <Badge tone="info" className="ml-1.5">In nav</Badge>
                  )}
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Btn size="xs" onClick={() => setEditing(c)}>Edit</Btn>
                    <Btn size="xs" variant="danger" onClick={() => setConfirm(c)}>
                      <Icon name="trash" size={12} />
                    </Btn>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <CategoryEditor
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); push('Category saved') }}
        onError={(m) => push(m, 'error')}
      />

      {/* Hiding and deleting are offered as separate buttons rather than one
          "Remove" that quietly picks for you — the old dialog turned a delete
          into a hide whenever the category had products, which is why a
          category could never actually be removed. */}
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={`Remove “${confirm?.name}”?`}
        footer={
          <>
            <Btn onClick={() => setConfirm(null)}>Cancel</Btn>
            <Btn onClick={() => removeCategory('hide')}>Hide from the site</Btn>
            <Btn variant="danger" onClick={() => removeCategory('delete')}>
              Delete permanently
            </Btn>
          </>
        }
      >
        <div className="space-y-2.5 text-[0.875rem]">
          {confirm?.productCount > 0 ? (
            <>
              <p className="rounded-lg bg-red-50 px-3.5 py-3 text-red-700">
                {confirm.productCount} product{confirm.productCount === 1 ? '' : 's'} still use this
                category. Deleting it leaves {confirm.productCount === 1 ? 'it' : 'them'}{' '}
                uncategorised — still on sale and still reachable by search, but not listed under
                any category until you reassign {confirm.productCount === 1 ? 'it' : 'them'}.
              </p>
              <p className="text-ink/60">
                <strong>Hide from the site</strong> keeps the category and its products together and
                simply takes it off the navigation and category pages.
              </p>
            </>
          ) : (
            <p className="text-ink/70">
              This category has no products. Deleting it removes it for good; hiding it keeps the
              record so you can bring it back later.
            </p>
          )}
        </div>
      </Modal>
    </AdminPage>
  )
}

/**
 * Splits on commas and newlines so a list can be pasted from anywhere, while
 * leaving the spaces *inside* an entry alone — "Georgette Hijab" is one type,
 * not two.
 */
const parseList = (text) =>
  String(text ?? '')
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)

function CategoryEditor({ category, onClose, onSaved, onError }) {
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [subcategoryText, setSubcategoryText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!category) return
    setForm({ ...BLANK, ...category, art: { ...BLANK.art, ...category.art } })
    setSubcategoryText((category.subcategories ?? []).join(', '))
  }, [category])

  const save = async () => {
    if (!form.name.trim()) return onError('A category name is required')
    setBusy(true)
    try {
      const payload = {
        ...form,
        slug: form.slug || slugifyClient(form.name),
        // Blur normally commits the list, but saving straight from the
        // keyboard can skip it — re-parse so nothing typed is lost.
        subcategories: parseList(subcategoryText),
      }
      if (form._id) await adminApi.patch(`/categories/${form._id}`, payload)
      else await adminApi.post('/categories', payload)
      onSaved()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(category)}
      onClose={onClose}
      title={form._id ? 'Edit category' : 'New category'}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" loading={busy} onClick={save}>Save</Btn></>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value, slug: f._id ? f.slug : slugifyClient(e.target.value) }))
              }}
              placeholder="Hijabs"
            />
          </Field>
          <Field label="Name (Bangla)">
            <Input value={form.nameBn} onChange={(e) => setForm((f) => ({ ...f, nameBn: e.target.value }))} placeholder="হিজাব" />
          </Field>
        </div>

        <Field label="URL slug" hint="/shop/…">
          <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugifyClient(e.target.value) }))} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tagline">
            <Input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="Drape that holds all day" />
          </Field>
          <Field label="Tagline (Bangla)">
            <Input value={form.taglineBn} onChange={(e) => setForm((f) => ({ ...f, taglineBn: e.target.value }))} />
          </Field>
        </div>

        <Field label="Description" hint="Shown at the top of the category page">
          <Textarea rows={3} value={form.blurb} onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))} />
        </Field>

        {/**
          * The raw text lives in its own state and is only parsed into an array
          * on blur.
          *
          * Parsing on every keystroke made this field unusable: the value shown
          * was `array.join(', ')`, so `trim()` deleted a space the moment you
          * typed it — you could never put a space between two words — and
          * `filter(Boolean)` deleted the empty entry a separator creates, so
          * you could never start a second item either.
          */}
        <Field
          label="Types / subcategories"
          hint="Separate with commas — these become the filter options on the category page"
        >
          <Textarea
            rows={4}
            value={subcategoryText}
            onChange={(e) => setSubcategoryText(e.target.value)}
            onBlur={() => setForm((f) => ({ ...f, subcategories: parseList(subcategoryText) }))}
            placeholder="Georgette Hijab, Jersey Hijab, Chiffon Hijab"
          />
          <p className="mt-1.5 text-[0.8125rem] text-ink/55">
            {parseList(subcategoryText).length} type
            {parseList(subcategoryText).length === 1 ? '' : 's'}
            {parseList(subcategoryText).length > 0 && `: ${parseList(subcategoryText).join(' · ')}`}
          </p>
        </Field>

        {/* The tile on the home page uses this photo; the generated artwork
            below is only the stand-in until the shop has one. */}
        <Field label="Category image" hint="Shown on the “Shop by category” tiles">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Artwork style">
            <select
              value={form.art.shape}
              onChange={(e) => setForm((f) => ({ ...f, art: { ...f.art, shape: e.target.value } }))}
              className="h-10 w-full cursor-pointer rounded-lg border border-ink/15 bg-white px-3 text-[0.875rem] outline-none focus:border-ink"
            >
              {ART_SHAPE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label={`Hue (${form.art.hue}°)`}>
            <input
              type="range" min="0" max="360"
              value={form.art.hue}
              onChange={(e) => setForm((f) => ({ ...f, art: { ...f.art, hue: Number(e.target.value) } }))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full accent-plum"
              style={{ background: 'linear-gradient(to right, hsl(0 60% 60%), hsl(120 60% 60%), hsl(240 60% 60%), hsl(360 60% 60%))' }}
            />
          </Field>
        </div>

        <div className="grid gap-4">
          <Field label="Sort order" hint="Lower shows first">
            <Input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
          </Field>
          <div className="flex items-end gap-5 pb-2">
            <Toggle checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Visible" />
            <Toggle checked={form.featured} onChange={(v) => setForm((f) => ({ ...f, featured: v }))} label="On homepage" />
            {/* Separate from "Visible": a category can stay browsable and
                indexed while being left out of a header that only has room
                for a handful of links. */}
            <Toggle
              checked={form.showInNav}
              onChange={(v) => setForm((f) => ({ ...f, showInNav: v }))}
              label="In top navigation"
            />
          </div>
        </div>
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
