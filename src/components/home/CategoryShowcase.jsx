import { Link } from 'react-router-dom'
import { Section, SectionHeader } from '@/components/ui/Section'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from '@/components/product/ProductArt'
import { useCategories } from '@/hooks/useCategories'
import { useSettings } from '@/context/SettingsContext'
import { byCategory } from '@/data/products'
import { useReveal } from '@/hooks/useReveal'
import { cx } from '@/utils/format'

/** Asymmetric editorial grid — first tile spans two rows on desktop. */
const TILE_SPANS = [
  'md:col-span-2 md:row-span-2',
  'md:col-span-2',
  'md:col-span-2',
  'md:col-span-2',
  'md:col-span-2',
]

export function CategoryShowcase() {
  const ref = useReveal({ stagger: 90 })
  const categories = useCategories()
  const { storefront } = useSettings()

  /**
   * On by default: a brand-new shop that has not been through the settings
   * page yet should still get the section, so `=== false` rather than a
   * truthiness check on a field that may simply be absent.
   */
  if (storefront?.showCategorySection === false) return null
  if (!categories.length) return null

  // The tile spans are an editorial layout for five; beyond that the extra
  // tiles fall into the ordinary grid flow rather than breaking the pattern.
  const tiles = categories.slice(0, 5)

  return (
    <Section>
      <div className="container-x">
        <SectionHeader
          eyebrow="Shop by category"
          title={storefront?.categorySectionTitle || 'Five edits, one standard'}
          body={
            storefront?.categorySectionBody ||
            'Everything here has been used by us first. If it did not earn a place in our own routine, it does not get listed.'
          }
          action="View all products"
          actionTo="/shop"
        />

        <div ref={ref} className="mt-12 grid auto-rows-[13rem] gap-4 md:grid-cols-4 md:auto-rows-[12rem]">
          {tiles.map((cat, i) => {
            const count = byCategory(cat.slug).length
            const hero = byCategory(cat.slug)[0]
            const large = i === 0

            return (
              <Link
                key={cat.slug}
                to={`/shop/${cat.slug}`}
                className={cx(
                  'group relative overflow-hidden rounded-card bg-sand reveal',
                  TILE_SPANS[i],
                )}
              >
                <div className="absolute inset-0 transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]">
                  <ProductArt product={hero} />
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/15 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-cream/60">
                      {count} {count === 1 ? 'product' : 'products'}
                    </p>
                    <h3
                      className={cx(
                        'mt-1.5 text-cream tracking-tight',
                        large ? 'text-[2rem] leading-tight' : 'text-[1.375rem]',
                      )}
                    >
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-[0.75rem] text-cream/70 text-balance-pretty md:text-[0.8125rem]">
                      {cat.tagline}
                    </p>
                    {/* the long blurb only has room on the large desktop tile */}
                    {large && (
                      <p className="mt-2 hidden max-w-xs text-[0.875rem] text-cream/60 text-balance-pretty md:block">
                        {cat.blurb}
                      </p>
                    )}
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream/15 text-cream backdrop-blur-md transition-all duration-400 group-hover:bg-cream group-hover:text-ink">
                    <Icon name="arrowUpRight" size={19} />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </Section>
  )
}
