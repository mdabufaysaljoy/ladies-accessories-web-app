import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { useSettings, useWhatsAppLink } from '@/context/SettingsContext'
import { cx } from '@/utils/format'

/** Resets scroll on every route change. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

/** Sets <title> and the meta description per page. */
export function usePageMeta(title, description) {
  const { brand } = useSettings()
  useEffect(() => {
    document.title = title ? `${title} — ${brand.name}` : `${brand.name} — ${brand.tagline}`
    if (description) {
      const tag = document.querySelector('meta[name="description"]')
      if (tag) tag.setAttribute('content', description)
    }
  }, [title, description, brand.name, brand.tagline])
}

/** Standard page banner: breadcrumb + title + optional lead paragraph. */
export function PageHeader({ crumbs = [], eyebrow, title, lead, children, tone = 'blush' }) {
  const tones = {
    blush: 'bg-blush',
    sand: 'bg-sand',
    plain: 'bg-cream border-b border-ink/8',
  }
  return (
    <header className={cx('pb-12 pt-8 md:pb-16 md:pt-10', tones[tone])}>
      <div className="container-x">
        {crumbs.length > 0 && <Breadcrumb items={crumbs} />}
        <div className="mt-6 max-w-3xl">
          {eyebrow && <p className="eyebrow text-plum/70">{eyebrow}</p>}
          <h1 className="mt-3 text-[2.25rem] leading-[1.05] tracking-tight md:text-[3.25rem]">{title}</h1>
          {lead && (
            <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink/60 text-balance-pretty">
              {lead}
            </p>
          )}
        </div>
        {children}
      </div>
    </header>
  )
}

export function EmptyState({ icon = 'bag', title, body, action, actionTo, onAction, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-sand">
        <Icon name={icon} size={30} className="text-ink/30" />
      </div>
      <h2 className="mt-6 font-display text-2xl">{title}</h2>
      {body && <p className="mt-2.5 max-w-sm text-[0.9375rem] text-ink/55 text-balance-pretty">{body}</p>}
      {action && (
        <Button to={actionTo} onClick={onAction} className="mt-7">
          {action}
        </Button>
      )}
      {children}
    </div>
  )
}

/** Floating WhatsApp button — number, greeting and visibility come from settings. */
export function WhatsAppFab() {
  const { storefront } = useSettings()
  const href = useWhatsAppLink()

  if (storefront.showWhatsAppFab === false) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-5 right-5 z-30 flex items-center gap-2.5 rounded-full bg-[#25D366] py-3.5 pl-3.5 pr-4 text-white shadow-lift transition-all duration-400 hover:-translate-y-0.5 hover:shadow-pop md:bottom-7 md:right-7"
    >
      <Icon name="whatsapp" size={22} />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-[0.875rem] font-medium transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:max-w-[9rem]">
        Chat with us
      </span>
    </a>
  )
}
