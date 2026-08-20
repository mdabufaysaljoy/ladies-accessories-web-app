import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminApi, qs } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, ORDER_TONE, PAYMENT_TONE, Pagination,
  SearchInput, Select, Spinner, Table, Tabs, Td, EmptyRow, useToasts,
} from '../components/ui'

import { formatDate, taka } from '@/utils/format'

const TABS = [
  { id: 'all', label: 'All' }, { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' }, { id: 'packed', label: 'Packed' },
  { id: 'shipped', label: 'Shipped' }, { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

const METHOD_LABEL = {
  cod: 'COD', sslcommerz: 'SSLCommerz', bkash: 'bKash',
  'bkash-manual': 'bKash manual', 'nagad-manual': 'Nagad manual',
}

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [page, setPage] = useState(1)
  const { push, node } = useToasts()

  const status = params.get('status') ?? 'all'
  const method = params.get('method') ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/orders${qs({ status, method, q, page, limit: 20 })}`)
      setData(res)
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, method, q, page])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    setParams(next)
    setPage(1)
  }

  /** Quick status jump straight from the list — the most common daily action. */
  const advance = async (order, next) => {
    try {
      await adminApi.patch(`/orders/${order._id}/status`, { status: next })
      push(`${order.orderNumber} → ${next}`)
      load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const NEXT_STATUS = {
    pending: 'confirmed', confirmed: 'packed', packed: 'shipped', shipped: 'delivered',
  }

  return (
    <AdminPage
      title="Orders"
      subtitle={data ? `${data.meta.total} orders` : 'Loading…'}
    >
      {node}

      <Card padded={false}>
        <div className="px-3 pt-2">
          <Tabs tabs={TABS} active={status} onChange={(v) => setFilter('status', v)} counts={data?.statusCounts} />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
          <SearchInput value={q} onChange={setQ} placeholder="Order number, name or phone…" className="w-full sm:w-72" />
          <Select value={method} onChange={(e) => setFilter('method', e.target.value)} className="w-auto">
            <option value="">All payment methods</option>
            {Object.entries(METHOD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>

        {loading && !data ? (
          <Spinner />
        ) : data?.orders.length === 0 ? (
          <EmptyRow icon="bag" title="No orders match these filters" body="Try clearing the search or switching tabs." />
        ) : (
          <>
            <Table
              head={[
                { label: 'Order' }, { label: 'Customer' }, { label: 'Items', align: 'center' },
                { label: 'Payment' }, { label: 'Status' }, { label: 'Total', align: 'right' },
                { label: '', align: 'right' },
              ]}
            >
              {data?.orders.map((o) => (
                <tr key={o._id} className="group hover:bg-sand/50">
                  <Td>
                    <Link to={`/admin/orders/${o._id}`} className="font-mono text-[0.8125rem] font-semibold hover:text-plum">
                      {o.orderNumber}
                    </Link>
                    <span className="block text-[0.6875rem] text-ink/40">{formatDate(o.createdAt)}</span>
                  </Td>
                  <Td>
                    <span className="block max-w-[12rem] truncate font-medium">{o.customer.name}</span>
                    <span className="block text-[0.6875rem] text-ink/45">
                      {o.customer.phone} · {o.customer.district}
                    </span>
                  </Td>
                  <Td align="center" className="text-ink/60">
                    {o.lines.reduce((n, l) => n + l.qty, 0)}
                  </Td>
                  <Td>
                    <span className="block text-[0.75rem]">{METHOD_LABEL[o.payment.method] ?? o.payment.method}</span>
                    <Badge tone={PAYMENT_TONE[o.payment.status] ?? 'neutral'} className="mt-1">
                      {o.payment.status}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={ORDER_TONE[o.status] ?? 'neutral'} className="capitalize">{o.status}</Badge>
                  </Td>
                  <Td align="right" className="font-semibold">{taka(o.totals.total)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      {NEXT_STATUS[o.status] && (
                        <Btn size="xs" variant="success" onClick={() => advance(o, NEXT_STATUS[o.status])}>
                          → {NEXT_STATUS[o.status]}
                        </Btn>
                      )}
                      <Btn as={Link} to={`/admin/orders/${o._id}`} size="xs">Open</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={data?.meta} onPage={setPage} />
          </>
        )}
      </Card>
    </AdminPage>
  )
}
