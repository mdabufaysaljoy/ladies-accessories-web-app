import { Link } from 'react-router-dom'
import { Section, SectionHeader } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { ROUTINE_STEPS } from '@/data/content'
import { useProductsBySlug, useBestsellers } from '@/hooks/useCatalog'
import { useStore } from '@/context/StoreContext'
import { useReveal } from '@/hooks/useReveal'
import { taka } from '@/utils/format'

export function RoutineSteps() {
  const ref = useReveal({ stagger: 110 })
  const { addToCart, toast } = useStore()

  /**
   * The three slugs are the shop's editorial choice, but a real catalogue may
   * not contain them — they were seed-data slugs. Fall back to bestsellers so
   * the bundle is always three products the shop actually sells, and hide the
   * section entirely when there are not three to offer.
   */
  const pinned = useProductsBySlug(ROUTINE_STEPS.map((s) => s.productSlug))
  const { products: fallback, loading } = useBestsellers(3)
  const products = pinned.length === ROUTINE_STEPS.length ? pinned : fallback.slice(0, 3)

  /**
   * The section is a three-product bundle, so it only makes sense with three
   * products. A shop with fewer simply does not show it, rather than rendering
   * empty slots or crashing on an undefined product.
   */
  if (loading) return null
  if (products.length < ROUTINE_STEPS.length) return null

  const bundleTotal = products.reduce((sum, p) => sum + p.price, 0)
  const bundlePrice = Math.round(bundleTotal * 0.85)

  const addBundle = () => {
    products.forEach((p) => addToCart(p, { qty: 1, silent: true }))
    toast('Three-step routine added to your bag', { kind: 'success' })
  }

  return (
    <Section>
      <div className="container-x">
        <SectionHeader
          eyebrow="The three-step edit"
          title="A routine that actually fits humid weather"
          body="Most routines are built for dry winters. This one is three steps, five minutes, and designed for skin that sweats under a scarf."
          align="center"
        />

        <div ref={ref} className="mt-14 grid gap-6 md:grid-cols-3">
          {ROUTINE_STEPS.map((step, i) => {
            const product = products[i]
            return (
              <div key={step.step} className="reveal group relative">
                {/* connector line between steps */}
                {i < ROUTINE_STEPS.length - 1 && (
                  <div
                    className="absolute -right-3 top-[7.5rem] hidden h-px w-6 bg-ink/15 md:block"
                    aria-hidden="true"
                  />
                )}

                <Link to={`/product/${product.slug}`} className="block">
                  <div className="relative aspect-[5/4] overflow-hidden rounded-card bg-sand">
                    <div className="absolute inset-0 transition-transform duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105">
                      <ProductArt product={product} />
                    </div>
                    <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-cream/90 font-display text-lg backdrop-blur-sm">
                      {step.step}
                    </span>
                  </div>

                  <h3 className="mt-5 text-[1.375rem] tracking-tight transition-colors group-hover:text-plum">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink/60 text-balance-pretty">
                    {step.body}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-[0.875rem]">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-ink/45">{taka(product.price)}</span>
                  </p>
                </Link>
              </div>
            )
          })}
        </div>

        <div className="reveal mt-11 flex flex-col items-center justify-between gap-5 rounded-[1.5rem] bg-blush p-7 sm:flex-row md:px-10">
          <div>
            <p className="flex items-center gap-2 font-display text-xl">
              <Icon name="sparkle" size={17} className="text-gold" fill />
              Take all three and save 15%
            </p>
            <p className="mt-1.5 text-[0.875rem] text-ink/60">
              <span className="font-semibold text-ink">{taka(bundlePrice)}</span>{' '}
              <span className="line-through">{taka(bundleTotal)}</span> — you save{' '}
              {taka(bundleTotal - bundlePrice)}
            </p>
          </div>
          <Button size="lg" onClick={addBundle}>
            <Icon name="bag" size={17} /> Add the routine
          </Button>
        </div>
      </div>
    </Section>
  )
}
