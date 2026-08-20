import { Link } from 'react-router-dom'
import { useSettings } from '@/context/SettingsContext'
import { cx } from '@/utils/format'

export function Logo({ className = '', compact = false }) {
  const { brand, tf } = useSettings()
  const name = tf(brand, 'name')

  return (
    <Link
      to="/"
      aria-label={`${name} — home`}
      className={cx('group inline-flex items-center gap-2.5', className)}
    >
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt={name} className="h-10 w-auto shrink-0 object-contain" />
      ) : (
        <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink text-cream transition-colors duration-500 group-hover:bg-plum">
          <span className="font-display text-lg leading-none">{brand.logoMark || 'S'}</span>
          <span className="absolute -bottom-3 -right-2 h-6 w-6 rounded-full bg-gold/45 blur-[6px]" />
        </span>
      )}
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[1.0625rem] tracking-tight">{name}</span>
          <span className="mt-1 block text-[0.5625rem] font-semibold uppercase tracking-[0.28em] text-ink/40">
            {brand.locationLabel} · Est. {brand.established}
          </span>
        </span>
      )}
    </Link>
  )
}
