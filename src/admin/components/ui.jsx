import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/utils/format'

/* --------------------------------- shell --------------------------------- */

export function AdminPage({ title, subtitle, actions, children }) {
  return (
    <div className="mx-auto w-full max-w-[100rem] px-5 py-7 md:px-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[0.875rem] text-ink/55">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

export function Card({ title, description, actions, children, className = '', padded = true }) {
  return (
    <section className={cx('rounded-2xl border border-ink/10 bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
          <div>
            {title && <h2 className="text-[0.9375rem] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[0.8125rem] text-ink/50">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

/* -------------------------------- controls -------------------------------- */

const BTN = {
  primary: 'bg-ink text-cream hover:bg-plum disabled:bg-ink/40',
  secondary: 'border border-ink/15 bg-white text-ink hover:border-ink hover:bg-sand',
  ghost: 'text-ink/60 hover:bg-ink/[0.06] hover:text-ink',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-moss text-white hover:bg-moss/85',
}

const SIZE = {
  xs: 'h-7 px-2.5 text-[0.75rem] gap-1',
  sm: 'h-9 px-3.5 text-[0.8125rem] gap-1.5',
  md: 'h-10 px-4 text-[0.875rem] gap-2',
  lg: 'h-12 px-6 text-[0.9375rem] gap-2',
}

export function Btn({
  variant = 'secondary', size = 'sm', loading, disabled, className = '', children, as: As = 'button', ...rest
}) {
  return (
    <As
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BTN[variant], SIZE[size], className,
      )}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current" />
      )}
      {children}
    </As>
  )
}

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[0.8125rem] font-medium text-ink/75">
            {label}
            {required && <span className="ml-0.5 text-rose">*</span>}
          </span>
          {hint && <span className="text-[0.6875rem] text-ink/40">{hint}</span>}
        </span>
      )}
      <div className={label ? 'mt-1.5' : ''}>{children}</div>
      {error && (
        <span className="mt-1.5 flex items-center gap-1 text-[0.75rem] text-red-600">
          <Icon name="alert" size={12} /> {error}
        </span>
      )}
    </label>
  )
}

const inputBase =
  'w-full rounded-lg border border-ink/15 bg-white px-3 text-[0.875rem] outline-none transition-colors placeholder:text-ink/30 focus:border-ink disabled:bg-sand disabled:text-ink/50'

export const Input = ({ className = '', ...p }) => (
  <input className={cx(inputBase, 'h-10', className)} {...p} />
)

/**
 * A number field that can actually be emptied.
 *
 * `<Input type="number" value={n} onChange={e => set(Number(e.target.value))} />`
 * traps the admin: clearing the box makes `Number('')` evaluate to 0, the
 * parent stores 0, and it re-renders as "0" before the next keystroke. To type
 * 25 you have to select the zero first, and a field you want to leave blank
 * cannot be left blank.
 *
 * The keystrokes live here instead. The parent is handed a number, or '' while
 * the box is empty, and only genuine outside changes — loading a record,
 * resetting the form — overwrite what is being typed.
 */
export function NumberInput({ value, onChange, className = '', ...rest }) {
  const toText = (v) => (v === null || v === undefined || v === '' ? '' : String(v))
  const [text, setText] = useState(() => toText(value))
  const emitted = useRef(value)

  useEffect(() => {
    // Ignore the echo of our own onChange, or an empty box would refill itself.
    if (value === emitted.current) return
    emitted.current = value
    setText(toText(value))
  }, [value])

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      className={cx(inputBase, 'h-10', className)}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const next = raw === '' ? '' : Number(raw)
        emitted.current = next
        onChange(next)
      }}
    />
  )
}

export const Textarea = ({ className = '', rows = 4, ...p }) => (
  <textarea rows={rows} className={cx(inputBase, 'resize-y py-2.5 leading-relaxed', className)} {...p} />
)

export const Select = ({ className = '', children, ...p }) => (
  <select className={cx(inputBase, 'h-10 cursor-pointer pr-8', className)} {...p}>
    {children}
  </select>
)

/**
 * Switch. The knob is pinned with an explicit `left` and moved by a fixed
 * translate — relying on an absolutely positioned element's static position
 * put it at the end of the line box, which pushed the knob clean off the track
 * whenever the switch was on.
 *
 * The whole row is one button so the label is clickable too, and so there is no
 * interactive element nested inside another.
 */
export function Toggle({ checked, onChange, label, description, disabled }) {
  const on = Boolean(checked)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        'inline-flex max-w-full items-start gap-3 text-left',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <span
        className={cx(
          'relative mt-0.5 block h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          on ? 'bg-moss' : 'bg-ink/20',
        )}
      >
        {/* track 36px − knob 16px − 2px inset each side = 16px of travel */}
        <span
          className={cx(
            'absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow-sm',
            'transition-transform duration-200 ease-out',
            on ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </span>

      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[0.875rem] font-medium leading-snug">{label}</span>}
          {description && (
            <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink/50">{description}</span>
          )}
        </span>
      )}
    </button>
  )
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span
        className={cx(
          'grid h-[1.05rem] w-[1.05rem] shrink-0 place-items-center rounded border transition-all',
          checked ? 'border-ink bg-ink text-cream' : 'border-ink/25',
        )}
      >
        {checked && <Icon name="check" size={11} strokeWidth={3} />}
      </span>
      {label && <span className="text-[0.8125rem]">{label}</span>}
    </label>
  )
}

