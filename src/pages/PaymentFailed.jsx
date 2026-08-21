import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { usePageMeta } from '@/components/common/PageShell'
import { useWhatsAppLink } from '@/context/SettingsContext'

/**
 * Where the API sends a shopper when an online payment does not complete.
 *
 * This is the worst moment in the funnel — money was attempted and refused —
 * so the page has to do three things: say plainly what happened, keep the
 * order number visible, and offer a way forward that does not require the card
 * to work. Cash on delivery is that way forward for most Bangladeshi shoppers.
 */
const REASONS = {
  'order-not-found': {
    title: 'We could not match that payment',
    body: 'The transaction did not reference an order we recognise. If money left your account, send us the transaction ID and we will trace it.',
  },
  amount: {
    title: 'The amount did not match',
    body: 'The amount received was less than the order total, so we have not marked it paid. Nothing has been charged twice — contact us and we will sort it out.',
  },
  default: {
    title: 'Your payment did not go through',
    body: 'The bank or wallet declined the transaction. Your bag is still saved, and no money has been taken.',
  },
}

export default function PaymentFailed() {
  const [params] = useSearchParams()
  const orderNumber = params.get('order') ?? ''
  const reason = params.get('reason') ?? 'default'
  const info = REASONS[reason] ?? REASONS.default

  const waLink = useWhatsAppLink(
    orderNumber
      ? `Hi! My payment for order ${orderNumber} did not go through. Can you help?`
      : 'Hi! My payment did not go through. Can you help?',
  )

  usePageMeta('Payment failed')

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-lg text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose/12 text-rose">
          <Icon name="alert" size={30} />
        </span>

        <h1 className="mt-6 text-[2rem] leading-tight tracking-tight md:text-[2.5rem]">
          {info.title}
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink/65 text-balance-pretty">
          {info.body}
        </p>

        {orderNumber && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-[0.875rem]">
            <span className="text-ink/55">Order</span>
            <strong className="font-semibold">{orderNumber}</strong>
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2.5">
          {/* The bag survives a failed payment, so retrying is one tap. */}
          <Button as={Link} to="/checkout" size="lg" full>
            Try paying again
          </Button>
          <Button as={Link} to="/checkout" variant="outline" size="lg" full className="border-moss text-moss hover:bg-moss hover:text-white">
            <Icon name="cash" size={18} /> Switch to cash on delivery
          </Button>
          <Button
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="lg"
            full
          >
            <Icon name="whatsapp" size={18} /> Message us on WhatsApp
          </Button>
        </div>

        {orderNumber && (
          <p className="mt-6 text-[0.875rem] text-ink/50">
            Already paid but seeing this?{' '}
            <Link to="/track-order" className="underline underline-offset-2 hover:text-plum">
              Track your order
            </Link>{' '}
            or send us the transaction ID.
          </p>
        )}
      </div>
    </div>
  )
}
