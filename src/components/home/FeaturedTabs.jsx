import { useState } from 'react'
import { Section, SectionHeader } from '@/components/ui/Section'
import { ProductGrid } from '@/components/product/ProductGrid'
import { useBestsellers, useNewArrivals, useOnSale } from '@/hooks/useCatalog'
import { cx } from '@/utils/format'

const TABS = [
  { id: 'best', label: 'Bestsellers' },
  { id: 'new', label: 'New arrivals' },
  { id: 'sale', label: 'On offer' },
]

export function FeaturedTabs() {
  const [active, setActive] = useState('best')

  /**
   * All three rails are fetched rather than the active one, so switching tabs
   * is instant and the counts on the inactive tabs are real. Three small
   * requests on one page load is a fair trade for that.
   */
  const best = useBestsellers(8)
  const fresh = useNewArrivals(8)
  const sale = useOnSale(8)
  const rails = { best, new: fresh, sale }

  const rail = rails[active]
  const products = rail.products

  /**
   * A shop with nothing to show should show nothing. The section used to fall
   * back to bundled demo products, so an empty catalogue still rendered eight
   * items that could not be bought.
   */
  if (!best.loading && !fresh.loading && !sale.loading &&
      !best.total && !fresh.total && !sale.total) {
    return null
  }

  return (
    <Section className="bg-sand/50">
      <div className="container-x">
        <SectionHeader
          eyebrow="Loved by 12,000 customers"
          title="What is moving fastest"
          body="Restocked weekly. When something sells out here, it usually comes back within ten days."
          action="Shop everything"
          actionTo="/shop"
        />

        <div
          role="tablist"
          aria-label="Product collections"
          className="no-scrollbar mt-9 flex gap-2 overflow-x-auto"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setActive(t.id)}
              className={cx(
                'shrink-0 rounded-full px-5 py-2.5 text-[0.875rem] font-medium transition-all duration-300',
                active === t.id
                  ? 'bg-ink text-cream shadow-soft'
                  : 'border border-ink/12 text-ink/60 hover:border-ink/35 hover:text-ink',
              )}
            >
              {t.label}
              <span className={cx('ml-2 text-[0.75rem]', active === t.id ? 'text-cream/50' : 'text-ink/35')}>
                {rails[t.id].total}
              </span>
            </button>
          ))}
        </div>

        {/* keyed so the reveal animation replays when the tab changes */}
        <div key={active} className="mt-10">
          <ProductGrid products={products} loading={rail.loading} />
        </div>
      </div>
    </Section>
  )
}
