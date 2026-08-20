import { useState } from 'react'
import { Icon } from './Icon'
import { cx } from '@/utils/format'

/** `items` = [{ q, a }] or [{ title, content }]. Set `single` for exclusive open. */
export function Accordion({ items, defaultOpen = null, single = true, className = '' }) {
  const [open, setOpen] = useState(defaultOpen == null ? [] : [defaultOpen])

  const toggle = (i) =>
    setOpen((current) => {
      const isOpen = current.includes(i)
      if (single) return isOpen ? [] : [i]
      return isOpen ? current.filter((x) => x !== i) : [...current, i]
    })

  return (
    <div className={cx('divide-y divide-ink/10 border-y border-ink/10', className)}>
      {items.map((item, i) => {
        const isOpen = open.includes(i)
        const heading = item.q ?? item.title
        const body = item.a ?? item.content
        return (
          <div key={heading}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-6 py-5 text-left transition-colors hover:text-plum"
            >
              <span className="text-[1.0625rem] leading-snug tracking-tight text-balance-pretty">
                {heading}
              </span>
              <span
                className={cx(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-400',
                  isOpen ? 'rotate-180 border-ink bg-ink text-cream' : 'border-ink/15',
                )}
              >
                <Icon name="chevronDown" size={16} />
              </span>
            </button>
            <div
              className={cx(
                'grid transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="pb-6 pr-12 text-[0.9375rem] leading-relaxed text-ink/65 text-balance-pretty">
                  {body}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
