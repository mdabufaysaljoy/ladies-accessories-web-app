import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, qs } from '@/lib/api'
import { AdminPage, Badge, Btn, Card, EmptyRow, SearchInput, Select, Spinner, Tabs, useToasts } from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { cx, taka } from '@/utils/format'

const CHANNELS = [
  { id: 'all', label: 'All', icon: 'mail', color: 'text-ink' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', color: 'text-[#25D366]' },
  { id: 'messenger', label: 'Messenger', icon: 'facebook', color: 'text-[#0084FF]' },
  { id: 'instagram', label: 'Instagram', icon: 'instagram', color: 'text-[#E1306C]' },
]

const CHANNEL_META = Object.fromEntries(CHANNELS.map((c) => [c.id, c]))

const timeAgo = (date) => {
  const mins = Math.floor((Date.now() - new Date(date)) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

export default function Inbox() {
  const [channel, setChannel] = useState('all')
  const [q, setQ] = useState('')
  const [list, setList] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [thread, setThread] = useState(null)
  const [status, setStatus] = useState(null)
  const [replies, setReplies] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const bottomRef = useRef(null)
  const { push, node } = useToasts()

  const loadList = useCallback(async () => {
    try {
      const res = await adminApi.get(`/inbox/conversations${qs({ channel, q, limit: 40 })}`)
      setList(res)
      setActiveId((cur) => cur ?? res.conversations[0]?._id ?? null)
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, q])

  useEffect(() => {
    const t = setTimeout(loadList, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadList, q])

  // New messages arrive by webhook, so poll the list while the tab is open.
  useEffect(() => {
    const id = setInterval(loadList, 20000)
    return () => clearInterval(id)
  }, [loadList])

  useEffect(() => {
    adminApi.get('/inbox/status').then((d) => setStatus(d.channels)).catch(() => {})
    adminApi.get('/inbox/quick-replies').then((d) => setReplies(d.replies)).catch(() => {})
  }, [])

  const loadThread = useCallback(async (id) => {
    if (!id) return setThread(null)
    setLoadingThread(true)
    try {
      const res = await adminApi.get(`/inbox/conversations/${id}`)
      setThread(res)
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setLoadingThread(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadThread(activeId) }, [activeId, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.conversation?.messages?.length])

  const send = async (e) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    try {
      const res = await adminApi.post(`/inbox/conversations/${activeId}/reply`, { text })
      setThread((t) => ({ ...t, conversation: res.conversation }))
      setDraft('')
      if (res.simulated) {
        push(`Saved to the thread. ${res.note ?? 'Connect the channel in Settings to actually send.'}`, 'info')
      }
      loadList()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  const setConvoStatus = async (next) => {
    try {
      const res = await adminApi.patch(`/inbox/conversations/${activeId}`, { status: next })
      setThread((t) => ({ ...t, conversation: { ...t.conversation, status: res.conversation.status } }))
      loadList()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const convo = thread?.conversation
  const connectedCount = status ? Object.values(status).filter((s) => s.enabled && s.configured).length : 0

  return (
    <AdminPage
      title="Inbox"
      subtitle="WhatsApp, Messenger and Instagram in one place"
      actions={
        <Badge tone={connectedCount > 0 ? 'success' : 'warning'}>
          {connectedCount > 0 ? `${connectedCount} channel${connectedCount > 1 ? 's' : ''} connected` : 'Demo mode — no channel connected'}
        </Badge>
      }
    >
      {node}

      {connectedCount === 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-blush px-4 py-3.5">
          <Icon name="info" size={18} className="shrink-0 text-plum" />
          <p className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed text-ink/70">
            No messaging channel is connected yet, so replies are saved to the thread but not delivered.
            Add your Meta tokens in Settings → Integrations to go live.
          </p>
          <Btn as={Link} to="/admin/settings?tab=integrations" size="sm" variant="primary">Connect channels</Btn>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[21rem_1fr] xl:grid-cols-[23rem_1fr_18rem]">
        {/* conversation list */}
        <Card padded={false} className="flex max-h-[calc(100dvh-13rem)] flex-col overflow-hidden">
          <div className="border-b border-ink/8 p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search conversations…" />
          </div>
          <div className="px-2">
            <Tabs
              tabs={CHANNELS}
              active={channel}
              onChange={setChannel}
              counts={list?.unreadByChannel}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!list ? (
              <Spinner />
            ) : list.conversations.length === 0 ? (
              <EmptyRow icon="mail" title="No conversations" body="Messages from your connected channels appear here." />
            ) : (
              <ul className="divide-y divide-ink/6">
                {list.conversations.map((c) => {
                  const meta = CHANNEL_META[c.channel] ?? CHANNEL_META.all
                  return (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(c._id)}
                        className={cx(
                          'flex w-full gap-3 px-4 py-3.5 text-left transition-colors',
                          activeId === c._id ? 'bg-sand' : 'hover:bg-sand/60',
                        )}
                      >
                        <span className="relative shrink-0">
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-blush font-display text-[0.875rem] text-plum">
                            {(c.contact?.name ?? '?').charAt(0).toUpperCase()}
                          </span>
                          <span className={cx('absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-white', meta.color)}>
                            <Icon name={meta.icon} size={11} />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[0.875rem] font-medium">{c.contact?.name ?? c.externalId}</span>
                            <span className="shrink-0 text-[0.6875rem] text-ink/40">{timeAgo(c.lastMessageAt)}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[0.75rem] text-ink/50">{c.lastMessagePreview}</span>
                            {c.unreadCount > 0 && (
                              <span className="grid h-4.5 min-w-[1.125rem] shrink-0 place-items-center rounded-full bg-rose px-1.5 text-[0.625rem] font-bold text-white">
                                {c.unreadCount}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* thread */}
        <Card padded={false} className="flex max-h-[calc(100dvh-13rem)] flex-col overflow-hidden">
          {loadingThread && !convo ? (
            <Spinner />
          ) : !convo ? (
            <EmptyRow icon="mail" title="Select a conversation" body="Pick a thread on the left to read and reply." />
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-ink/8 px-5 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush font-display text-plum">
                  {(convo.contact?.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-medium">{convo.contact?.name ?? convo.externalId}</p>
                  <p className="flex items-center gap-1.5 text-[0.75rem] text-ink/50">
                    <Icon name={CHANNEL_META[convo.channel]?.icon} size={12} className={CHANNEL_META[convo.channel]?.color} />
                    {convo.contact?.phone ?? convo.contact?.username ?? convo.externalId}
                  </p>
                </div>
                <Select value={convo.status} onChange={(e) => setConvoStatus(e.target.value)} className="w-auto">
                  <option value="open">Open</option>
                  <option value="pending">Waiting</option>
                  <option value="closed">Closed</option>
                </Select>
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-sand/30 px-5 py-5">
                {convo.messages.map((m) => (
                  <div key={m._id} className={cx('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cx(
                        'max-w-[80%] rounded-2xl px-3.5 py-2.5',
                        m.direction === 'out' ? 'bg-ink text-cream' : 'bg-white',
                      )}
                    >
                      <p className="whitespace-pre-wrap text-[0.875rem] leading-relaxed">{m.text}</p>
                      <p className={cx('mt-1 flex items-center gap-1.5 text-[0.625rem]', m.direction === 'out' ? 'text-cream/50' : 'text-ink/40')}>
                        {new Date(m.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {m.sentBy && ` · ${m.sentBy}`}
                        {m.simulated && (
                          <span title="Saved locally — the channel is not connected">
                            <Icon name="info" size={10} />
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {replies.length > 0 && (
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-ink/8 px-4 py-2.5">
                  {replies.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => setDraft(r.text)}
                      className="shrink-0 rounded-full border border-ink/12 px-3 py-1.5 text-[0.75rem] text-ink/65 transition-colors hover:border-ink hover:text-ink"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={send} className="flex items-end gap-2 border-t border-ink/8 p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) send(e)
                  }}
                  rows={2}
                  placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
                  className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-[0.875rem] outline-none focus:border-ink"
                />
                <Btn type="submit" variant="primary" size="md" loading={sending} disabled={!draft.trim()}>
                  <Icon name="arrowRight" size={15} /> Send
                </Btn>
              </form>
            </>
          )}
        </Card>

        {/* context panel */}
        <div className="hidden space-y-4 xl:block">
          {convo && (
            <>
              <Card title="Contact">
                <p className="text-[0.9375rem] font-medium">{convo.contact?.name ?? '—'}</p>
                <dl className="mt-3 space-y-2 text-[0.8125rem]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink/50">Channel</dt>
                    <dd className="capitalize">{convo.channel}</dd>
                  </div>
                  {convo.contact?.phone && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink/50">Phone</dt>
                      <dd><a href={`tel:${convo.contact.phone}`} className="hover:text-plum">{convo.contact.phone}</a></dd>
                    </div>
                  )}
                  {convo.contact?.username && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink/50">Username</dt>
                      <dd>@{convo.contact.username}</dd>
                    </div>
                  )}
                </dl>
              </Card>

              <Card title="Their orders">
                {thread?.orders?.length ? (
                  <ul className="space-y-2">
                    {thread.orders.map((o) => (
                      <li key={o._id}>
                        <Link to={`/admin/orders/${o._id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] hover:bg-sand">
                          <span className="font-mono text-[0.75rem]">{o.orderNumber}</span>
                          <span className="capitalize text-ink/50">{o.status}</span>
                          <span className="font-medium">{taka(o.totals.total)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-[0.8125rem] text-ink/45">
                    No orders found for this contact.
                  </p>
                )}
              </Card>

              <Card title="Channel status">
                <ul className="space-y-2.5">
                  {['whatsapp', 'messenger', 'instagram'].map((ch) => {
                    const s = status?.[ch]
                    const live = s?.enabled && s?.configured
                    return (
                      <li key={ch} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[0.8125rem] capitalize">
                          <Icon name={CHANNEL_META[ch].icon} size={14} className={CHANNEL_META[ch].color} />
                          {ch}
                        </span>
                        <Badge tone={live ? 'success' : 'neutral'}>{live ? 'Live' : 'Not connected'}</Badge>
                      </li>
                    )
                  })}
                </ul>
                <Btn as={Link} to="/admin/settings?tab=integrations" size="xs" className="mt-3.5 w-full">
                  Manage integrations
                </Btn>
              </Card>
            </>
          )}
        </div>
      </div>
    </AdminPage>
  )
}
