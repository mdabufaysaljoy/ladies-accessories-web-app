import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { useSettings } from '@/context/SettingsContext'
import { useReveal } from '@/hooks/useReveal'
import { cx } from '@/utils/format'

/**
 * Limited-time offers band. Every offer — copy, artwork, link, countdown and
 * whether the section shows at all — comes from Settings, so the shop can run
 * a campaign without a deploy.
 */

const msUntil = (endsAt) => {
  if (endsAt) return new Date(endsAt) - Date.now()
  // No end date: a timer that resets at local midnight.
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)
  return midnight - Date.now()
}

function useCountdown(endsAt, active) {
  const [left, setLeft] = useState(() => msUntil(endsAt))

  useEffect(() => {
    if (!active) return
    setLeft(msUntil(endsAt))
    const id = setInterval(() => setLeft(msUntil(endsAt)), 1000)
    return () => clearInterval(id)
  }, [endsAt, active])

  const total = Math.max(0, Math.floor(left / 1000))
  return {
    expired: total <= 0,
    days: Math.floor(total / 86400),
    hours: String(Math.floor((total % 86400) / 3600)).padStart(2, '0'),
    minutes: String(Math.floor((total % 3600) / 60)).padStart(2, '0'),
    seconds: String(total % 60).padStart(2, '0'),
  }
}

const THEME = {
  plum: { wrap: 'bg-plum text-cream', eyebrow: 'text-gold-soft', body: 'text-cream/70', chip: 'bg-cream/10', cta: 'gold' },
  ink: { wrap: 'bg-ink text-cream', eyebrow: 'text-gold-soft', body: 'text-cream/65', chip: 'bg-cream/10', cta: 'gold' },
  sand: { wrap: 'bg-sand text-ink', eyebrow: 'text-plum/70', body: 'text-ink/65', chip: 'bg-ink/8', cta: 'primary' },
  blush: { wrap: 'bg-blush text-ink', eyebrow: 'text-plum/70', body: 'text-ink/65', chip: 'bg-ink/8', cta: 'primary' },
}

function Countdown({ offer, theme }) {
  const { expired, days, hours, minutes, seconds } = useCountdown(offer.endsAt, offer.countdownEnabled)
  if (!offer.countdownEnabled || expired) return null

  const units = [
    ...(days > 0 ? [{ v: String(days).padStart(2, '0'), l: 'days' }] : []),
    { v: hours, l: 'hrs' },
    { v: minutes, l: 'min' },
    { v: seconds, l: 'sec' },
  ]

  return (
    <div className="mt-6 flex items-center gap-2">
      {units.map((unit, i) => (
        <div key={unit.l} className="flex items-center gap-2">
          <div className={cx('rounded-xl px-3 py-2 text-center backdrop-blur-sm', theme.chip)}>
            <span className="block font-display text-xl leading-none tabular-nums">{unit.v}</span>
            <span className="mt-1 block text-[0.5625rem] uppercase tracking-[0.14em] opacity-55">
              {unit.l}
            </span>
          </div>
          {i < units.length - 1 && <span className="opacity-30">:</span>}
        </div>
      ))}
    </div>
  )
}

function OfferArt({ offer, className = '' }) {
  if (offer.imageUrl) {
    return <img src={offer.imageUrl} alt="" className={cx('h-full w-full object-cover', className)} />
  }
  return <ProductArt product={{ art: offer.art, name: offer.title }} className={className} />
}

function LargeOffer({ offer, tf }) {
  const theme = THEME[offer.theme] ?? THEME.plum

  return (
    <div className={cx('reveal relative overflow-hidden rounded-[1.75rem]', theme.wrap)}>
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-rose/25 blur-3xl" />
      <div className="relative grid items-center gap-8 p-8 sm:grid-cols-[1.1fr_1fr] md:p-12">
        <div>
          {offer.eyebrow && <p className={cx('eyebrow', theme.eyebrow)}>{tf(offer, 'eyebrow')}</p>}
          <h3 className="mt-3.5 text-[2.125rem] leading-[1.05] md:text-[2.75rem]">{tf(offer, 'title')}</h3>
          {offer.body && (
            <p className={cx('mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-balance-pretty', theme.body)}>
              {tf(offer, 'body')}
            </p>
          )}

          <Countdown offer={offer} theme={theme} />

          {offer.ctaLabel && (
            <Button to={offer.ctaHref || '/shop'} variant={theme.cta} size="lg" className="mt-7">
              {tf(offer, 'ctaLabel')} <Icon name="arrowRight" size={17} />
            </Button>
          )}
        </div>

        <div className="relative hidden aspect-[4/5] overflow-hidden rounded-2xl sm:block">
          <OfferArt offer={offer} />
        </div>
      </div>
    </div>
  )
}

function CompactOffer({ offer, tf }) {
  return (
    <div className="reveal group relative min-h-[19rem] overflow-hidden rounded-[1.75rem] bg-sand">
      <div className="absolute inset-0 opacity-90 transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105">
        <OfferArt offer={offer} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/25 to-transparent" />

      <div className="relative flex h-full min-h-[19rem] flex-col justify-end p-8 text-cream">
        {offer.badge && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-cream/15 px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] backdrop-blur-md">
            <Icon name="gift" size={13} /> {offer.badge}
          </span>
        )}
        <h3 className="mt-4 text-[1.75rem] leading-tight">{tf(offer, 'title')}</h3>
        {offer.body && (
          <p className="mt-2 max-w-xs text-[0.875rem] text-cream/70 text-balance-pretty">
            {tf(offer, 'body')}
          </p>
        )}
        <Countdown offer={offer} theme={THEME.ink} />
        {offer.ctaLabel && (
          <Button to={offer.ctaHref || '/shop'} variant="light" size="md" className="mt-5 w-fit">
            {tf(offer, 'ctaLabel')}
          </Button>
        )}
      </div>
    </div>
  )
}

export function PromoBanner() {
  const ref = useReveal({ stagger: 100 })
  const { settings, tf } = useSettings()
  const promos = settings.promotions

  if (!promos?.enabled) return null

  // An offer whose end date has passed drops out on its own.
  const now = Date.now()
  const live = (promos.offers ?? [])
    .filter((o) => o.enabled !== false)
    .filter((o) => !(o.countdownEnabled && o.endsAt && new Date(o.endsAt) <= now))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  if (!live.length) return null

  const large = live.filter((o) => o.layout === 'large')
  const compact = live.filter((o) => o.layout !== 'large')

  return (
    <section ref={ref} className="container-x py-4">
      {promos.heading && (
        <div className="reveal mb-6">
          <h2 className="text-[1.75rem] leading-tight tracking-tight md:text-[2rem]">
            {tf(promos, 'heading')}
          </h2>
          {promos.subheading && (
            <p className="mt-1.5 text-[0.9375rem] text-ink/55">{promos.subheading}</p>
          )}
        </div>
      )}

      <div className={cx('grid gap-4', large.length && compact.length && 'lg:grid-cols-[1.35fr_1fr]')}>
        {large.map((offer, i) => (
          <LargeOffer key={`large-${i}`} offer={offer} tf={tf} />
        ))}

        {compact.length > 0 && (
          <div className={cx('grid gap-4', !large.length && compact.length > 1 && 'md:grid-cols-2 lg:grid-cols-3')}>
            {compact.map((offer, i) => (
              <CompactOffer key={`compact-${i}`} offer={offer} tf={tf} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
