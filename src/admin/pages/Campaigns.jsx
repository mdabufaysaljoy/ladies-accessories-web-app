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
  name: '', channel: 'email', subject: '', preheader: '', bodyHtml: '', smsText: '',
  audience: { type: 'subscribers', segment: 'all', manualEmails: [], manualPhones: [] },
}

/**
 * A single GSM-7 SMS is 160 characters. Any Bangla, emoji, curly quote, em
 * dash or ৳ sign switches the whole message to Unicode, where one part is 70 —
 * so the counter reports which alphabet is in play, not just a length.
 */
const GSM =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
  '^{}\\[~]|€'

export function measureSmsText(text = '') {
  const body = String(text)
  const unicode = [...body].some((ch) => !GSM.includes(ch))
  const limit = unicode ? 70 : 160
  const perMulti = unicode ? 67 : 153
  const length = [...body].length
  const parts = length === 0 ? 0 : length <= limit ? 1 : Math.ceil(length / perMulti)
  return { length, unicode, limit, parts }
}

export default function Campaigns() {
  const [tab, setTab] = useState('campaigns')
  const [campaigns, setCampaigns] = useState(null)
  const [subscribers, setSubscribers] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const { push, node } = useToasts()

  /**
   * Email and SMS campaigns share one collection and one list; the tab just
   * decides which channel is on screen. Older campaigns predate the field, so
   * a missing channel counts as email.
   */
  const visibleCampaigns = (campaigns?.campaigns ?? []).filter((c) =>
    tab === 'sms' ? c.channel === 'sms' : c.channel !== 'sms',
  )

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
    /**
     * An SMS test costs real money and goes to a real handset, so ask where it
     * should land instead of quietly using the shop's contact number.
     */
    let to
    if (campaign.channel === 'sms') {
      to = window.prompt('Send the test SMS to which number?', '')
      if (to === null) return
      if (!to.trim()) {
        push('Enter a phone number for the test', 'error')
        return
      }
    }

    try {
      const res = await adminApi.post(`/campaigns/${campaign._id}/test`, to ? { to } : {})
      const notConfigured = res.channel === 'sms' ? res.result?.simulated : res.result?.simulated
      push(
        notConfigured
          ? `${res.channel === 'sms' ? 'No SMS credentials' : 'SMTP not configured'} — test was simulated`
          : `Test sent to ${res.to}`,
        notConfigured ? 'info' : 'success',
      )
    } catch (err) {
      push(err.message, 'error')
    }
  }

  return (
    <AdminPage
      title="Campaigns"
      subtitle="Email and SMS campaigns, and your subscriber list"
      actions={
        <Btn
          variant="primary"
          size="md"
          onClick={() => setEditing({ ...BLANK, channel: tab === 'sms' ? 'sms' : 'email' })}
        >
          <Icon name="plus" size={15} /> New {tab === 'sms' ? 'SMS' : 'email'} campaign
        </Btn>
      }
    >
      {node}

      <div className="mb-5">
        <Tabs
          tabs={[
            { id: 'campaigns', label: 'Email campaigns' },
            { id: 'sms', label: 'SMS campaigns' },
            { id: 'subscribers', label: 'Subscribers' },
          ]}
          active={tab}
          onChange={setTab}
          counts={{ campaigns: campaigns?.meta?.total, subscribers: subscribers?.activeCount }}
        />
      </div>

      {(tab === 'campaigns' || tab === 'sms') && (
        <Card padded={false}>
          {!campaigns ? (
            <Spinner />
          ) : visibleCampaigns.length === 0 ? (
            <EmptyRow
              icon="mail"
              title="No campaigns yet"
              body="Create a campaign to announce a restock, a sale or a new arrival to your subscribers."
              action={
                <Btn
                  variant="primary"
                  onClick={() => setEditing({ ...BLANK, channel: tab === 'sms' ? 'sms' : 'email' })}
                >
                  New {tab === 'sms' ? 'SMS' : 'email'} campaign
                </Btn>
              }
            />
          ) : (
            <Table
              head={[
                { label: 'Campaign' }, { label: 'Audience' }, { label: 'Status' },
                { label: 'Sent', align: 'center' }, { label: '', align: 'right' },
              ]}
            >
              {visibleCampaigns.map((c) => (
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
            ? confirm?.campaign.channel === 'sms'
              ? 'This will send a paid SMS to every number in the selected audience. Send a test to yourself first if you have not already — this cannot be undone.'
              : 'This will email every recipient in the selected audience. Send a test to yourself first if you have not already — this cannot be undone.'
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

  const isSms = form.channel === 'sms'
  const sms = measureSmsText(form.smsText)

  /**
   * Newsletter subscribers are an email-only audience, so an SMS campaign that
   * still carries that selection would render an empty dropdown and then
   * resolve to nobody. Fall back to all customers with a phone number.
   */
  const audienceType = isSms && form.audience.type === 'subscribers' ? 'customers' : form.audience.type

  useEffect(() => {
    if (campaign) setForm({ ...BLANK, ...campaign, audience: { ...BLANK.audience, ...campaign.audience } })
    setAudienceCount(null)
  }, [campaign])

  const save = async () => {
    if (!form.name.trim()) {
      onError('Give the campaign a name')
      return
    }
    // An SMS has no subject line, so validate whichever body this channel uses.
    if (isSms && !form.smsText.trim()) {
      onError('Write the SMS message before saving')
      return
    }
    if (!isSms && !form.subject.trim()) {
      onError('A subject line is required')
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
      setAudienceCount(res)
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
          {isSms ? (
            <Field label="Channel">
              <Input value="SMS" readOnly className="bg-sand" />
            </Field>
          ) : (
          <Field label="Subject line" required>
            <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="New hijab colours just landed 🌸" />
          </Field>
          )}
        </div>

        {isSms && (
          <Field label="Message" required>
            <Textarea
              rows={4}
              value={form.smsText}
              onChange={(e) => setForm((f) => ({ ...f, smsText: e.target.value }))}
              placeholder="Eid offer! Up to 30% off hijabs at Goods by Sadia. Shop: goodsbysadia.com"
            />
            {/* A campaign costs parts x recipients, so the part count is the
                most useful thing to show while composing. */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.75rem]">
              <Badge tone={sms.parts > 1 ? 'warning' : 'neutral'}>
                {sms.length}/{sms.limit} · {sms.parts || 0} SMS
              </Badge>
              {sms.unicode && (
                <span className="text-gold">
                  Bangla or a special character is in use, so one SMS holds 70 characters instead of 160.
                </span>
              )}
              {sms.parts > 1 && !sms.unicode && (
                <span className="text-gold">Over 160 characters — billed as {sms.parts} messages per recipient.</span>
              )}
            </div>
          </Field>
        )}

        {!isSms && (
        <Field label="Preheader" hint="Preview text after the subject in the inbox">
          <Input value={form.preheader} onChange={(e) => setForm((f) => ({ ...f, preheader: e.target.value }))} placeholder="Six new georgette shades, back in stock now." />
        </Field>
        )}

        {!isSms && (
        <Field label="Email body" hint="Basic HTML is supported">
          <Textarea
            rows={8}
            value={form.bodyHtml}
            onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
            placeholder={'<p>Assalamu alaikum!</p>\n<p>Our Signature Georgette hijab is back in six new shades…</p>'}
            className="font-mono text-[0.8125rem]"
          />
        </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Send to">
            <Select
              value={audienceType}
              onChange={(e) => setForm((f) => ({ ...f, audience: { ...f.audience, type: e.target.value } }))}
            >
              {/* Newsletter subscribers have no phone number on file, so that
                  option is meaningless for SMS and is left out rather than
                  offered and then resolving to zero recipients. */}
              {!isSms && <option value="subscribers">Newsletter subscribers</option>}
              <option value="customers">
                {isSms ? 'All customers with a phone number' : 'All customers with an email'}
              </option>
              <option value="segment">A customer segment</option>
              <option value="manual">
                {isSms ? 'A specific list of phone numbers' : 'A specific list of addresses'}
              </option>
            </Select>
          </Field>

          {audienceType === 'segment' && (
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

        {audienceType === 'manual' && !isSms && (
          <Field label="Email addresses" hint="One per line">
            <Textarea
              rows={4}
              value={(form.audience.manualEmails ?? []).join('\n')}
              onChange={(e) => setForm((f) => ({ ...f, audience: { ...f.audience, manualEmails: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) } }))}
            />
          </Field>
        )}

        {audienceType === 'manual' && isSms && (
          <Field
            label="Phone numbers"
            hint="One per line. Commas and spaces also work, so a list copied out of a spreadsheet pastes straight in."
          >
            <Textarea
              rows={5}
              placeholder={'01712345678\n+8801812345678\n8801912345678'}
              value={(form.audience.manualPhones ?? []).join('\n')}
              /* Split on newlines, commas, semicolons and tabs: the admin is
                 usually pasting from Excel or a WhatsApp message, and neither
                 gives one clean number per line. */
              onChange={(e) => setForm((f) => ({
                ...f,
                audience: {
                  ...f.audience,
                  manualPhones: e.target.value.split(/[\n,;\t]/).map((x) => x.trim()).filter(Boolean),
                },
              }))}
            />
            <p className="mt-1.5 text-[0.8125rem] text-ink/55">
              {(form.audience.manualPhones ?? []).length} number
              {(form.audience.manualPhones ?? []).length === 1 ? '' : 's'} entered · any format is
              accepted and normalised to 8801XXXXXXXXX before sending
            </p>
          </Field>
        )}

        <div className="rounded-lg bg-sand px-3.5 py-3">
          <div className="flex items-center gap-3">
            <Btn size="xs" onClick={previewAudience}>Check audience size</Btn>
            {audienceCount && (
              <span className="text-[0.8125rem] font-medium">
                {audienceCount.count} {isSms ? 'phone numbers' : 'recipients'}
                {isSms && audienceCount.count > 0 && ` · ${audienceCount.count * (sms.parts || 1)} SMS`}
              </span>
            )}
          </div>

          {/* Naming the numbers that were dropped turns "8 of 10" from a
              mystery into a typo the admin can go and fix. */}
          {audienceCount?.rejectedCount > 0 && (
            <p className="mt-2 text-[0.8125rem] text-red-700">
              {audienceCount.rejectedCount} not a valid Bangladeshi mobile number and will be
              skipped: {audienceCount.rejected.join(', ')}
              {audienceCount.rejectedCount > audienceCount.rejected.length && ' …'}
            </p>
          )}

          {audienceCount?.sample?.length > 0 && (
            <p className="mt-1.5 text-[0.8125rem] text-ink/55">
              First few: {audienceCount.sample.join(', ')}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
