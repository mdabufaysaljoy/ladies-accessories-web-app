import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '@/lib/api'
import { AdminPage, Badge, Btn, Card, ORDER_TONE, Spinner, Table, Td } from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { cx, formatDate, taka } from '@/utils/format'

const METHOD_LABEL = {
  cod: 'Cash on delivery',
  sslcommerz: 'SSLCommerz',
  bkash: 'bKash checkout',
  'bkash-manual': 'bKash send money',
  'nagad-manual': 'Nagad send money',
}

function Stat({ label, value, change, icon, tone = 'neutral', to }) {
  const Wrapper = to ? Link : 'div'
  return (
    <Wrapper
      to={to}
      className={cx(
        'rounded-2xl border border-ink/10 bg-white p-5',
        to && 'transition-colors hover:border-ink/25',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.1em] text-ink/45">{label}</p>
        <span
          className={cx(
            'grid h-8 w-8 place-items-center rounded-lg',
            tone === 'success' ? 'bg-moss/12 text-moss' : tone === 'warning' ? 'bg-gold/15 text-gold' : 'bg-blush text-plum',
          )}
        >
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className="mt-3 font-display text-[1.75rem] leading-none tracking-tight">{value}</p>
      {change != null && (
        <p
          className={cx(
            'mt-2 flex items-center gap-1 text-[0.75rem] font-medium',
            change >= 0 ? 'text-moss' : 'text-red-600',
          )}
        >
          <Icon name={change >= 0 ? 'chevronUp' : 'chevronDown'} size={12} />
          {Math.abs(change)}% vs previous period
        </p>
      )}
    </Wrapper>
  )
}

/** Compact revenue sparkline — no chart library needed for one series. */
function RevenueChart({ series }) {
  if (!series?.length) {
    return <p className="py-12 text-center text-[0.875rem] text-ink/45">No revenue in this period yet.</p>
  }

  const max = Math.max(...series.map((s) => s.revenue), 1)
  const W = 100
  const H = 32
  const points = series.map((s, i) => {
    const x = series.length === 1 ? W / 2 : (i / (series.length - 1)) * W
    const y = H - (s.revenue / max) * (H - 3)
    return [x, y]
  })
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Revenue over time">
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-plum)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-plum)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#rev)" />
        <path d={line} fill="none" stroke="var(--color-plum)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-2 flex justify-between text-[0.6875rem] text-ink/40">
        <span>{formatDate(series[0].date)}</span>
        <span>Peak {taka(max)}</span>
        <span>{formatDate(series[series.length - 1].date)}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminApi
      .get(`/analytics/dashboard?days=${days}`)
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [days])

  if (loading && !data) return <Spinner className="min-h-[60vh]" />
  if (!data) return null

  const { totals, change, statusCounts, paymentSplit, topProducts, lowStock, recentOrders, series, traffic } = data
  const totalPayments = paymentSplit.reduce((s, p) => s + p.count, 0) || 1

  return (
    <AdminPage
      title="Dashboard"
      subtitle={`Performance over the last ${days} days`}
      actions={
        <div className="flex gap-1 rounded-lg border border-ink/12 bg-white p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cx(
                'rounded-md px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
                days === d ? 'bg-ink text-cream' : 'text-ink/55 hover:text-ink',
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue" value={taka(totals.revenue)} change={change.revenue} icon="cash" tone="success" />
        <Stat label="Orders" value={totals.orders} change={change.orders} icon="bag" to="/admin/orders" />
        <Stat
          label="Visitors"
          value={(totals.visitors ?? 0).toLocaleString('en-US')}
          change={change.visitors}
          icon="eye"
        />
        <Stat label="Avg order value" value={taka(totals.avgOrderValue)} icon="sparkle" />
      </div>

      {/* Traffic, and what it converts to — the number the shop is really run on. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Visitors today" value={(totals.visitorsToday ?? 0).toLocaleString('en-US')} icon="user" />
        <Stat label="Page views" value={(totals.pageViews ?? 0).toLocaleString('en-US')} icon="grid" />
        <Stat
          label="Conversion rate"
          // Held back until the visitor sample is large enough to mean anything.
          value={data.conversionRate == null ? '—' : `${data.conversionRate}%`}
          icon="checkCircle"
          tone={data.conversionRate >= 1 ? 'success' : 'neutral'}
        />
        <Stat
          label="Unread messages"
          value={totals.unreadChats}
          icon="whatsapp"
          tone={totals.unreadChats > 0 ? 'warning' : 'neutral'}
          to="/admin/inbox"
        />
      </div>

      {traffic && traffic.visitors > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Where visitors come from">
            {traffic.sources.length === 0 ? (
              <p className="text-[0.8125rem] text-ink/45">No entry pages recorded yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {traffic.sources.map((s) => {
                  const pct = Math.round((s.visits / traffic.sources.reduce((a, b) => a + b.visits, 0)) * 100)
                  return (
                    <li key={s.source} className="flex items-center gap-3 text-[0.8125rem]">
                      <span className="w-20 shrink-0 truncate capitalize text-ink/70">{s.source}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
                        <span className="block h-full rounded-full bg-plum" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-12 shrink-0 text-right text-ink/45">{s.visits}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="Most viewed pages">
            <ul className="space-y-2">
              {traffic.topPages.map((p) => (
                <li key={p.path} className="flex items-center justify-between gap-3 text-[0.8125rem]">
                  <span className="truncate text-ink/70">{p.path}</span>
                  <span className="shrink-0 font-medium">{p.views}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Devices" description={`${traffic.viewsPerVisitor} pages per visitor`}>
            <ul className="space-y-2.5">
              {['mobile', 'desktop', 'tablet'].map((d) => {
                const n = traffic.devices?.[d] ?? 0
                const total = Object.values(traffic.devices ?? {}).reduce((a, b) => a + b, 0) || 1
                return (
                  <li key={d} className="flex items-center gap-3 text-[0.8125rem]">
                    <span className="w-20 shrink-0 capitalize text-ink/70">{d}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
                      <span className="block h-full rounded-full bg-moss" style={{ width: `${Math.round((n / total) * 100)}%` }} />
                    </span>
                    <span className="w-12 shrink-0 text-right text-ink/45">{n}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Revenue trend" description={`Daily totals, last ${days} days`}>
          <RevenueChart series={series} />
        </Card>

        <Card title="Orders by status">
          <ul className="space-y-2.5">
            {Object.entries(statusCounts).length === 0 && (
              <li className="py-6 text-center text-[0.875rem] text-ink/45">No orders yet</li>
            )}
            {Object.entries(statusCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <li key={status}>
                  <Link
                    to={`/admin/orders?status=${status}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-sand"
                  >
                    <Badge tone={ORDER_TONE[status] ?? 'neutral'} className="capitalize">
                      {status}
                    </Badge>
                    <span className="text-[0.875rem] font-semibold">{count}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Payment methods" description="How customers paid in this period">
          {paymentSplit.length === 0 ? (
            <p className="py-6 text-center text-[0.875rem] text-ink/45">No data yet</p>
          ) : (
            <ul className="space-y-3.5">
              {paymentSplit.map((p) => (
                <li key={p.method}>
                  <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="font-medium">{METHOD_LABEL[p.method] ?? p.method}</span>
                    <span className="text-ink/50">
                      {p.count} orders · {taka(p.revenue)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose to-plum"
                      style={{ width: `${(p.count / totalPayments) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Low stock"
          description="Restock these before they sell out"
          actions={<Btn as={Link} to="/admin/products?stock=low" size="xs">View all</Btn>}
        >
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-[0.875rem] text-ink/45">Everything is well stocked.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-3">
                  <Link to={`/admin/products/${p._id}`} className="truncate text-[0.875rem] hover:text-plum">
                    {p.name}
                  </Link>
                  <Badge tone={p.stock === 0 ? 'danger' : 'warning'}>
                    {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card
          title="Recent orders"
          padded={false}
          actions={<Btn as={Link} to="/admin/orders" size="xs">All orders</Btn>}
        >
          <Table
            head={[
              { label: 'Order' }, { label: 'Customer' }, { label: 'Payment' },
              { label: 'Status' }, { label: 'Total', align: 'right' },
            ]}
          >
            {recentOrders.map((o) => (
              <tr key={o._id} className="hover:bg-sand/50">
                <Td>
                  <Link to={`/admin/orders/${o._id}`} className="font-mono text-[0.8125rem] font-medium hover:text-plum">
                    {o.orderNumber}
                  </Link>
                  <span className="block text-[0.6875rem] text-ink/40">{formatDate(o.createdAt)}</span>
                </Td>
                <Td>
                  <span className="block truncate">{o.customer.name}</span>
                  <span className="block text-[0.6875rem] text-ink/45">{o.customer.phone}</span>
                </Td>
                <Td className="text-[0.75rem] text-ink/60">{METHOD_LABEL[o.payment.method] ?? o.payment.method}</Td>
                <Td>
                  <Badge tone={ORDER_TONE[o.status] ?? 'neutral'} className="capitalize">{o.status}</Badge>
                </Td>
                <Td align="right" className="font-semibold">{taka(o.totals.total)}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Best sellers" description={`Top products, last ${days} days`}>
          {topProducts.length === 0 ? (
            <p className="py-6 text-center text-[0.875rem] text-ink/45">No sales yet</p>
          ) : (
            <ol className="space-y-3">
              {topProducts.map((p, i) => (
                <li key={p.slug} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-sand text-[0.6875rem] font-bold text-ink/50">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium">{p.name}</span>
                    <span className="block text-[0.6875rem] text-ink/45">{p.qty} sold</span>
                  </span>
                  <span className="shrink-0 text-[0.8125rem] font-semibold">{taka(p.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </AdminPage>
  )
}
