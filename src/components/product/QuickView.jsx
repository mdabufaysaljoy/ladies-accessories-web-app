import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Overlay'
import { Button } from '@/components/ui/Button'
import { Rating } from '@/components/ui/Rating'
import { Icon } from '@/components/ui/Icon'
import { ProductArt } from './ProductArt'
import { ColorPicker, QtyStepper, SizePicker } from './VariantPicker'
import { useStore } from '@/context/StoreContext'
import { percentOff, taka } from '@/utils/format'

export function QuickView({ product, open, onClose }) {
  const { addToCart } = useStore()
  const navigate = useNavigate()
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (!product) return
    setColor(product.colors[0]?.name ?? '')
    setSize(product.sizes[0]?.label ?? '')
    setQty(1)
  }, [product])

  if (!product) return null

  const sizeOption = product.sizes.find((s) => s.label === size)
  const unitPrice = product.price + (sizeOption?.priceDelta ?? 0)
  const discount = percentOff(product.price, product.compareAt)

  const add = () => {
    addToCart(product, { qty, color: color || null, size: size || null })
    onClose()
  }

  const buyNow = () => {
    addToCart(product, { qty, color: color || null, size: size || null, silent: true })
    onClose()
    navigate('/checkout')
  }

  return (
    <Modal open={open} onClose={onClose} title={product.name}>
      <div className="grid md:grid-cols-2">
        <div className="relative aspect-square bg-sand md:aspect-auto md:min-h-[520px]">
          <ProductArt product={product} priority />
          {discount > 0 && (
            <span className="absolute left-4 top-4 rounded-full bg-plum px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-cream">
              Save {discount}%
            </span>
          )}
        </div>

        <div className="flex flex-col gap-5 p-6 md:p-9">
          <div>
            <p className="eyebrow text-ink/45">{product.subcategory}</p>
            <h2 className="mt-2 text-[1.75rem] leading-[1.15]">{product.name}</h2>
            <div className="mt-2.5 flex items-center gap-3">
              <Rating value={product.rating} count={product.reviews} showValue />
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl">{taka(unitPrice)}</span>
            {product.compareAt > product.price && (
              <span className="text-ink/35 line-through">{taka(product.compareAt)}</span>
            )}
          </div>

          <p className="text-[0.9375rem] leading-relaxed text-ink/65 text-balance-pretty">
            {product.short}
          </p>

          <ColorPicker colors={product.colors} value={color} onChange={setColor} />
          <SizePicker sizes={product.sizes} value={size} onChange={setSize} basePrice={product.price} />

          <div className="flex items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} max={product.stock} />
            <p className="text-[0.8125rem] text-ink/50">
              {product.stock > 15 ? 'In stock' : `Only ${product.stock} left`}
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-2.5 pt-2">
            <div className="flex gap-2.5">
              <Button variant="outline" size="lg" className="flex-1" onClick={add}>
                <Icon name="bag" size={17} /> Add to bag
              </Button>
              <Button size="lg" className="flex-1" onClick={buyNow}>
                Buy now
              </Button>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate(`/product/${product.slug}`)
              }}
              className="link-underline mx-auto text-[0.8125rem] text-ink/55 hover:text-ink"
            >
              View full details
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
