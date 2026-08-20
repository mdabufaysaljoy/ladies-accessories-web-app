import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon, StarIcon } from '@/components/ui/Icon'
import { customerApi } from '@/lib/api'
import { useStore } from '@/context/StoreContext'
import { cx } from '@/utils/format'

/** Clickable stars. Keyboard-operable, since this is the only required field. */
function StarPicker({ value, onChange, error }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Your rating"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(star)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(star)}
          className={cx(
            'grid h-11 w-11 place-items-center rounded-full transition-all duration-200',
            'hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
            error && !value && 'ring-1 ring-red-400',
          )}
        >
          <span className={cx('transition-transform duration-200', shown >= star ? 'scale-110 text-gold' : 'text-ink/20')}>
            <StarIcon size={26} fillPercent={shown >= star ? 100 : 0} />
          </span>
        </button>
      ))}
      <span className="ml-2 text-[0.875rem] text-ink/55">
        {['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent'][shown] || 'Tap to rate'}
      </span>
    </div>
  )
}

/**
 * The one review form, used for both a product and the shop as a whole —
 * `productSlug` is what switches between them.
 *
 * It never renders a writable form on its own judgement: `eligibility` comes
 * from the server, which owns the rule that only a verified buyer may review.
 * Everything here is presentation of that answer.
 */
export function ReviewForm({ productSlug, productName, eligibility, onSubmitted }) {
  const { toast } = useStore()
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const isShop = !productSlug
  const subject = isShop ? 'the shop' : productName || 'this product'

  if (!eligibility) return null

  /* --- submitted: they should not be able to send a second one --- */
  if (done) {
    return (
      <div className="rounded-[1.25rem] bg-moss/8 p-7 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-moss text-white">
          <Icon name="check" size={22} strokeWidth={2.5} />
        </span>
        <p className="mt-3.5 font-display text-xl">Thank you for writing</p>
        <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink/60">
          Sadia reads every review. Yours will appear here once it has been approved.
        </p>
      </div>
    )
  }

  /* --- not allowed: explain why, and offer the way forward --- */
  if (!eligibility.canReview) {
    const messages = {
      'signed-out': {
        icon: 'user',
        title: 'Sign in to write a review',
        body: `Reviews come from real customers, so we ask you to sign in first.`,
        action: { label: 'Sign in', to: '/login' },
      },
      'not-purchased': {
        icon: 'shield',
        title: 'Only buyers can review this product',
        body: 'Once your order for this item has been delivered, you can share what you think of it.',
        action: { label: 'Track an order', to: '/track-order' },
      },
      'no-orders': {
        icon: 'shield',
        title: 'Review us after your first order',
        body: 'Shop reviews come from customers who have received a delivery from us.',
        action: { label: 'Start shopping', to: '/shop' },
      },
      'already-reviewed': {
        icon: 'checkCircle',
        title: 'You have already reviewed this',
        body:
          eligibility.review?.status === 'pending'
            ? 'Your review is waiting to be approved. It will appear here shortly.'
            : 'Thank you — your review is live.',
      },
    }
    const m = messages[eligibility.reason] ?? messages['signed-out']

    return (
      <div className="rounded-[1.25rem] border border-dashed border-ink/20 p-7 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-sand text-ink/50">
          <Icon name={m.icon} size={20} />
        </span>
        <p className="mt-3.5 font-display text-xl">{m.title}</p>
        <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink/55">{m.body}</p>
        {m.action && (
          <Button as={Link} to={m.action.to} variant="outline" size="sm" className="mt-4">
            {m.action.label}
          </Button>
        )}
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!rating) {
      setError('Please choose a star rating')
      return
    }

    setBusy(true)
    try {
      const res = await customerApi.post('/reviews', {
        productSlug,
        rating,
        body: body.trim(),
      })
      setDone(true)
      toast(res.message ?? 'Review submitted', { kind: 'success' })
      onSubmitted?.()
    } catch (err) {
      setError(err.message ?? 'Could not save your review. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[1.25rem] bg-cream p-7 ring-1 ring-ink/8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-xl">Write about {subject}</p>
        <span className="flex items-center gap-1.5 rounded-full bg-moss/10 px-3 py-1 text-[0.6875rem] font-medium text-moss">
          <Icon name="checkCircle" size={13} /> Verified purchase
        </span>
      </div>

      <div className="mt-5">
        <label className="eyebrow text-ink/45">Your rating</label>
        <div className="mt-1.5">
          <StarPicker value={rating} onChange={setRating} error={Boolean(error && !rating)} />
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="review-body" className="eyebrow text-ink/45">
          Your review <span className="normal-case tracking-normal text-ink/35">(optional)</span>
        </label>
        <textarea
          id="review-body"
          rows={4}
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            isShop
              ? 'How was ordering, delivery and the packaging?'
              : 'How is the quality? Did it match the description?'
          }
          className="mt-2 w-full rounded-xl border border-ink/15 bg-cream px-4 py-3 text-[0.9375rem] leading-relaxed outline-none transition-colors placeholder:text-ink/30 focus:border-ink"
        />
        <p className="mt-1.5 text-right text-[0.75rem] text-ink/35">{body.length}/2000</p>
      </div>

      {error && (
        <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-red-600">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={busy} disabled={busy}>
          Submit review
        </Button>
        <p className="text-[0.8125rem] text-ink/50">Published after a quick check by our team.</p>
      </div>
    </form>
  )
}
