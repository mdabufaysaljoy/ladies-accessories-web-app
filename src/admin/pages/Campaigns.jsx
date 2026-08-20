import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import {
  AdminPage, Badge, Btn, Card, ConfirmDialog, EmptyRow, Field, Input,
  Modal, Select, Spinner, Table, Tabs, Td, Textarea, useToasts,
} from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { formatDate } from '@/utils/format'

const STATUS_TONE = {
  draft: 'neutral', scheduled: 'info', sending: 'warning',
  sent: 'success', failed: 'danger', cancelled: 'neutral',
}

const BLANK = {
  name: '', subject: '', preheader: '', bodyHtml: '',
  audience: { type: 'subscribers', segment: 'all', manualEmails: [] },
}

export default function Campaigns() {
  const [tab, setTab] = useState('campaigns')
  const [campaigns, setCampaigns] = useState(null)
  const [subscribers, setSubscribers] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const { push, node } = useToasts()

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        adminApi.get('/campaigns?limit=50'),
        adminApi.get('/campaigns/subscribers?limit=100'),
      ])
      setCampaigns(c)
      setSubscribers(s)
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  // A send runs in the background — poll while anything is in flight.
  useEffect(() => {
    if (!campaigns?.campaigns.some((c) => c.status === 'sending')) return
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [campaigns, load])

  const send = async (campaign) => {
    try {
      const res = await adminApi.post(`/campaigns/${campaign._id}/send`)
      push(`Sending to ${res.queued} recipients…`)
      load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const sendTest = async (campaign) => {
    try {
      const res = await adminApi.post(`/campaigns/${campaign._id}/test`, {})
      push(res.result?.simulated ? 'SMTP not configured — test was simulated' : `Test sent to ${res.to}`, res.result?.simulated ? 'info' : 'success')
    } catch (err) {
      push(err.message, 'error')
    }
  }

  return (
    <AdminPage
      title="Email"
      subtitle="Promotional campaigns and your subscriber list"
      actions={
        <Btn variant="primary" size="md" onClick={() => setEditing({ ...BLANK })}>
          <Icon name="plus" size={15} /> New campaign
        </Btn>
      }
    >
      {node}

      <div className="mb-5">
        <Tabs
          tabs={[
            { id: 'campaigns', label: 'Campaigns' },
            { id: 'subscribers', label: 'Subscribers' },
          ]}
          active={tab}
          onChange={setTab}
          counts={{ campaigns: campaigns?.meta?.total, subscribers: subscribers?.activeCount }}
        />
      </div>

      {tab === 'campaigns' && (
        <Card padded={false}>
          {!campaigns ? (
            <Spinner />
          ) : campaigns.campaigns.length === 0 ? (
            <EmptyRow
              icon="mail"
              title="No campaigns yet"
              body="Create a campaign to announce a restock, a sale or a new arrival to your subscribers."
              action={<Btn variant="primary" onClick={() => setEditing({ ...BLANK })}>New campaign</Btn>}
            />
          ) : (
            <Table
              head={[
                { label: 'Campaign' }, { label: 'Audience' }, { label: 'Status' },
                { label: 'Sent', align: 'center' }, { label: '', align: 'right' },
              ]}
            >
              {campaigns.campaigns.map((c) => (
                <tr key={c._id} className="group hover:bg-sand/50">
                  <Td>
                    <span className="block font-medium">{c.name}</span>
                    <span className="block max-w-[20rem] truncate text-[0.75rem] text-ink/50">{c.subject}</span>
                  </Td>
                  <Td className="text-[0.8125rem] capitalize text-ink/60">
                    {c.audience.type}
                    {c.audience.type === 'segment' && ` · ${c.audience.segment}`}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[c.status]} className="capitalize">{c.status}</Badge>
                    {c.stats?.simulated && <Badge tone="warning" className="ml-1">Simulated</Badge>}
                  </Td>
                  <Td align="center" className="text-[0.8125rem]">
                    {c.status === 'sent' || c.status === 'sending' ? (
                      <>
                        <span className="font-medium">{c.stats.sent}</span>
                        <span className="text-ink/40">/{c.stats.recipients}</span>
                        {c.stats.failed > 0 && <span className="block text-[0.6875rem] text-red-600">{c.stats.failed} failed</span>}
                        {c.sentAt && <span className="block text-[0.6875rem] text-ink/40">{formatDate(c.sentAt)}</span>}
                      </>
                    ) : (
                      <span className="text-ink/35">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Btn size="xs" onClick={() => sendTest(c)}>Test</Btn>
                      {c.status !== 'sent' && c.status !== 'sending' && (
                        <>
                          <Btn size="xs" onClick={() => setEditing(c)}>Edit</Btn>
                          <Btn size="xs" variant="success" onClick={() => setConfirm({ type: 'send', campaign: c })}>Send</Btn>
                        </>
                      )}
                      <Btn size="xs" variant="danger" onClick={() => setConfirm({ type: 'delete', campaign: c })}>
                        <Icon name="trash" size={12} />
                      </Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === 'subscribers' && (
        <Card
          title={`${subscribers?.activeCount ?? 0} active subscribers`}
          description="Collected from the newsletter form in the footer"
          padded={false}
        >
          {!subscribers ? (
            <Spinner />
          ) : subscribers.subscribers.length === 0 ? (
            <EmptyRow icon="mail" title="No subscribers yet" body="They will appear here as customers join your newsletter." />
          ) : (
            <Table head={[{ label: 'Email' }, { label: 'Name' }, { label: 'Source' }, { label: 'Status' }, { label: 'Joined' }, { label: '', align: 'right' }]}>
              {subscribers.subscribers.map((s) => (
                <tr key={s._id} className="group hover:bg-sand/50">
                  <Td className="font-medium">{s.email}</Td>
                  <Td className="text-ink/60">{s.name || '—'}</Td>
                  <Td className="text-[0.8125rem] text-ink/50">{s.source}</Td>
                  <Td><Badge tone={s.status === 'subscribed' ? 'success' : 'neutral'}>{s.status}</Badge></Td>
                  <Td className="text-[0.8125rem] text-ink/50">{formatDate(s.createdAt)}</Td>
                  <Td align="right">
                    <Btn
                      size="xs"
                      variant="danger"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={async () => {
                        await adminApi.delete(`/campaigns/subscribers/${s._id}`)
                        push('Subscriber removed')
                        load()
                      }}
                    >
                      <Icon name="trash" size={12} />
                    </Btn>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      <CampaignEditor
        campaign={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
        onError={(m) => push(m, 'error')}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.type === 'send' ? `Send “${confirm?.campaign.name}”?` : `Delete “${confirm?.campaign.name}”?`}
        body={
          confirm?.type === 'send'
            ? 'This will email every recipient in the selected audience. Send a test to yourself first if you have not already — this cannot be undone.'
            : 'The campaign and its statistics will be permanently removed.'
        }
        confirmLabel={confirm?.type === 'send' ? 'Send now' : 'Delete'}
        tone={confirm?.type === 'send' ? 'success' : 'danger'}
        onConfirm={async () => {
          if (confirm.type === 'send') await send(confirm.campaign)
          else {
            await adminApi.delete(`/campaigns/${confirm.campaign._id}`)
            push('Campaign deleted')
            load()
          }
        }}
      />
    </AdminPage>
  )
}

function CampaignEditor({ campaign, onClose, onSaved, onError }) {
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [audienceCount, setAudienceCount] = useState(null)

  useEffect(() => {
    if (campaign) setForm({ ...BLANK, ...campaign, audience: { ...BLANK.audience, ...campaign.audience } })
    setAudienceCount(null)
  }, [campaign])

  const save = async () => {
    if (!form.name.trim() || !form.subject.trim()) {
      onError('A name and subject line are required')
      return
    }
    setBusy(true)
    try {
      if (form._id) await adminApi.patch(`/campaigns/${form._id}`, form)
      else await adminApi.post('/campaigns', form)
      onSaved()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const previewAudience = async () => {
    if (!form._id) {
      onError('Save the campaign first to preview its audience')
      return
    }
    try {
      const res = await adminApi.post(`/campaigns/${form._id}/preview-audience`)
      setAudienceCount(res.count)
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <Modal
      open={Boolean(campaign)}
      onClose={onClose}
      title={form._id ? 'Edit campaign' : 'New campaign'}
      description="Write once, send to your subscribers or a customer segment."
      size="lg"
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" loading={busy} onClick={save}>Save campaign</Btn></>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name" hint="Internal only" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Eid restock announcement" />
          </Field>
          <Field label="Subject line" required>
            <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="New hijab colours just landed 🌸" />
          </Field>
        </div>

        <Field label="Preheader" hint="Preview text after the subject in the inbox">
          <Input value={form.preheader} onChange={(e) => setForm((f) => ({ ...f, preheader: e.target.value }))} placeholder="Six new georgette shades, back in stock now." />
        </Field>

        <Field label="Email body" hint="Basic HTML is supported">
          <Textarea
            rows={8}
            value={form.bodyHtml}
            onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
            placeholder={'<p>Assalamu alaikum!</p>\n<p>Our Signature Georgette hijab is back in six new shades…</p>'}
            className="font-mono text-[0.8125rem]"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Send to">
            <Select
              value={form.audience.type}
              onChange={(e) => setForm((f) => ({ ...f, audience: { ...f.audience, type: e.target.value } }))}
            >
              <option value="subscribers">Newsletter subscribers</option>
              <option value="customers">All customers with an email</option>
              <option value="segment">A customer segment</option>
              <option value="manual">A specific list of addresses</option>
            </Select>
          </Field>

          {form.audience.type === 'segment' && (
            <Field label="Segment">
              <Select
                value={form.audience.segment}
                onChange={(e) => setForm((f) => ({ ...f, audience: { ...f.audience, segment: e.target.value } }))}
              >
                <option value="all">Everyone</option>
                <option value="new">New — 1 order or fewer</option>
                <option value="repeat">Repeat — 2 to 4 orders</option>
                <option value="vip">VIP — 5+ orders</option>
              </Select>
            </Field>
          )}
        </div>

        {form.audience.type === 'manual' && (
          <Field label="Email addresses" hint="One per line">
            <Textarea
              rows={4}
              value={(form.audience.manualEmails ?? []).join('\n')}
              onChange={(e) => setForm((f) => ({ ...f, audience: { ...f.audience, manualEmails: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) } }))}
            />
          </Field>
        )}

        <div className="flex items-center gap-3 rounded-lg bg-sand px-3.5 py-3">
          <Btn size="xs" onClick={previewAudience}>Check audience size</Btn>
          {audienceCount != null && (
            <span className="text-[0.8125rem] font-medium">{audienceCount} recipients</span>
          )}
        </div>
      </div>
    </Modal>
  )
}
