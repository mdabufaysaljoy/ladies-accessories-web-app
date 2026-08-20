import { Icon } from '@/components/ui/Icon'
import { cx, taka } from '@/utils/format'

export function ColorPicker({ colors, value, onChange, label = 'Colour' }) {
  if (!colors?.length) return null
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-ink/45">{label}</p>
        <p className="text-[0.8125rem] font-medium">{value || 'Select one'}</p>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        {colors.map((c) => {
          const active = value === c.name
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onChange(c.name)}
              title={c.name}
              aria-label={c.name}
              aria-pressed={active}
              className={cx(
                'relative grid h-9 w-9 place-items-center rounded-full transition-all duration-300',
                'ring-1 ring-inset ring-ink/12 hover:scale-110',
                active && 'ring-2 ring-offset-2 ring-offset-cream ring-ink',
              )}
              style={{ backgroundColor: c.hex }}
            >
              {active && (
                <Icon
                  name="check"
                  size={15}
                  strokeWidth={2.4}
                  className="text-white mix-blend-difference"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SizePicker({ sizes, value, onChange, basePrice, label = 'Size' }) {
  if (!sizes?.length) return null
  return (
    <div>
      <p className="eyebrow text-ink/45">{label}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {sizes.map((s) => {
          const active = value === s.label
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => onChange(s.label)}
              aria-pressed={active}
              className={cx(
                'rounded-full border px-4 py-2 text-[0.8125rem] transition-all duration-300',
                active
                  ? 'border-ink bg-ink text-cream'
                  : 'border-ink/15 text-ink hover:border-ink/45',
              )}
            >
              {s.label}
              {s.priceDelta > 0 && (
                <span className={cx('ml-1.5', active ? 'text-cream/60' : 'text-ink/40')}>
                  {taka(basePrice + s.priceDelta)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function QtyStepper({ value, onChange, max = 99, min = 1, size = 'md' }) {
  const dims = size === 'sm' ? 'h-9 w-[6.5rem] text-sm' : 'h-12 w-32 text-[0.9375rem]'
  return (
    <div
      className={cx(
        'flex items-center justify-between rounded-full border border-ink/15 px-1',
        dims,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="grid aspect-square h-[80%] place-items-center rounded-full transition-colors hover:bg-ink/[0.07] disabled:opacity-30"
      >
        <Icon name="minus" size={15} />
      </button>
      <span className="min-w-6 text-center font-medium tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="grid aspect-square h-[80%] place-items-center rounded-full transition-colors hover:bg-ink/[0.07] disabled:opacity-30"
      >
        <Icon name="plus" size={15} />
      </button>
    </div>
  )
}
