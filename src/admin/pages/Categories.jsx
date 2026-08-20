import { useCallback, useEffect, useState } from 'react'
import { adminApi, api } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, ConfirmDialog, Field, Input, Modal,
  Spinner, Table, Td, Textarea, Toggle, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { ART_SHAPE_OPTIONS } from '@/components/product/ProductArt'
import { slugifyClient } from '@/utils/format'

const BLANK = {
  name: '', nameBn: '', slug: '', tagline: '', taglineBn: '', blurb: '',
  subcategories: [], art: { shape: 'jar', hue: 320 }, order: 0, active: true, featured: true,
}

export default function Categories() {
  const [categories, setCategories] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const { push, node } = useToasts()

  const load = useCallback(async () => {
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

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={`Remove “${confirm?.name}”?`}
        body={
          confirm?.productCount > 0
            ? `${confirm.productCount} products still use this category, so it will be hidden rather than deleted. Move those products first if you want it gone completely.`
            : 'This category has no products and will be deleted permanently.'
        }
        confirmLabel={confirm?.productCount > 0 ? 'Hide category' : 'Delete'}
        onConfirm={async () => {
          await adminApi.delete(`/categories/${confirm._id}?force=true`)
          push('Category removed')
          load()
        }}
      />
    </AdminPage>
  )
}

function CategoryEditor({ category, onClose, onSaved, onError }) {
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (category) setForm({ ...BLANK, ...category, art: { ...BLANK.art, ...category.art } })
  }, [category])

  const save = async () => {
    if (!form.name.trim()) return onError('A category name is required')
    setBusy(true)
    try {
      const payload = { ...form, slug: form.slug || slugifyClient(form.name) }
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

        <Field label="Types / subcategories" hint="One per line — these become the filter options">
          <Textarea
            rows={5}
            value={(form.subcategories ?? []).join('\n')}
            onChange={(e) => setForm((f) => ({ ...f, subcategories: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }))}
            placeholder={'Georgette Hijab\nJersey Hijab\nChiffon Hijab'}
          />
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sort order" hint="Lower shows first">
            <Input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
          </Field>
          <div className="flex items-end gap-5 pb-2">
            <Toggle checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Visible" />
            <Toggle checked={form.featured} onChange={(v) => setForm((f) => ({ ...f, featured: v }))} label="On homepage" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
