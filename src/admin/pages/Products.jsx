import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminApi, api, qs } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, Checkbox, ConfirmDialog, EmptyRow, Pagination,
  SearchInput, Select, Spinner, Table, Td, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { taka } from '@/utils/format'

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [confirm, setConfirm] = useState(null)
  const { push, node } = useToasts()

  const category = params.get('category') ?? ''
  const status = params.get('status') ?? ''
  const stock = params.get('stock') ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/products/admin/list${qs({ category, status, stock, q, page, limit: 20 })}`)
      setData(res)
      setSelected([])
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status, stock, q, page])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  useEffect(() => {
    api.get('/categories?all=true').then((d) => setCategories(d.categories)).catch(() => {})
  }, [])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
    setPage(1)
  }

  const bulk = async (action, value) => {
    try {
      const res = await adminApi.post('/products/bulk', { ids: selected, action, value })
      push(`${res.modified} products updated`)
      load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const duplicate = async (product) => {
    try {
      await adminApi.post(`/products/${product._id}/duplicate`)
      push(`Duplicated “${product.name}” as a draft`)
      load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const allSelected = data?.products.length > 0 && selected.length === data.products.length

  return (
    <AdminPage
      title="Products"
      subtitle={data ? `${data.meta.total} products` : 'Loading…'}
      actions={
        <Btn as={Link} to="/admin/products/new" variant="primary" size="md">
          <Icon name="plus" size={15} /> Add product
        </Btn>
      }
    >
      {node}

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
          <SearchInput value={q} onChange={setQ} placeholder="Name, SKU or slug…" className="w-full sm:w-64" />
          <Select value={category} onChange={(e) => setFilter('category', e.target.value)} className="w-auto">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setFilter('status', e.target.value)} className="w-auto">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <Select value={stock} onChange={(e) => setFilter('stock', e.target.value)} className="w-auto">
            <option value="">Any stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-y border-ink/8 bg-blush/60 px-5 py-3">
            <span className="text-[0.8125rem] font-medium">{selected.length} selected</span>
            <Btn size="xs" onClick={() => bulk('status', 'active')}>Publish</Btn>
            <Btn size="xs" onClick={() => bulk('status', 'draft')}>Move to draft</Btn>
            <Btn size="xs" onClick={() => bulk('featured', true)}>Feature</Btn>
            <Btn size="xs" onClick={() => bulk('featured', false)}>Unfeature</Btn>
            <Btn
              size="xs"
              onClick={() => {
                const v = prompt('Add how many units to stock? (use a negative number to subtract)')
                if (v !== null && v !== '') bulk('stock-add', Number(v))
              }}
            >
              Adjust stock
            </Btn>
            <Btn size="xs" variant="danger" onClick={() => bulk('status', 'archived')}>Archive</Btn>
            <button type="button" onClick={() => setSelected([])} className="ml-auto text-[0.75rem] text-ink/50 underline">
              Clear
            </button>
          </div>
        )}

        {loading && !data ? (
          <Spinner />
        ) : data?.products.length === 0 ? (
          <EmptyRow
            icon="sparkle"
            title="No products match"
            body="Try a different filter, or add your first product."
            action={<Btn as={Link} to="/admin/products/new" variant="primary">Add product</Btn>}
          />
        ) : (
          <>
            <Table
              head={[
                {
                  label: (
                    <Checkbox
                      checked={allSelected}
                      onChange={(v) => setSelected(v ? data.products.map((p) => p._id) : [])}
                    />
                  ),
                  width: '2.5rem',
                },
                { label: 'Product' }, { label: 'Category' }, { label: 'Price' },
                { label: 'Stock', align: 'center' }, { label: 'Status' }, { label: '', align: 'right' },
              ]}
            >
              {data?.products.map((p) => {
                const low = p.trackInventory && p.stock <= p.lowStockThreshold
                return (
                  <tr key={p._id} className="group hover:bg-sand/50">
                    <Td>
                      <Checkbox
                        checked={selected.includes(p._id)}
                        onChange={(v) => setSelected((s) => (v ? [...s, p._id] : s.filter((x) => x !== p._id)))}
                      />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-sand">
                          <ProductArt product={p} decorative={false} />
                        </div>
                        <div className="min-w-0">
                          <Link to={`/admin/products/${p._id}`} className="block max-w-[16rem] truncate font-medium hover:text-plum">
                            {p.name}
                          </Link>
                          <span className="block text-[0.6875rem] text-ink/45">{p.sku || p.slug}</span>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[0.8125rem] text-ink/60">
                      {p.category}
                      <span className="block text-[0.6875rem] text-ink/40">{p.subcategory}</span>
                    </Td>
                    <Td>
                      <span className="font-medium">{taka(p.price)}</span>
                      {p.compareAt > p.price && (
                        <span className="block text-[0.6875rem] text-ink/40 line-through">{taka(p.compareAt)}</span>
                      )}
                    </Td>
                    <Td align="center">
                      {!p.trackInventory ? (
                        <span className="text-[0.75rem] text-ink/40">Not tracked</span>
                      ) : (
                        <Badge tone={p.stock === 0 ? 'danger' : low ? 'warning' : 'neutral'}>{p.stock}</Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={p.status === 'active' ? 'success' : p.status === 'draft' ? 'warning' : 'neutral'} className="capitalize">
                        {p.status}
                      </Badge>
                      {p.featured && <Badge tone="info" className="ml-1">Featured</Badge>}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Btn size="xs" onClick={() => duplicate(p)}>Duplicate</Btn>
                        <Btn as={Link} to={`/admin/products/${p._id}`} size="xs" variant="primary">Edit</Btn>
                        <Btn size="xs" variant="danger" onClick={() => setConfirm(p)}>
                          <Icon name="trash" size={12} />
                        </Btn>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </Table>
            <Pagination meta={data?.meta} onPage={setPage} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={`Archive “${confirm?.name}”?`}
        body="The product is hidden from the storefront but kept so past orders still show it correctly. You can restore it any time from the Archived filter."
        confirmLabel="Archive"
        onConfirm={async () => {
          await adminApi.delete(`/products/${confirm._id}`)
          push('Product archived')
          load()
        }}
      />
    </AdminPage>
  )
}
