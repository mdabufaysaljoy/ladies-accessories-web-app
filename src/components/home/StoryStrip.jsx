import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { useBestsellers, useProductsBySlug } from '@/hooks/useCatalog'
import { useSettings } from '@/context/SettingsContext'
import { useReveal } from '@/hooks/useReveal'

const PILLARS = [
  {
    icon: 'shield',
    title: 'Sourced, not resold',
    body: 'Direct from authorised distributors and our own hijab workshop in Narayanganj. Batch codes on every unit.',
  },
  {
    icon: 'leaf',
    title: 'Formulated for here',
    body: 'Humidity, hard water and sun — every product is tested against the conditions you actually live in.',
  },
  {
    icon: 'cash',
    title: 'Honest pricing',
    body: 'No inflated "original" prices to make a discount look bigger. What you see is what it has always cost.',
  },
]

export function StoryStrip() {
  const ref = useReveal({ stagger: 100 })
  // The product the admin picked in Settings, or the best seller on Auto.
  const { storefront } = useSettings()
  const chosen = useProductsBySlug(storefront?.storyProduct ? [storefront.storyProduct] : [])
  const best = useBestsellers(1).products[0]
  const hero = chosen[0] ?? best

  return (
    <section ref={ref} className="py-16 md:py-24">
      <div className="container-x">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="reveal relative">
            <div className="aspect-[5/6] overflow-hidden rounded-[1.75rem] shadow-lift">
              <ProductArt product={hero} />
            </div>
            <div className="absolute -bottom-6 -right-3 w-52 rounded-2xl bg-cream p-5 shadow-lift md:right-6">
              <p className="font-display text-[2.25rem] leading-none">2021</p>
              <p className="mt-2 text-[0.8125rem] leading-snug text-ink/60">
                Started with 30 hijabs and one Instagram account.
              </p>
            </div>
          </div>

          <div className="reveal">
            <p className="eyebrow text-plum/70">Our story</p>
            <h2 className="mt-3 text-[2rem] leading-[1.08] tracking-tight md:text-[2.75rem]">
              Built because nothing on the market was good enough.
            </h2>
            <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink/65 text-balance-pretty">
              Sadia started this from her bedroom in Banani after one too many hijabs that slipped, faded
              or arrived nothing like the photo. Five years later the standard has not moved: if it does
              not survive her own week, it does not get listed.
            </p>

            <ul className="mt-9 space-y-6">
              {PILLARS.map((pillar) => (
                <li key={pillar.title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blush text-plum">
                    <Icon name={pillar.icon} size={19} />
                  </span>
                  <div>
                    <p className="text-[1.0625rem] tracking-tight font-display">{pillar.title}</p>
                    <p className="mt-1 text-[0.875rem] leading-relaxed text-ink/60 text-balance-pretty">
                      {pillar.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <Button to="/about" variant="outline" size="lg" className="mt-9">
              Read our full story <Icon name="arrowRight" size={17} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
