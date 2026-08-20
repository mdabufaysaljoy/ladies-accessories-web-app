import { useState } from 'react'
import { ProductCard, ProductCardSkeleton } from './ProductCard'
import { QuickView } from './QuickView'
import { useReveal } from '@/hooks/useReveal'
import { cx } from '@/utils/format'

/**
 * Grid + the single QuickView modal it drives. Keeping the modal here means a
 * page never has to manage quick-view state itself.
 */
export function ProductGrid({
  products,
  columns = 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  loading = false,
  skeletonCount = 8,
  reveal = true,
  className = '',
}) {
  const [quick, setQuick] = useState(null)
  const ref = useReveal({ stagger: 55 })

  if (loading) {
    return (
      <div className={cx('grid grid-cols-2 gap-x-4 gap-y-9 md:gap-x-6 md:gap-y-12', columns, className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <>
      <div
        ref={reveal ? ref : undefined}
        className={cx('grid grid-cols-2 gap-x-4 gap-y-9 md:gap-x-6 md:gap-y-12', columns, className)}
      >
        {products.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={i < 4}
            onQuickView={setQuick}
            className={reveal ? 'reveal' : undefined}
          />
        ))}
      </div>

      <QuickView product={quick} open={Boolean(quick)} onClose={() => setQuick(null)} />
    </>
  )
}
