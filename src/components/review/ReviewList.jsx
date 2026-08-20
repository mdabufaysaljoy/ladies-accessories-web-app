import { Icon } from '@/components/ui/Icon'
import { Rating } from '@/components/ui/Rating'
import { cx, formatDate } from '@/utils/format'

/** Average, total and the 5→1 star bars. */
export function ReviewSummary({ summary, className = '', label = 'verified purchases' }) {
  if (!summary) return null

  return (
    <div className={className}>
      <div className="rounded-[1.25rem] bg-cream p-7 text-center">
        <p className="font-display text-[3.5rem] leading-none">
          {summary.total ? summary.average.toFixed(1) : '—'}
        </p>
        <Rating value={summary.average} size={17} className="mt-3 justify-center" />
        <p className="mt-2.5 text-[0.8125rem] text-ink/50">
          {summary.total ? `Based on ${summary.total} ${label}` : 'No reviews yet'}
        </p>
      </div>

      {summary.total > 0 && (
        <ul className="mt-6 space-y-2.5">
          {summary.breakdown.map((row) => (
            <li key={row.stars} className="flex items-center gap-3 text-[0.8125rem]">
              <span className="w-8 shrink-0 text-ink/60">{row.stars}★</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                <span
                  className="block h-full rounded-full bg-gold transition-[width] duration-700"
                  style={{ width: `${row.pct}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-ink/45">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One published review, with the shop's reply underneath if there is one. */
export function ReviewCard({ review, showProduct = false, className = '' }) {
  return (
    <li className={cx('rounded-[1.25rem] bg-cream p-7', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-blush font-display text-plum">
            {(review.name ?? '?').charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-[0.9375rem] font-medium">{review.name}</p>
            <p className="text-[0.75rem] text-ink/45">
              {[review.location, formatDate(review.createdAt)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {review.verified && (
          <span className="flex items-center gap-1.5 rounded-full bg-moss/10 px-3 py-1 text-[0.6875rem] font-medium text-moss">
            <Icon name="checkCircle" size={13} /> Verified purchase
          </span>
        )}
      </div>

      <Rating value={review.rating} size={15} className="mt-4" />
      {review.title && <p className="mt-2.5 font-medium">{review.title}</p>}
      {review.body && (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink/70 text-balance-pretty">
          {review.body}
        </p>
      )}

      {showProduct && review.productSlug && (
        <p className="mt-3 text-[0.75rem] text-ink/40">On {review.productSlug.replace(/-/g, ' ')}</p>
      )}

      {review.reply?.body && (
        <div className="mt-4 rounded-xl bg-sand p-4">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-plum/70">
            Reply from Goods by Sadia
          </p>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink/70">{review.reply.body}</p>
        </div>
      )}
    </li>
  )
}

export function ReviewList({ reviews, showProduct = false, empty }) {
  if (!reviews?.length) {
    return (
      <div className="rounded-[1.25rem] bg-cream p-10 text-center">
        <p className="font-display text-xl">{empty?.title ?? 'No written reviews yet'}</p>
        <p className="mt-2 text-[0.9375rem] text-ink/55">
          {empty?.body ?? 'Be the first to write one.'}
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-5">
      {reviews.map((r) => (
        <ReviewCard key={r._id ?? r.id} review={r} showProduct={showProduct} />
      ))}
    </ul>
  )
}
