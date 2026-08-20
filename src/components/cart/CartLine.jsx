import { Link } from 'react-router-dom'
import { ProductArt } from '@/components/product/ProductArt'
import { QtyStepper } from '@/components/product/VariantPicker'
import { Icon } from '@/components/ui/Icon'
import { useStore } from '@/context/StoreContext'
import { cx, taka } from '@/utils/format'

export function CartLine({ line, compact = false, onNavigate }) {
  const { updateQty, removeLine } = useStore()

  return (
    <li className="flex gap-4 py-5">
      <Link
        to={`/product/${line.slug}`}
        onClick={onNavigate}
        className={cx(
          'shrink-0 overflow-hidden rounded-xl bg-sand',
          compact ? 'h-24 w-20' : 'h-32 w-26 sm:h-36 sm:w-30',
        )}
      >
        <ProductArt product={line} decorative={false} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/product/${line.slug}`}
              onClick={onNavigate}
              className="block text-[0.9375rem] leading-snug font-medium hover:text-plum"
            >
              {line.name}
            </Link>
            {(line.color || line.size) && (
              <p className="mt-1 text-[0.75rem] text-ink/50">
                {[line.color, line.size].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeLine(line.key)}
            aria-label={`Remove ${line.name}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/35 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Icon name="trash" size={16} />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <QtyStepper
            value={line.qty}
            onChange={(q) => updateQty(line.key, q)}
            max={line.stock}
            min={1}
            size="sm"
          />
          <div className="text-right">
            <p className="text-[0.9375rem] font-semibold">{taka(line.price * line.qty)}</p>
            {line.qty > 1 && (
              <p className="text-[0.6875rem] text-ink/40">{taka(line.price)} each</p>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
