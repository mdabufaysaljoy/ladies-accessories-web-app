import { useRef } from 'react'
import { Section } from '@/components/ui/Section'
import { Rating } from '@/components/ui/Rating'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/Button'
import { TESTIMONIALS } from '@/data/content'
import { useReveal } from '@/hooks/useReveal'

export function Testimonials() {
  const ref = useReveal()
  const trackRef = useRef(null)

  const scrollBy = (dir) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector('article')
    const amount = card ? card.offsetWidth + 20 : track.clientWidth * 0.8
    track.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }

  return (
    <Section className="overflow-hidden bg-ink text-cream">
      <div ref={ref} className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="eyebrow text-gold-soft">Verified customer reviews</p>
            <h2 className="mt-3 text-[2rem] leading-[1.08] tracking-tight md:text-[2.75rem]">
              12,000 orders. 4.9 out of 5.
            </h2>
            <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-cream/60 text-balance-pretty">
              Every review below is from a confirmed, delivered order. We do not edit them and we do not
              delete the critical ones.
            </p>
          </div>

          <div className="flex gap-2">
            <IconButton
              label="Previous reviews"
              onClick={() => scrollBy(-1)}
              className="border border-cream/20 text-cream hover:bg-cream hover:text-ink"
            >
              <Icon name="chevronLeft" size={18} />
            </IconButton>
            <IconButton
              label="Next reviews"
              onClick={() => scrollBy(1)}
              className="border border-cream/20 text-cream hover:bg-cream hover:text-ink"
            >
              <Icon name="chevronRight" size={18} />
            </IconButton>
          </div>
        </div>

        <div
          ref={trackRef}
          className="no-scrollbar mt-11 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2"
        >
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="w-[clamp(17rem,80vw,22rem)] shrink-0 snap-start rounded-[1.5rem] bg-cream/[0.06] p-7 backdrop-blur-sm transition-colors duration-400 hover:bg-cream/10"
            >
              <Rating value={t.rating} size={15} />
              <blockquote className="mt-4 text-[0.9375rem] leading-relaxed text-cream/85 text-balance-pretty">
                “{t.body}”
              </blockquote>
              <footer className="mt-6 flex items-center gap-3 border-t border-cream/12 pt-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/25 font-display text-[0.9375rem] text-gold-soft">
                  {t.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-medium">{t.name}</p>
                  <p className="truncate text-[0.75rem] text-cream/45">{t.location}</p>
                </div>
                <span className="ml-auto flex shrink-0 items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-moss">
                  <Icon name="checkCircle" size={13} /> Verified
                </span>
              </footer>
              <p className="mt-3 truncate text-[0.75rem] text-cream/40">Purchased: {t.product}</p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  )
}
