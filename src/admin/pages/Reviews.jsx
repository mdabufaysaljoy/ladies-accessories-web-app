import { useCallback, useEffect, useState } from 'react'
import { adminApi, qs } from '@/lib/api'
import { AdminPage, Badge, Btn, Card, EmptyRow, Spinner, Tabs, useToasts } from '../components/ui'
import { Icon } from '@/components/ui/Icon'
import { Rating } from '@/components/ui/Rating'
import { formatDate } from '@/utils/format'

export default function Reviews() {
  const [status, setStatus] = useState('pending')
  const [kind, setKind] = useState('all')
  const [data, setData] = useState(null)
  const { push, node } = useToasts()

  const load = useCallback(async () => {
    try {
      setData(await adminApi.get(`/reviews${qs({ status, kind, limit: 50 })}`))
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, kind])

  useEffect(() => { load() }, [load])

  const moderate = async (review, next) => {
    try {
      await adminApi.patch(`/reviews/${review._id}`, { status: next })
      push(next === 'published' ? 'Review published' : 'Review rejected')
      load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  return (
    <AdminPage
      title="Reviews"
      subtitle="Moderate customer reviews before they appear on the storefront"
      actions={data?.pendingCount > 0 && <Badge tone="warning">{data.pendingCount} awaiting review</Badge>}
    >
      {node}

      <div className="mb-5">
        <Tabs
          tabs={[
            { id: 'pending', label: 'Pending' },
            { id: 'published', label: 'Published' },
            { id: 'rejected', label: 'Rejected' },
          ]}
          active={status}
          onChange={setStatus}
        />

        <div className="mt-3">
          <Tabs
            tabs={[
              { id: 'all', label: 'All reviews' },
              { id: 'product', label: 'Product reviews' },
              { id: 'shop', label: 'Shop reviews' },
            ]}
            active={kind}
            onChange={setKind}
          />
        </div>
      </div>

      {!data ? (
        <Spinner />
      ) : data.reviews.length === 0 ? (
        <Card>
          <EmptyRow
            icon="checkCircle"
            title={`No ${status} reviews`}
            body={status === 'pending' ? 'Everything has been moderated. Nice work.' : 'Nothing here yet.'}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.reviews.map((r) => (
            <Card key={r._id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-[0.75rem] text-ink/50">
                    {r.location || 'Unknown location'} · {formatDate(r.createdAt)}
                  </p>
                </div>
                {r.verified ? (
                  <Badge tone="success"><Icon name="checkCircle" size={11} /> Verified buyer</Badge>
                ) : (
                  <Badge tone="warning">Unverified</Badge>
                )}
              </div>

              <Rating value={r.rating} size={15} className="mt-3" />
              {r.title && <p className="mt-2 text-[0.9375rem] font-medium">{r.title}</p>}
              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink/70">
                {r.body || <span className="text-ink/35">Rating only — no written review.</span>}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={r.kind === 'shop' ? 'purple' : 'neutral'}>
                  {r.kind === 'shop' ? 'About the shop' : r.productSlug}
                </Badge>
                {r.phone && <span className="text-[0.75rem] text-ink/45">{r.phone}</span>}
              </div>

              {status !== 'published' && (
                <div className="mt-4 flex gap-2 border-t border-ink/8 pt-3.5">
                  <Btn size="sm" variant="success" onClick={() => moderate(r, 'published')}>
                    <Icon name="check" size={13} /> Publish
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => moderate(r, 'rejected')}>Reject</Btn>
                </div>
              )}
              {status === 'published' && (
                <div className="mt-4 flex gap-2 border-t border-ink/8 pt-3.5">
                  <Btn size="sm" onClick={() => moderate(r, 'pending')}>Unpublish</Btn>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  )
}
