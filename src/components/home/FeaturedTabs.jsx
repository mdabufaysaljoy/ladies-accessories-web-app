import { useState } from 'react'
import { Section, SectionHeader } from '@/components/ui/Section'
import { ProductGrid } from '@/components/product/ProductGrid'
import { bestsellers, newArrivals, onSale } from '@/data/products'
import { cx } from '@/utils/format'

const TABS = [
  { id: 'best', label: 'Bestsellers', get: bestsellers },
  { id: 'new', label: 'New arrivals', get: newArrivals },
  { id: 'sale', label: 'On offer', get: onSale },
]

export function FeaturedTabs() {
  const [active, setActive] = useState('best')
  const tab = TABS.find((t) => t.id === active)
  const products = tab.get().slice(0, 8)

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
                {t.get().length}
              </span>
            </button>
          ))}
        </div>

        {/* keyed so the reveal animation replays when the tab changes */}
        <div key={active} className="mt-10">
          <ProductGrid products={products} />
        </div>
      </div>
    </Section>
  )
}
