import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { cx } from '@/utils/format'

export function SectionHeader({
  eyebrow,
  title,
  body,
  action,
  actionTo,
  align = 'between',
  className = '',
}) {
  const centered = align === 'center'
  return (
    <div
      className={cx(
        'gap-6',
        centered ? 'flex flex-col items-center text-center' : 'flex flex-wrap items-end justify-between',
        className,
      )}
    >
      <div className={cx(centered ? 'max-w-2xl' : 'max-w-xl')}>
        {eyebrow && <p className="eyebrow text-plum/70">{eyebrow}</p>}
        <h2 className="mt-3 text-[2rem] leading-[1.08] tracking-tight md:text-[2.75rem]">{title}</h2>
        {body && (
          <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-ink/60 text-balance-pretty md:text-base">
            {body}
          </p>
        )}
      </div>

      {action && actionTo && (
        <Link
          to={actionTo}
          className="group inline-flex shrink-0 items-center gap-2 text-[0.875rem] font-medium text-ink transition-colors hover:text-plum"
        >
          <span className="link-underline">{action}</span>
          <Icon
            name="arrowRight"
            size={17}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </Link>
      )}
    </div>
  )
}

export function Section({ children, className = '', id }) {
  return (
    <section id={id} className={cx('py-16 md:py-24', className)}>
      {children}
    </section>
  )
}
