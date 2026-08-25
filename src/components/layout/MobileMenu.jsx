import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Drawer } from '@/components/ui/Overlay'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { useNavItems } from '@/hooks/useNavigation'
import { useSettings, useWhatsAppLink } from '@/context/SettingsContext'
import { cx } from '@/utils/format'

const SECONDARY = [
  { label: 'All products', to: '/shop' },
  { label: 'Offers & sale', to: '/shop?filter=sale' },
  { label: 'Wishlist', to: '/wishlist' },
  { label: 'Track my order', to: '/track-order' },
  { label: 'About Sadia', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'FAQ', to: '/faq' },
]

export function MobileMenu({ open, onClose }) {
  const navItems = useNavItems()
  const waLink = useWhatsAppLink()
  const { contact } = useSettings()
  const [expanded, setExpanded] = useState(null)

  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="left" width="max-w-[21rem]">
      <nav className="px-5 py-4">
        <ul className="divide-y divide-ink/8">
          {navItems.map((cat) => {
            const isOpen = expanded === cat.key
            return (
              <li key={cat.key} className="py-1">
                <div className="flex items-center">
                  <Link
                    to={cat.to}
                    onClick={onClose}
                    className="flex-1 py-3 font-display text-lg tracking-tight"
                  >
                    {cat.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : cat.key)}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${cat.label}`}
                    aria-expanded={isOpen}
                    className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]"
                  >
                    <Icon
                      name="chevronDown"
                      size={17}
                      className={cx('transition-transform duration-300', isOpen && 'rotate-180')}
                    />
                  </button>
                </div>
                <div
                  className={cx(
                    'grid transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <ul className="overflow-hidden">
                    {cat.subcategories.map((sub) => (
                      <li key={sub.label}>
                        <Link
                          to={sub.to}
                          onClick={onClose}
                          className="block py-2 pl-3 text-[0.875rem] text-ink/60"
                        >
                          {sub.label}
                        </Link>
                      </li>
                    ))}
                    <li className="pb-3">
                      <Link
                        to={cat.to}
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 py-2 pl-3 text-[0.8125rem] font-medium text-plum"
                      >
                        Shop all {cat.label} <Icon name="arrowRight" size={14} />
                      </Link>
                    </li>
                  </ul>
                </div>
              </li>
            )
          })}
        </ul>

        <ul className="mt-6 space-y-1 border-t border-ink/8 pt-5">
          {SECONDARY.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onClose}
                className="flex items-center justify-between rounded-xl px-2 py-2.5 text-[0.9375rem] text-ink/70 transition-colors hover:bg-sand hover:text-ink"
              >
                {item.label}
                <Icon name="chevronRight" size={15} className="text-ink/25" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-7 rounded-2xl bg-sand p-5">
          <p className="eyebrow text-ink/45">Need help choosing?</p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-ink/65">
            Message us and we will recommend the right fabric or formula for you.
          </p>
          <Button
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            className="mt-4"
            full
          >
            <Icon name="whatsapp" size={16} /> Chat on WhatsApp
          </Button>
          <a
            href={`tel:${String(contact.phone).replace(/\s/g, '')}`}
            className="mt-3 flex items-center justify-center gap-2 text-[0.8125rem] text-ink/60"
          >
            <Icon name="phone" size={14} /> {contact.phone}
          </a>
        </div>
      </nav>
    </Drawer>
  )
}
