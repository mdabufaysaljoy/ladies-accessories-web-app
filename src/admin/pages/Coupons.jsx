import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, ConfirmDialog, EmptyRow, Field, Input, NumberInput,
  Modal, Select, Spinner, Table, Td, Toggle, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { formatDate, taka } from '@/utils/format'

const BLANK = {
  code: '', label: '', type: 'percent', value: 10, minSpend: 0,
  maxDiscount: 0, usageLimit: 0, active: true, expiresAt: '',
}

export default function Coupons() {
  const [coupons, setCoupons] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const { push, node } = useToasts()

  const load = useCallback(async () => {
    try {
      setCoupons((await adminApi.get('/coupons')).coupons)
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const describe = (c) =>
    c.type === 'percent' ? `${c.value}% off` : c.type === 'flat' ? `${taka(c.value)} off` : 'Free delivery'

  return (
    <AdminPage
      title="Coupons"
      subtitle="Discount codes customers can use at checkout"
      actions={
        <Btn variant="primary" size="md" onClick={() => setEditing({ ...BLANK })}>
          <Icon name="plus" size={15} /> New coupon
        </Btn>
      }
    >
      {node}

      <Card padded={false}>
        {!coupons ? (
          <Spinner />
        ) : coupons.length === 0 ? (
          <EmptyRow
            icon="gift"
            title="No coupons yet"
            body="Create a code to run a sale or reward repeat customers."
            action={<Btn variant="primary" onClick={() => setEditing({ ...BLANK })}>New coupon</Btn>}
          />
        ) : (
          <Table
            head={[
              { label: 'Code' }, { label: 'Discount' }, { label: 'Minimum spend' },
              { label: 'Used', align: 'center' }, { label: 'Expires' }, { label: 'Status' },
              { label: '', align: 'right' },
            ]}
          >
            {coupons.map((c) => (
              <tr key={c._id} className="group hover:bg-sand/50">
                <Td>
                  <span className="block font-mono font-semibold">{c.code}</span>
                  <span className="block text-[0.6875rem] text-ink/45">{c.label}</span>
                </Td>
                <Td className="font-medium">{describe(c)}</Td>
                <Td className="text-ink/60">{c.minSpend ? taka(c.minSpend) : '—'}</Td>
                <Td align="center">
                  {c.usedCount}
                  {c.usageLimit > 0 && <span className="text-ink/40">/{c.usageLimit}</span>}
                </Td>
                <Td className="text-[0.8125rem] text-ink/55">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</Td>
                <Td><Badge tone={c.active ? 'success' : 'neutral'}>{c.active ? 'Active' : 'Paused'}</Badge></Td>
                <Td align="right">
                  <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Btn size="xs" onClick={() => setEditing({ ...c, expiresAt: c.expiresAt?.slice(0, 10) ?? '' })}>Edit</Btn>
                    <Btn size="xs" variant="danger" onClick={() => setConfirm(c)}><Icon name="trash" size={12} /></Btn>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <CouponEditor
        coupon={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); push('Coupon saved') }}
        onError={(m) => push(m, 'error')}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={`Delete ${confirm?.code}?`}
        body="Customers will no longer be able to use this code. Orders already placed with it are unaffected."
        onConfirm={async () => {
          await adminApi.delete(`/coupons/${confirm._id}`)
          push('Coupon deleted')
          load()
        }}
      />
    </AdminPage>
  )
}

function CouponEditor({ coupon, onClose, onSaved, onError }) {
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (coupon) setForm({ ...BLANK, ...coupon }) }, [coupon])
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = async () => {
    if (!form.code.trim()) return onError('A coupon code is required')
    setBusy(true)
    try {
      const payload = { ...form, expiresAt: form.expiresAt || null }
      if (form._id) await adminApi.patch(`/coupons/${form._id}`, payload)
      else await adminApi.post('/coupons', payload)
      onSaved()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(coupon)}
      onClose={onClose}
      title={form._id ? `Edit ${form.code}` : 'New coupon'}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" loading={busy} onClick={save}>Save</Btn></>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required hint="Shown to customers">
            <Input value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="EID25" className="font-mono" />
          </Field>
          <Field label="Description" hint="Explains the offer at checkout">
            <Input value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="25% off — Eid special" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Discount type">
            <Select value={form.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="percent">Percentage off</option>
              <option value="flat">Fixed amount off</option>
              <option value="shipping">Free delivery</option>
            </Select>
          </Field>
          {form.type !== 'shipping' && (
            <Field label={form.type === 'percent' ? 'Percentage (%)' : 'Amount (৳)'}>
              <NumberInput min="0" value={form.value} onChange={(v) => set({ value: v })} />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum spend (৳)" hint="0 = no minimum">
            <NumberInput min="0" value={form.minSpend} onChange={(v) => set({ minSpend: v })} />
          </Field>
          {form.type === 'percent' && (
            <Field label="Maximum discount (৳)" hint="Caps a percentage discount — 0 = uncapped">
              <NumberInput min="0" value={form.maxDiscount} onChange={(v) => set({ maxDiscount: v })} />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total usage limit" hint="0 = unlimited">
            <NumberInput min="0" value={form.usageLimit} onChange={(v) => set({ usageLimit: v })} />
          </Field>
          <Field label="Expires on" hint="Optional">
            <Input type="date" value={form.expiresAt ?? ''} onChange={(e) => set({ expiresAt: e.target.value })} />
          </Field>
        </div>

        <Toggle checked={form.active} onChange={(v) => set({ active: v })} label="Active" description="Turn off to pause without deleting" />
      </div>
    </Modal>
  )
}
