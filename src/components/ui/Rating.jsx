import { StarIcon } from './Icon'
import { cx } from '@/utils/format'

export function Rating({ value = 0, count, size = 13, className = '', showValue = false }) {
  return (
    <div className={cx('flex items-center gap-1.5', className)}>
      <div className="flex text-gold" role="img" aria-label={`Rated ${value} out of 5`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <StarIcon key={i} size={size} fillPercent={Math.min(100, Math.max(0, (value - i) * 100))} />
        ))}
      </div>
      {showValue && <span className="text-xs font-semibold text-ink">{value.toFixed(1)}</span>}
      {count != null && <span className="text-xs text-ink/45">({count})</span>}
    </div>
  )
}
