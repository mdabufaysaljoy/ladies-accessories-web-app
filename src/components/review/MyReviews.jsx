import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Rating } from '@/components/ui/Rating'
import { ProductArt } from '@/components/product/ProductArt'
import { ReviewForm } from '@/components/review/ReviewForm'
import { customerApi } from '@/lib/api'
import { cx, formatDate, taka } from '@/utils/format'

const STATUS = {
  pending: { tone: 'bg-gold/15 text-gold', label: 'Awaiting approval' },
  published: { tone: 'bg-moss/12 text-moss', label: 'Published' },
  rejected: { tone: 'bg-red-100 text-red-700', label: 'Not published' },
}

/**
 * One delivered product: what they bought, where to find it again, and either
 * the review they left or the form to leave one.
 */
function PurchaseCard({ purchase, onReviewed }) {
  const [open, setOpen] = useState(false)
  const { review, available, slug } = purchase
  const status = review ? STATUS[review.status] : null

  return (
    <li className="rounded-2xl border border-ink/10 p-4 sm:p-5">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">
          <ProductArt product={purchase} decorative={false} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {/* Straight back to the product page, which is where they would
                  go to buy it again or read what others said. */}
              {available ? (
                <Link
                  to={`/product/${slug}`}
                  className="link-underline font-medium leading-snug hover:text-plum"
                >
                  {purchase.name}
                </Link>
              ) : (
                <p className="font-medium leading-snug text-ink/60">{purchase.name}</p>
              )}
              <p className="mt-1 text-[0.75rem] text-ink/50">
                {taka(purchase.price)} · Delivered {formatDate(purchase.purchasedAt)}
                {purchase.timesBought > 1 && ` · Bought ${purchase.timesBought}×`}
              </p>
            </div>

            {status && (
              <span className={cx('rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold', status.tone)}>
                {status.label}
              </span>
            )}
          </div>

          {/* already reviewed */}
          {review && (
            <div className="mt-3">
              <Rating value={review.rating} size={14} />
              {review.body && (
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink/65">{review.body}</p>
              )}
              {review.status === 'pending' && (
                <p className="mt-2 text-[0.75rem] text-ink/45">
                  Sadia is reading it — it will appear on the product page once approved.
                </p>
              )}
              {review.status === 'rejected' && (
                <p className="mt-2 text-[0.75rem] text-ink/45">
                  This one was not published. Message us on WhatsApp if you think that is a mistake.
                </p>
              )}
            </div>
          )}

          {/* not yet reviewed */}
          {!review && !open && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setOpen(true)}>
                <Icon name="sparkle" size={14} /> Write a review
              </Button>
              {available && (
                <Button as={Link} to={`/product/${slug}`} variant="outline" size="sm">
                  View product
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {open && !review && (
        <div className="mt-4">
          <ReviewForm
            productSlug={slug}
            productName={purchase.name}
            // Eligibility is already proven: this list is built from delivered
            // orders. The server re-checks on submit regardless.
            eligibility={{ canReview: true, kind: 'product' }}
            onSubmitted={onReviewed}
          />
        </div>
      )}
    </li>
  )
}

/**
 * "My reviews" in the account: every delivered product, unreviewed ones first,
 * each one reviewable in place and linked back to its product page.
 */
export function MyReviews() {
  const [purchases, setPurchases] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const { purchases: list } = await customerApi.get('/reviews/purchases')
      setPurchases(list)
    } catch (err) {
      setError(err.message ?? 'Could not load your purchases')
      setPurchases([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!purchases) {
    return <div className="py-16 text-center text-ink/45">Loading your purchases…</div>
  }

  if (error) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[0.875rem] text-red-700">
        <Icon name="alert" size={16} /> {error}
      </p>
    )
  }

  const waiting = purchases.filter((p) => !p.review).length

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">Review what you bought</h2>
          <p className="mt-1 text-[0.875rem] text-ink/55">
            {purchases.length === 0
              ? 'Products you have received will appear here.'
              : waiting > 0
                ? `${waiting} ${waiting === 1 ? 'product is' : 'products are'} waiting for your review.`
                : 'You have reviewed everything you received. Thank you.'}
          </p>
        </div>
        <Button as={Link} to="/reviews" variant="outline" size="sm">
          Review the shop
        </Button>
      </div>

      {purchases.length === 0 ? (
        <div className="rounded-2xl bg-sand p-10 text-center">
          <p className="font-display text-xl">Nothing delivered yet</p>
          <p className="mx-auto mt-2 max-w-sm text-[0.875rem] text-ink/55">
            You can review a product once your order for it has been delivered — that is what keeps
            these reviews worth reading.
          </p>
          <Button as={Link} to="/shop" variant="outline" size="sm" className="mt-4">
            Start shopping
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {purchases.map((p) => (
            <PurchaseCard key={p.slug} purchase={p} onReviewed={load} />
          ))}
        </ul>
      )}
    </div>
  )
}
