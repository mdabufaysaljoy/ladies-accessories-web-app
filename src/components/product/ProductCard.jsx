import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProductArt } from './ProductArt'
import { Rating } from '@/components/ui/Rating'
import { Icon } from '@/components/ui/Icon'
import { useStore } from '@/context/StoreContext'
import { cx, percentOff, taka } from '@/utils/format'

function Badge({ children, tone = 'ink' }) {
  const tones = {
    ink: 'bg-ink text-cream',
    rose: 'bg-rose text-white',
    gold: 'bg-gold text-ink',
    sale: 'bg-plum text-cream',
  }
  return (
    <span
      className={cx(
        'rounded-full px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em]',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

/**
 * Every card carries both actions — Add to bag and Buy now — on every surface
 * they appear, always visible rather than hidden behind a hover. Quick view
 * stays as the extra on the image.
 *
 * The card body uses a stretched link (`after:absolute inset-0`) rather than
 * wrapping everything in an <a>. Buttons nested inside a link are invalid HTML
 * and break keyboard navigation; this keeps the whole card clickable while the
 * buttons remain real, independent controls.
 */
export function ProductCard({ product, onQuickView, priority = false, className = '' }) {
  const { addToCart, toggleWishlist, inWishlist } = useStore()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  const saved = inWishlist(product.slug)
  const discount = percentOff(product.price, product.compareAt)
  const soldOut = product.stock === 0
  const lowStock = product.stock > 0 && product.stock <= 15
  const colors = product.colors ?? []
  const sizes = product.sizes ?? []
  const needsOptions = colors.length > 0 || sizes.length > 0

  /** Variant products must not have a colour or size picked for them silently. */
  const chooseFirst = () => {
    if (onQuickView) onQuickView(product)
    else navigate(`/product/${product.slug}`)
  }

  const handleAdd = () => {
    if (soldOut) return
    if (needsOptions) return chooseFirst()
    setAdding(true)
    addToCart(product, { qty: 1 })
    setTimeout(() => setAdding(false), 900)
  }

  const handleBuyNow = () => {
    if (soldOut) return
    if (needsOptions) return chooseFirst()
    addToCart(product, { qty: 1, silent: true })
    navigate('/checkout')
  }

  return (
    <article className={cx('group/card relative flex flex-col', className)}>
      <div className="relative overflow-hidden rounded-card bg-sand">
        <div className="aspect-[4/5] w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/card:scale-[1.06]">
          <ProductArt product={product} priority={priority} />
        </div>

        {/* badges */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.badge && <Badge tone={product.badge === 'New' ? 'rose' : 'ink'}>{product.badge}</Badge>}
          {discount > 0 && <Badge tone="sale">-{discount}%</Badge>}
          {soldOut && <Badge tone="gold">Sold out</Badge>}
        </div>

        {/* wishlist */}
        <button
          type="button"
          onClick={() => toggleWishlist(product.slug)}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={saved}
          className={cx(
            'absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full backdrop-blur-sm transition-all duration-300',
            saved
              ? 'bg-rose text-white'
              : 'bg-cream/85 text-ink hover:bg-cream md:opacity-0 md:group-hover/card:opacity-100 md:focus-visible:opacity-100',
          )}
        >
          <Icon name="heart" size={17} fill={saved} strokeWidth={1.6} />
        </button>

        {/* quick view */}
        {onQuickView && !soldOut && (
          <button
            type="button"
            onClick={() => onQuickView(product)}
            className={cx(
              'absolute inset-x-3 bottom-3 z-20 flex h-10 items-center justify-center gap-2 rounded-full',
              'bg-cream/90 text-[0.8125rem] font-medium text-ink backdrop-blur-md transition-all duration-400',
              'hover:bg-white md:translate-y-2 md:opacity-0 md:group-hover/card:translate-y-0 md:group-hover/card:opacity-100',
            )}
          >
            <Icon name="eye" size={16} />
            {needsOptions ? 'Choose options' : 'Quick view'}
          </button>
        )}
      </div>

      {/* meta — the stretched link lives here */}
      <div className="pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-ink/40">{product.subcategory}</p>
          <Rating value={product.rating} size={11} />
        </div>

        <h3 className="mt-1.5 text-[1.0625rem] leading-snug tracking-tight text-balance-pretty transition-colors group-hover/card:text-plum">
          <Link to={`/product/${product.slug}`} className="after:absolute after:inset-0 after:z-10">
            {product.name}
          </Link>
        </h3>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
          <span className="text-[0.9375rem] font-semibold">{taka(product.price)}</span>
          {product.compareAt > product.price && (
            <span className="text-[0.8125rem] text-ink/35 line-through">{taka(product.compareAt)}</span>
          )}
          {colors.length > 0 && (
            <span className="ml-auto text-[0.6875rem] text-ink/40">{colors.length} colours</span>
          )}
        </div>

        {lowStock && !soldOut && (
          <p className="mt-1.5 text-[0.6875rem] font-medium text-rose">
            Only {product.stock} left in stock
          </p>
        )}
      </div>

      {/* actions — above the stretched link, so they stay clickable */}
      <div className="relative z-20 mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={soldOut}
          className={cx(
            'flex h-10 items-center justify-center gap-1.5 rounded-full border text-[0.75rem] font-medium transition-colors sm:text-[0.8125rem]',
            adding
              ? 'border-moss bg-moss text-white'
              : 'border-ink/20 text-ink hover:border-ink hover:bg-ink hover:text-cream',
            'disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/30 disabled:hover:bg-transparent',
          )}
        >
          {adding ? (
            <>
              <Icon name="check" size={15} strokeWidth={2.5} /> Added
            </>
          ) : (
            <>
              <Icon name="bag" size={15} className="hidden sm:inline" />
              {soldOut ? 'Sold out' : 'Add to bag'}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={soldOut}
          className={cx(
            'flex h-10 items-center justify-center gap-1.5 rounded-full text-[0.75rem] font-medium transition-colors sm:text-[0.8125rem]',
            'bg-ink text-cream hover:bg-plum',
            'disabled:cursor-not-allowed disabled:bg-ink/25',
          )}
        >
          Buy now
          <Icon name="arrowRight" size={15} className="hidden sm:inline" />
        </button>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[4/5] w-full rounded-card" />
      <div className="skeleton mt-4 h-3 w-1/3 rounded-full" />
      <div className="skeleton mt-2.5 h-4 w-4/5 rounded-full" />
      <div className="skeleton mt-2.5 h-4 w-1/4 rounded-full" />
      <div className="skeleton mt-3 h-10 w-full rounded-full" />
    </div>
  )
}
