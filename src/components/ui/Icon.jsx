/**
 * One inline SVG sprite as a component. Every icon inherits `currentColor` and
 * a 1.5 stroke so the whole UI stays optically consistent.
 */
const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  bag: (
    <>
      <path d="M4 8h16l-1.2 12.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
      <path d="M8.5 11V6.5a3.5 3.5 0 1 1 7 0V11" />
    </>
  ),
  heart: (
    <path d="M12 20.5s-7.5-4.6-7.5-9.8A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.5 2.5c0 5.2-7.5 9.8-7.5 9.8z" />
  ),
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  menu: <><path d="M3.5 7h17" /><path d="M3.5 12h17" /><path d="M3.5 17h11" /></>,
  close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronUp: <path d="m6 14.5 6-6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  arrowRight: <><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></>,
  arrowUpRight: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6.5 7 7.6 20a1.5 1.5 0 0 0 1.5 1.4h5.8a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 6.5h11v10h-11z" />
      <path d="M13.5 10h4l3 3v3.5h-7z" />
      <circle cx="7" cy="18.5" r="2" />
      <circle cx="17" cy="18.5" r="2" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 4.5-3.2 7.9-8 9.3-4.8-1.4-8-4.8-8-9.3V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.4 2.7 2.7L16 9.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.8v.4" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.2v.4" /></>,
  filter: <><path d="M4 6.5h16" /><path d="M7 12h10" /><path d="M10 17.5h4" /></>,
  sparkle: (
    <path d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9z" />
  ),
  eye: <><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  phone: (
    <path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />
  ),
  mail: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  pin: <><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8.5" width="18" height="4" rx="1" />
      <path d="M4.5 12.5v7a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-7" />
      <path d="M12 8.5V21" />
      <path d="M12 8.5S10.5 3 8 3a2.5 2.5 0 0 0 0 5.5zM12 8.5S13.5 3 16 3a2.5 2.5 0 0 1 0 5.5z" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C10 4 4 8.5 4 15a5 5 0 0 0 5 5c6.5 0 11-6 11-16z" />
      <path d="M4.5 20.5 12 13" />
    </>
  ),
  whatsapp: (
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m5.8 14.13c-.25.69-1.45 1.32-2 1.4-.51.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.68-.62-2.96-1.28-4.9-4.26-5.04-4.46-.15-.2-1.21-1.6-1.21-3.06s.77-2.17 1.04-2.47c.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.25.6.85 2.06.92 2.21.08.15.13.32.03.52-.1.2-.15.32-.3.5l-.44.51c-.15.15-.3.31-.13.61.17.3.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.35 1.45.3.15.47.13.64-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.12.07.72-.18 1.42" />
  ),
  facebook: <path d="M14.5 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.6 1.6-1.6h1.6V3.2A21 21 0 0 0 15.4 3c-2.4 0-4 1.4-4 4.1v2.7H8.6V13h2.8v8z" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M16.9 7.2v.2" />
    </>
  ),
  tiktok: (
    <path d="M15.5 3.5c.4 2.4 1.9 3.9 4.2 4.1v3a7.3 7.3 0 0 1-4.1-1.3v6.1a5.9 5.9 0 1 1-5.1-5.8v3.1a2.8 2.8 0 1 0 2 2.7V3.5z" />
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.5 9.5 5 2.5-5 2.5z" />
    </>
  ),
}

export function Icon({ name, size = 20, className = '', fill = false, strokeWidth = 1.5, ...rest }) {
  const path = PATHS[name]
  if (!path) return null
  const solid = ['facebook', 'tiktok', 'youtube', 'whatsapp'].includes(name) || fill

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {path}
    </svg>
  )
}

export function StarIcon({ fillPercent = 100, size = 14, className = '' }) {
  const id = `star-${Math.random().toString(36).slice(2, 9)}`
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fillPercent}%`} stopColor="currentColor" />
          <stop offset={`${fillPercent}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z"
        fill={`url(#${id})`}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
