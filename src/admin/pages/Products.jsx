import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminApi, api, qs, downloadAdminFile } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, Checkbox, EmptyRow, Modal, Pagination, SearchInput, Select, Spinner, Table, Td, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { useAdminAuth } from '../AdminAuth'
import { ProductArt } from '@/components/product/ProductArt'
import { ImportProducts } from '../components/ImportProducts'
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
  const [importOpen, setImportOpen] = useState(false)
  const { push, node } = useToasts()
  const { user } = useAdminAuth()
  const isOwner = user?.role === 'owner'
  const [removing, setRemoving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectAllMatching, setSelectAllMatching] = useState(false)

  /**
   * Downloads are authenticated, so they cannot be a plain link — fetch with
   * the admin token and hand the browser a blob.
   */
  const exportProducts = async (format) => {
    try {
      await downloadAdminFile(`/products/export${qs({ format, category, status, q })}`, `products.${format}`)
      push(`Exported as ${format.toUpperCase()}`)
    } catch (err) {
      push(err.message, 'error')
    }
  }

  /**
   * `hard` maps to the API's owner-only permanent delete; without it the
   * product is archived. Either way the list is reloaded so the row visibly
   * changes — the old flow reported success and left the row looking untouched.
   */
  const remove = async (hard) => {
    setRemoving(true)
    try {
      await adminApi.delete(`/products/${confirm._id}${hard ? '?hard=true' : ''}`)
      push(hard ? `“${confirm.name}” deleted` : `“${confirm.name}” archived`)
      setConfirm(null)
      load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setRemoving(false)
    }
  }


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

  /**
   * Permanent bulk delete.
   *
   * When the admin chose "select all that match", the filter goes to the
   * server rather than a list of ids — the selection then means every product
   * matching the search, not the twenty on screen.
   */
  const deleteSelected = async () => {
    setRemoving(true)
    try {
      const body = selectAllMatching ? { all: true, category, status, q } : { ids: selected }
      const res = await adminApi.post('/products/bulk-delete', body)
      push(
        `${res.deleted} product${res.deleted === 1 ? '' : 's'} deleted permanently` +
          (res.reviewsDeleted ? ` · ${res.reviewsDeleted} reviews removed` : ''),
      )
      setDeleteOpen(false)
      setSelected([])
      setSelectAllMatching(false)
      load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setRemoving(false)
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
        <div className="flex flex-wrap gap-2">
          {/* Exports honour the filters above, so "export what I'm looking at"
              works rather than always dumping the whole catalogue. */}
          <Select
            value=""
            onChange={(e) => e.target.value && exportProducts(e.target.value)}
            className="w-auto"
            aria-label="Export products"
          >
            <option value="">Export…</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </Select>
          <Btn variant="ghost" size="md" onClick={() => setImportOpen(true)}>
            <Icon name="grid" size={15} /> Bulk import
          </Btn>
          <Btn as={Link} to="/admin/products/new" variant="primary" size="md">
            <Icon name="plus" size={15} /> Add product
          </Btn>
        </div>
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
            <span className="text-[0.8125rem] font-medium">
              {selectAllMatching
                ? `All ${data.meta.total} products selected`
                : `${selected.length} selected`}
            </span>
            {/* The header checkbox can only reach the page you are looking at.
                When a filter matches more than that, offer the rest explicitly
                rather than letting "select all" quietly mean "select 24". */}
            {allSelected && !selectAllMatching && data.meta.total > selected.length && (
              <button
                type="button"
                onClick={() => setSelectAllMatching(true)}
                className="text-[0.75rem] font-medium text-plum underline"
              >
                Select all {data.meta.total} that match
              </button>
            )}
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
            {/* Owner-only, and kept visually apart from Archive: one is a
                reversible status change, the other empties the row out of the
                database. */}
            {isOwner && (
              <Btn size="xs" variant="danger" onClick={() => setDeleteOpen(true)}>
                <Icon name="trash" size={12} /> Delete permanently
              </Btn>
            )}
            <button
              type="button"
              onClick={() => { setSelected([]); setSelectAllMatching(false) }}
              className="ml-auto text-[0.75rem] text-ink/50 underline"
            >
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
                      onChange={(v) => {
                        setSelectAllMatching(false)
                        setSelected(v ? data.products.map((p) => p._id) : [])
                      }}
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
                        onChange={(v) => {
                          setSelectAllMatching(false)
                          setSelected((s) => (v ? [...s, p._id] : s.filter((x) => x !== p._id)))
                        }}
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
                        <Btn
                          size="xs"
                          variant="danger"
                          onClick={() => setConfirm(p)}
                          aria-label={`Remove ${p.name}`}
                          title="Archive or delete"
                        >
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

      <ImportProducts
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />

      {/* Archiving and deleting are genuinely different outcomes, so the
          dialog offers both rather than hiding one behind a trash icon that
          silently archives and leaves the row sitting in the list. */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={
          selectAllMatching
            ? `Delete all ${data?.meta.total ?? 0} matching products?`
            : `Delete ${selected.length} product${selected.length === 1 ? '' : 's'}?`
        }
        size="sm"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Btn variant="ghost" onClick={() => setDeleteOpen(false)} disabled={removing}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={deleteSelected} loading={removing}>
              Delete permanently
            </Btn>
          </div>
        }
      >
        <div className="space-y-3 text-[0.875rem] leading-relaxed text-ink/70">
          <p className="rounded-xl bg-red-50 px-3.5 py-3 text-red-700">
            This removes {selectAllMatching ? 'every product matching the current filter' : 'them'}{' '}
            from the database for good. There is no undo — use Archive if you might want them back.
          </p>
          <p>
            Past orders and invoices are unaffected: each order line keeps its own copy of the name,
            price, SKU and image as they were at the time of purchase.
          </p>
          <p>
            Any reviews written about {selectAllMatching ? 'these products' : 'them'} are deleted
            too, since a review of a product that no longer exists cannot be read and would keep
            counting towards your ratings.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={`Remove “${confirm?.name}”?`}
        size="sm"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Btn variant="ghost" onClick={() => setConfirm(null)} disabled={removing}>
              Cancel
            </Btn>
            <Btn onClick={() => remove(false)} loading={removing}>
              Archive
            </Btn>
            {isOwner && (
              <Btn variant="danger" onClick={() => remove(true)} loading={removing}>
                Delete permanently
              </Btn>
            )}
          </div>
        }
      >
        <div className="space-y-3 text-[0.875rem] leading-relaxed text-ink/70">
          <p>
            <strong className="font-semibold text-ink">Archive</strong> hides it from the storefront
            but keeps it in this list under the Archived filter, so you can put it back later.
          </p>
          <p>
            <strong className="font-semibold text-ink">Delete permanently</strong> removes it for
            good. Past orders and invoices are unaffected — each one stores its own copy of the name,
            price and image as they were at the time of purchase.
          </p>
          {!isOwner && (
            <p className="rounded-xl bg-sand px-3.5 py-2.5 text-[0.8125rem]">
              Only an owner can delete permanently.
            </p>
          )}
        </div>
      </Modal>
    </AdminPage>
  )
}
