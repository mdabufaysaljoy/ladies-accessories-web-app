import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { useStore } from '@/context/StoreContext'
import { cx } from '@/utils/format'

const KINDS = {
  success: { icon: 'checkCircle', className: 'text-moss' },
  error: { icon: 'alert', className: 'text-red-600' },
  info: { icon: 'info', className: 'text-ink/50' },
}

export function Toaster() {
  const { toasts, dismissToast } = useStore()

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-auto sm:left-auto sm:right-0 sm:top-24 sm:items-end sm:p-6"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const kind = KINDS[t.kind] ?? KINDS.info
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-[scale-in_0.35s_cubic-bezier(0.16,1,0.3,1)_both] items-center gap-3 rounded-2xl border border-ink/8 bg-cream px-4 py-3.5 shadow-lift"
          >
            <Icon name={kind.icon} size={19} className={cx('shrink-0', kind.className)} />
            <p className="min-w-0 flex-1 text-[0.875rem] leading-snug">{t.message}</p>
            {t.slug && (
              <Link
                to={`/product/${t.slug}`}
                onClick={() => dismissToast(t.id)}
                className="shrink-0 text-[0.75rem] font-medium text-plum underline underline-offset-2"
              >
                View
              </Link>
            )}
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/35 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
