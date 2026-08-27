import { ProductGrid } from '@/components/product/ProductGrid'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Section, SectionHeader } from '@/components/ui/Section'
import { EmptyState, PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useBestsellers } from '@/hooks/useCatalog'
import { useStore } from '@/context/StoreContext'
import { taka } from '@/utils/format'

export default function Wishlist() {
  const { products: bestsellerProducts } = useBestsellers(8)
  const { wishlistProducts, addToCart, toast } = useStore()
  usePageMeta('Wishlist')

  const inStock = wishlistProducts.filter((p) => p.stock > 0)
  const total = inStock.reduce((sum, p) => sum + p.price, 0)

  const addAll = () => {
    inStock.forEach((p) =>
      addToCart(p, {
        qty: 1,
        color: p.colors[0]?.name ?? null,
        size: p.sizes[0]?.label ?? null,
        silent: true,
      }),
    )
    toast(`${inStock.length} items added to your bag`, { kind: 'success' })
  }

  if (wishlistProducts.length === 0) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Wishlist' }]} title="Your wishlist" tone="plain" />
        <EmptyState
          icon="heart"
          title="Nothing saved yet"
          body="Tap the heart on any product to keep it here — we will hold it until you are ready."
          action="Browse products"
          actionTo="/shop"
        />
        <Section>
          <div className="container-x">
            <SectionHeader eyebrow="Popular right now" title="Start with these" align="center" />
            <div className="mt-10">
              <ProductGrid products={bestsellerProducts.slice(0, 4)} />
            </div>
          </div>
        </Section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Wishlist' }]}
        eyebrow="Saved for later"
        title="Your wishlist"
        lead={`${wishlistProducts.length} ${wishlistProducts.length === 1 ? 'item' : 'items'} saved on this device.`}
      >
        {inStock.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" onClick={addAll}>
              <Icon name="bag" size={17} /> Add all to bag · {taka(total)}
            </Button>
            <p className="text-[0.8125rem] text-ink/55">
              {inStock.length} of {wishlistProducts.length} available
            </p>
          </div>
        )}
      </PageHeader>

      <div className="container-x py-12 md:py-16">
        <ProductGrid products={wishlistProducts} />
      </div>
    </>
  )
}
