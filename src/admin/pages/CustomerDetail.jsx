import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminApi } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, Field, ORDER_TONE, Select,
  Spinner, Table, Td, Textarea, Toggle, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { formatDate, taka } from '@/utils/format'

export default function CustomerDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [notes, setNotes] = useState('')
  const { push, node } = useToasts()

  const load = useCallback(async () => {
    try {
      const res = await adminApi.get(`/customers/${id}`)
      setData(res)
      setNotes(res.customer.notes ?? '')
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { load() }, [load])

  if (!data) return <Spinner className="min-h-[60vh]" />
  const { customer, orders } = data

  const patch = async (body, message) => {
    try {
      const res = await adminApi.patch(`/customers/${id}`, body)
      setData((d) => ({ ...d, customer: res.customer }))
      push(message)
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const waLink = `https://wa.me/${customer.phone}?text=${encodeURIComponent(`Assalamu alaikum ${customer.name ?? ''}!`)}`

  return (
    <AdminPage
      title={customer.name || customer.phone}
      subtitle={`${customer.orderCount} orders · ${taka(customer.totalSpent)} lifetime value`}
      actions={
        <>
          <Btn as={Link} to="/admin/customers" size="md"><Icon name="chevronLeft" size={14} /> Customers</Btn>
          <Btn as="a" href={waLink} target="_blank" rel="noopener noreferrer" size="md">
            <Icon name="whatsapp" size={15} /> WhatsApp
          </Btn>
          <Btn as="a" href={`tel:${customer.phone}`} variant="primary" size="md">
            <Icon name="phone" size={15} /> Call
          </Btn>
        </>
      }
    >
      {node}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card title="Order history" padded={false}>
          {orders.length === 0 ? (
            <p className="px-5 py-10 text-center text-[0.875rem] text-ink/45">No orders yet.</p>
          ) : (
            <Table head={[{ label: 'Order' }, { label: 'Date' }, { label: 'Items', align: 'center' }, { label: 'Status' }, { label: 'Total', align: 'right' }]}>
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-sand/50">
                  <Td>
                    <Link to={`/admin/orders/${o._id}`} className="font-mono text-[0.8125rem] font-medium hover:text-plum">
                      {o.orderNumber}
                    </Link>
                  </Td>
                  <Td className="text-[0.8125rem] text-ink/55">{formatDate(o.createdAt)}</Td>
                  <Td align="center">{o.lines.reduce((n, l) => n + l.qty, 0)}</Td>
                  <Td><Badge tone={ORDER_TONE[o.status] ?? 'neutral'} className="capitalize">{o.status}</Badge></Td>
                  <Td align="right" className="font-semibold">{taka(o.totals.total)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="space-y-2.5 text-[0.8125rem]">
              <div className="flex justify-between gap-3"><dt className="text-ink/50">Phone</dt><dd>{customer.phone}</dd></div>
              {customer.email && <div className="flex justify-between gap-3"><dt className="text-ink/50">Email</dt><dd className="truncate">{customer.email}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-ink/50">Location</dt><dd className="text-right">{[customer.area, customer.district].filter(Boolean).join(', ') || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/50">Cancelled</dt><dd>{customer.cancelledCount}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/50">Segment</dt><dd className="capitalize">{customer.segment}</dd></div>
            </dl>
            {customer.address && (
              <address className="mt-3 rounded-lg bg-sand px-3 py-2.5 text-[0.8125rem] not-italic leading-relaxed text-ink/65">
                {customer.address}
              </address>
            )}
          </Card>

          <Card title="Risk & marketing">
            <Field label="Risk flag" hint="Blocked customers cannot place COD orders">
              <Select value={customer.riskFlag} onChange={(e) => patch({ riskFlag: e.target.value }, 'Risk flag updated')}>
                <option value="none">No concerns</option>
                <option value="watch">Watch</option>
                <option value="blocked">Blocked</option>
              </Select>
            </Field>
            <div className="mt-4">
              <Toggle
                checked={customer.acceptsMarketing}
                onChange={(v) => patch({ acceptsMarketing: v }, 'Marketing preference updated')}
                label="Include in email campaigns"
              />
            </div>
          </Card>

          <Card title="Internal notes">
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prefers delivery after 6pm…" />
            <Btn size="sm" className="mt-2.5 w-full" onClick={() => patch({ notes }, 'Notes saved')}>Save notes</Btn>
          </Card>
        </div>
      </div>
    </AdminPage>
  )
}
