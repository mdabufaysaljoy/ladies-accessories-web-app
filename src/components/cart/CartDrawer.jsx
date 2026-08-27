import { useNavigate } from 'react-router-dom'
import { Drawer } from '@/components/ui/Overlay'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { CartLine } from './CartLine'
import { FreeShippingBar } from './FreeShippingBar'
import { ProductArt } from '@/components/product/ProductArt'
import { useBestsellers } from '@/hooks/useCatalog'
import { useStore } from '@/context/StoreContext'
import { taka } from '@/utils/format'

export function CartDrawer() {
  const { products: bestsellerProducts } = useBestsellers(8)
  const { cartOpen, setCartOpen, lines, totals, addToCart } = useStore()
  const navigate = useNavigate()
  const close = () => setCartOpen(false)

  const go = (path) => {
    close()
    navigate(path)
  }

  // Cross-sell: real bestsellers that are not already in the bag.
  const suggestions = bestsellerProducts
    .filter((p) => !lines.some((l) => l.id === p.id))
    .slice(0, 2)

  const footer =
    lines.length > 0 ? (
      <div className="space-y-4 p-5">
        <dl className="space-y-2 text-[0.875rem]">
          <div className="flex justify-between">
            <dt className="text-ink/60">Subtotal</dt>
            <dd className="font-medium">{taka(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-moss">
              <dt>Discount</dt>
              <dd className="font-medium">−{taka(totals.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink/60">Delivery</dt>
            <dd className="font-medium">
              {totals.shipping === 0 ? (
                <span className="text-moss">Free</span>
              ) : (
                taka(totals.shipping)
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-ink/10 pt-3">
            <dt className="font-display text-lg">Total</dt>
            <dd className="font-display text-2xl">{taka(totals.total)}</dd>
          </div>
        </dl>

        <div className="space-y-2.5">
          <Button size="lg" full onClick={() => go('/checkout')}>
            Checkout · {taka(totals.total)}
          </Button>
          <Button variant="outline" size="md" full onClick={() => go('/cart')}>
            View full bag
          </Button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[0.6875rem] text-ink/45">
          <Icon name="lock" size={12} /> Secure checkout · Cash on delivery available
        </p>
      </div>
    ) : null

  return (
    <Drawer
      open={cartOpen}
      onClose={close}
      title={`Your bag${totals.itemCount ? ` (${totals.itemCount})` : ''}`}
      footer={footer}
    >
      {lines.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-sand">
            <Icon name="bag" size={30} className="text-ink/30" />
          </div>
          <div>
            <p className="font-display text-xl">Your bag is empty</p>
            <p className="mt-1.5 text-[0.875rem] text-ink/55">
              Hijabs, skincare and colour — all waiting.
            </p>
          </div>
          <Button onClick={() => go('/shop')}>Start shopping</Button>
        </div>
      ) : (
        <div className="px-5">
          <div className="pt-5">
            <FreeShippingBar subtotal={totals.subtotal} />
          </div>

          <ul className="divide-y divide-ink/8">
            {lines.map((line) => (
              <CartLine key={line.key} line={line} compact onNavigate={close} />
            ))}
          </ul>

          {suggestions.length > 0 && (
            <div className="border-t border-ink/8 py-6">
              <p className="eyebrow text-ink/40">Complete the routine</p>
              <div className="mt-4 space-y-3">
                {suggestions.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-sand/70 p-2.5">
                    <button
                      type="button"
                      onClick={() => go(`/product/${p.slug}`)}
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand"
                    >
                      <ProductArt product={p} decorative={false} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-medium">{p.name}</p>
                      <p className="text-[0.75rem] text-ink/50">{taka(p.price)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        addToCart(p, {
                          qty: 1,
                          color: p.colors[0]?.name ?? null,
                          size: p.sizes[0]?.label ?? null,
                          silent: true,
                        })
                      }
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
