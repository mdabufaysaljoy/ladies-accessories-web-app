import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { cx } from '@/utils/format'

/** `items` = [{ label, to? }] — the last entry renders as the current page. */
export function Breadcrumb({ items, className = '' }) {
  return (
    <nav aria-label="Breadcrumb" className={cx('flex flex-wrap items-center gap-1.5 text-[0.8125rem]', className)}>
      <Link to="/" className="text-ink/45 transition-colors hover:text-plum">
        Home
      </Link>
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <Fragment key={`${item.label}-${i}`}>
            <Icon name="chevronRight" size={13} className="text-ink/25" />
            {last || !item.to ? (
              <span className="text-ink/80" aria-current={last ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link to={item.to} className="text-ink/45 transition-colors hover:text-plum">
                {item.label}
              </Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
