import { Link } from 'react-router-dom'
import { cx } from '@/utils/format'

const VARIANTS = {
  primary:
    'bg-ink text-cream hover:bg-plum active:bg-plum-deep shadow-soft hover:shadow-lift disabled:hover:bg-ink',
  gold: 'bg-gold text-ink hover:bg-gold/90 shadow-soft hover:shadow-lift',
  outline: 'border border-ink/20 text-ink hover:border-ink hover:bg-ink hover:text-cream',
  ghost: 'text-ink hover:bg-ink/[0.06]',
  light: 'bg-cream text-ink hover:bg-white shadow-soft',
  rose: 'bg-rose text-white hover:bg-rose/90 shadow-soft hover:shadow-lift',
  danger: 'text-red-700 hover:bg-red-50',
}

const SIZES = {
  sm: 'h-9 px-4 text-[0.8125rem] gap-1.5',
  md: 'h-11 px-6 text-sm gap-2',
  lg: 'h-[3.25rem] px-8 text-[0.9375rem] gap-2.5',
  icon: 'h-10 w-10',
}

export function Button({
  as,
  to,
  href,
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}) {
  const classes = cx(
    'inline-flex items-center justify-center rounded-full font-medium tracking-tight',
    'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
    'disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.985] whitespace-nowrap',
    VARIANTS[variant],
    SIZES[size],
    full && 'w-full',
    className,
  )

  const content = (
    <>
      {loading && (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current"
          aria-hidden="true"
        />
      )}
      {children}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    )
  }

  const Tag = as || 'button'
  return (
    <Tag className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </Tag>
  )
}

export function IconButton({ label, className = '', variant = 'ghost', children, ...rest }) {
  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      className={cx('rounded-full', className)}
      {...rest}
    >
      {children}
    </Button>
  )
}
