import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEscape, useScrollLock } from '@/hooks/useScrollLock'
import { cx } from '@/utils/format'
import { Icon } from './Icon'
import { IconButton } from './Button'

function Scrim({ open, onClose }) {
  return (
    <div
      onClick={onClose}
      className={cx(
        'fixed inset-0 z-50 bg-ink/45 backdrop-blur-[3px] transition-opacity duration-400',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden="true"
    />
  )
}

/** Slide-in panel. `side` accepts 'right' | 'left'. */
export function Drawer({ open, onClose, title, side = 'right', width = 'max-w-md', children, footer }) {
  const panelRef = useRef(null)
  useScrollLock(open)
  useEscape(open, onClose)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  return createPortal(
    <>
      <Scrim open={open} onClose={onClose} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'fixed inset-y-0 z-50 flex w-full flex-col bg-cream shadow-pop outline-none',
          'transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
          width,
          side === 'right' ? 'right-0' : 'left-0',
          open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full',
        )}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="text-lg tracking-tight">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-ink/10 bg-white/60">{footer}</div>}
      </aside>
    </>,
    document.body,
  )
}

/** Centred modal. */
export function Modal({ open, onClose, title, size = 'max-w-4xl', children }) {
  useScrollLock(open)
  useEscape(open, onClose)

  return createPortal(
    <>
      <Scrim open={open} onClose={onClose} />
      <div
        className={cx(
          'fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6',
          open ? '' : 'pointer-events-none',
        )}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cx(
            'relative w-full overflow-hidden bg-cream shadow-pop',
            'rounded-t-[1.75rem] sm:rounded-[1.75rem]',
            'max-h-[92vh] sm:max-h-[88vh] overflow-y-auto overscroll-contain',
            'transition-all duration-450 ease-[cubic-bezier(0.16,1,0.3,1)]',
            size,
            open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-[0.97] opacity-0',
          )}
        >
          <IconButton
            label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 bg-cream/85 backdrop-blur-sm"
          >
            <Icon name="close" />
          </IconButton>
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}
