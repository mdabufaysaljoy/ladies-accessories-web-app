import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, qs, downloadAdminFile } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, EmptyRow, Pagination, SearchInput,
  Select, Spinner, Table, Td, useToasts,
} from '../components/ui'
import { formatDate, taka } from '@/utils/format'

const SEGMENT_TONE = { vip: 'success', repeat: 'info', new: 'neutral', blocked: 'danger' }

export default function Customers() {
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [segment, setSegment] = useState('')
  const [page, setPage] = useState(1)
  const { push, node } = useToasts()

  /**
   * A customer export is a list of names, numbers and addresses, so the
   * download is authenticated with the admin token rather than being a plain
   * link anyone could share. The server logs every export.
   */
  const exportCustomers = async (format) => {
    try {
      await downloadAdminFile(`/customers/export${qs({ format, q, segment })}`, `customers.${format}`)
      push(`Exported as ${format.toUpperCase()}`)
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const load = useCallback(async () => {
    try {
      setData(await adminApi.get(`/customers${qs({ q, segment, page, limit: 25 })}`))
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, segment, page])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const setRisk = async (customer, riskFlag) => {
    try {
      await adminApi.patch(`/customers/${customer._id}`, { riskFlag })
      push(riskFlag === 'blocked' ? 'Customer blocked' : 'Risk flag updated')
      load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  return (
    <AdminPage
      title="Customers"
      subtitle={data ? `${data.meta.total} customers` : 'Loading…'}
      actions={
        /* Exports follow the search and segment filters, so a shop can pull
           just its VIPs rather than the whole list every time. */
        <Select
          value=""
          onChange={(e) => e.target.value && exportCustomers(e.target.value)}
          className="w-auto"
          aria-label="Export customers"
        >
          <option value="">Export…</option>
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </Select>
      }
    >
      {node}

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
          <SearchInput value={q} onChange={setQ} placeholder="Name, phone or email…" className="w-full sm:w-72" />
          <Select value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1) }} className="w-auto">
            <option value="">All customers</option>
            <option value="new">New (1 order)</option>
            <option value="repeat">Repeat (2–4)</option>
            <option value="vip">VIP (5+)</option>
          </Select>
        </div>

        {!data ? (
          <Spinner />
        ) : data.customers.length === 0 ? (
          <EmptyRow icon="user" title="No customers found" body="Customers are created automatically when an order is placed." />
        ) : (
          <>
            <Table
              head={[
                { label: 'Customer' }, { label: 'Location' }, { label: 'Orders', align: 'center' },
                { label: 'Lifetime value', align: 'right' }, { label: 'Segment' },
                { label: 'Last order' }, { label: '', align: 'right' },
              ]}
            >
              {data.customers.map((c) => (
                <tr key={c._id} className="group hover:bg-sand/50">
                  <Td>
                    <Link to={`/admin/customers/${c._id}`} className="block font-medium hover:text-plum">
                      {c.name || 'Unnamed'}
                    </Link>
                    <span className="block text-[0.6875rem] text-ink/45">{c.phone}{c.email && ` · ${c.email}`}</span>
                  </Td>
                  <Td className="text-[0.8125rem] text-ink/60">{[c.area, c.district].filter(Boolean).join(', ') || '—'}</Td>
                  <Td align="center">
                    <span className="font-medium">{c.orderCount}</span>
                    {c.cancelledCount > 0 && (
                      <span className="block text-[0.6875rem] text-red-600">{c.cancelledCount} cancelled</span>
                    )}
                  </Td>
                  <Td align="right" className="font-semibold">{taka(c.totalSpent)}</Td>
                  <Td>
                    <Badge tone={SEGMENT_TONE[c.segment] ?? 'neutral'} className="capitalize">{c.segment}</Badge>
                  </Td>
                  <Td className="text-[0.8125rem] text-ink/50">{c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      {c.riskFlag === 'blocked' ? (
                        <Btn size="xs" variant="success" onClick={() => setRisk(c, 'none')}>Unblock</Btn>
                      ) : (
                        <Btn size="xs" variant="danger" onClick={() => setRisk(c, 'blocked')}>Block</Btn>
                      )}
                      <Btn as={Link} to={`/admin/customers/${c._id}`} size="xs">View</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={data.meta} onPage={setPage} />
          </>
        )}
      </Card>
    </AdminPage>
  )
}