/* --------------------------------- status --------------------------------- */

const TONES = {
  neutral: 'bg-ink/8 text-ink/70',
  success: 'bg-moss/12 text-moss',
  warning: 'bg-gold/15 text-gold',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blush text-plum',
  purple: 'bg-purple-100 text-purple-700',
  blue: 'bg-blue-100 text-blue-700',
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold tracking-tight',
        TONES[tone], className,
      )}
    >
      {children}
    </span>
  )
}

export const ORDER_TONE = {
  pending: 'warning', confirmed: 'info', packed: 'purple',
  shipped: 'blue', delivered: 'success', cancelled: 'danger', returned: 'danger',
}

export const PAYMENT_TONE = {
  unpaid: 'neutral', 'advance-paid': 'warning', paid: 'success', refunded: 'danger', failed: 'danger',
}

export function EmptyRow({ icon = 'search', title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-sand">
        <Icon name={icon} size={24} className="text-ink/30" />
      </div>
      <p className="mt-4 text-[0.9375rem] font-medium">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[0.8125rem] text-ink/50">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className = '' }) {
  return (
    <div className={cx('flex items-center justify-center py-16', className)}>
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-ink/15 border-t-plum" role="status" aria-label="Loading" />
    </div>
  )
}

/* --------------------------------- modal ---------------------------------- */

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-8">
      <div className="fixed inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative my-auto w-full animate-[scale-in_0.25s_cubic-bezier(0.16,1,0.3,1)_both] rounded-2xl bg-white shadow-pop',
          widths[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink/8 px-5 py-4">
          <div>
            <h2 className="font-display text-lg tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-[0.8125rem] text-ink/55">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink/40 hover:bg-ink/[0.06] hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-ink/8 px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', tone = 'danger' }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn
            variant={tone}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <p className="text-[0.875rem] leading-relaxed text-ink/70">{body}</p>
    </Modal>
  )
}

/* -------------------------------- feedback -------------------------------- */

export function useToasts() {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const push = (message, kind = 'success') => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  const node = createPortal(
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-[0.875rem] shadow-lift animate-[scale-in_0.25s_cubic-bezier(0.16,1,0.3,1)_both]',
            t.kind === 'error' ? 'bg-red-600 text-white' : t.kind === 'info' ? 'bg-ink text-cream' : 'bg-moss text-white',
          )}
        >
          <Icon name={t.kind === 'error' ? 'alert' : 'checkCircle'} size={17} className="shrink-0" />
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  )

  return { push, node }
}

/* --------------------------------- table ---------------------------------- */

export function Table({ head, children, className = '' }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-ink/10">
            {head.map((h, i) => (
              <th
                key={i}
                className={cx(
                  'whitespace-nowrap px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink/45',
                  h.align === 'right' && 'text-right',
                  h.align === 'center' && 'text-center',
                  h.className,
                )}
                style={h.width ? { width: h.width } : undefined}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/6">{children}</tbody>
      </table>
    </div>
  )
}

export const Td = ({ className = '', align, children, ...p }) => (
  <td
    className={cx('px-4 py-3.5 text-[0.875rem] align-middle', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}
    {...p}
  >
    {children}
  </td>
)

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink/8 px-5 py-3.5">
      <p className="text-[0.8125rem] text-ink/50">
        Page {meta.page} of {meta.pages} · {meta.total} total
      </p>
      <div className="flex gap-2">
        <Btn size="xs" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          <Icon name="chevronLeft" size={13} /> Prev
        </Btn>
        <Btn size="xs" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>
          Next <Icon name="chevronRight" size={13} />
        </Btn>
      </div>
    </div>
  )
}

/* -------------------------------- filtering ------------------------------- */

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={cx('relative', className)}>
      <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  )
}

export function Tabs({ tabs, active, onChange, counts }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-ink/10">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cx(
            'relative shrink-0 px-3.5 py-2.5 text-[0.8125rem] font-medium transition-colors',
            active === tab.id ? 'text-ink' : 'text-ink/45 hover:text-ink/75',
          )}
        >
          {tab.label}
          {counts?.[tab.id] != null && (
            <span className={cx('ml-1.5 text-[0.6875rem]', active === tab.id ? 'text-ink/45' : 'text-ink/30')}>
              {counts[tab.id]}
            </span>
          )}
          {active === tab.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
        </button>
      ))}
    </div>
  )
}
