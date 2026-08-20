import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { useCategories } from '@/hooks/useCategories'
import { useSettings } from '@/context/SettingsContext'
import { SSL_CHANNELS } from '@/services/payment'
import { useStore } from '@/context/StoreContext'
import { api } from '@/lib/api'
import { isValidEmail } from '@/utils/format'

const HELP_LINKS = [
  { label: 'Track my order', to: '/track-order' },
  { label: 'Delivery & shipping', to: '/policy/shipping' },
  { label: 'Returns & exchange', to: '/policy/returns' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact us', to: '/contact' },
]

const COMPANY_LINKS = [
  { label: 'About Sadia', to: '/about' },
  { label: 'All products', to: '/shop' },
  { label: 'Offers & sale', to: '/shop?filter=sale' },
  { label: 'Privacy policy', to: '/policy/privacy' },
  { label: 'Terms of service', to: '/policy/terms' },
]

const SOCIAL_ICONS = {
  Facebook: 'facebook',
  Instagram: 'instagram',
  TikTok: 'tiktok',
  YouTube: 'youtube',
}

function Newsletter() {
  const { toast } = useStore()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!isValidEmail(email)) {
      toast('Please enter a valid email address', { kind: 'error' })
      return
    }
    try {
      await api.post('/campaigns/subscribe', { email, source: 'footer' })
      setDone(true)
      toast('You are on the list — welcome!', { kind: 'success' })
    } catch (error) {
      toast(error.message ?? 'Could not subscribe — please try again', { kind: 'error' })
    }
  }

  return (
    <div className="rounded-[1.75rem] bg-plum p-8 text-cream md:p-11">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="eyebrow text-gold-soft">The Sadia letter</p>
          <h2 className="mt-3 text-[2rem] leading-[1.1] md:text-[2.5rem]">
            Ten percent off your first order.
          </h2>
          <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-cream/70 text-balance-pretty">
            New drops, restock alerts and honest routine advice — one email a week, never more.
          </p>
        </div>

        {done ? (
          <div className="flex items-center gap-3 rounded-2xl bg-cream/10 px-5 py-6">
            <Icon name="checkCircle" size={26} className="shrink-0 text-gold-soft" />
            <p className="text-[0.9375rem] leading-snug">
              Check your inbox — your <strong className="font-semibold">SADIA10</strong> code is on the
              way.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email address"
                className="h-[3.25rem] flex-1 rounded-full border border-cream/20 bg-cream/[0.07] px-5 text-[0.9375rem] text-cream outline-none transition-colors placeholder:text-cream/40 focus:border-gold-soft"
              />
              <Button type="submit" variant="gold" size="lg">
                Subscribe
              </Button>
            </div>
            <p className="text-[0.6875rem] text-cream/45">
              By subscribing you agree to our{' '}
              <Link to="/policy/privacy" className="underline underline-offset-2">
                privacy policy
              </Link>
              . Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export function Footer() {
  const { brand, contact, socials, tf } = useSettings()
  const categories = useCategories()

  return (
    <footer className="mt-24 bg-cream">
      <div className="container-x">
        <Newsletter />
      </div>

      <div className="container-x pb-10 pt-16">
        <div className="grid gap-11 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[0.875rem] leading-relaxed text-ink/60 text-balance-pretty">
              A small Dhaka studio curating hijabs, skincare and colour we would happily use ourselves.
              Every order is packed by hand.
            </p>

            <ul className="mt-6 space-y-2.5 text-[0.875rem] text-ink/65">
              <li className="flex items-start gap-2.5">
                <Icon name="pin" size={16} className="mt-0.5 shrink-0 text-ink/35" />
                {tf(contact, 'address')}
              </li>
              <li>
                <a
                  href={`tel:${String(contact.phone).replace(/\s/g, '')}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-plum"
                >
                  <Icon name="phone" size={16} className="shrink-0 text-ink/35" />
                  {contact.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-plum"
                >
                  <Icon name="mail" size={16} className="shrink-0 text-ink/35" />
                  {contact.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="clock" size={16} className="shrink-0 text-ink/35" />
                {contact.hours}
              </li>
            </ul>

            <div className="mt-6 flex gap-2">
              {socials.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="grid h-10 w-10 place-items-center rounded-full border border-ink/12 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-cream"
                >
                  <Icon name={s.icon ?? SOCIAL_ICONS[s.name] ?? 'facebook'} size={17} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="eyebrow text-ink/40">Shop</h3>
            <ul className="mt-4 space-y-2.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/shop/${c.slug}`}
                    className="text-[0.875rem] text-ink/65 transition-colors hover:text-plum"
                  >
                    {tf(c, 'name')}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow text-ink/40">Help</h3>
            <ul className="mt-4 space-y-2.5">
              {HELP_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-[0.875rem] text-ink/65 transition-colors hover:text-plum"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow text-ink/40">Company</h3>
            <ul className="mt-4 space-y-2.5">
              {COMPANY_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-[0.875rem] text-ink/65 transition-colors hover:text-plum"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h3 className="eyebrow mt-8 text-ink/40">We accept</h3>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {SSL_CHANNELS.slice(0, 6).map((ch) => (
                <span
                  key={ch.id}
                  title={ch.name}
                  className="rounded-md border border-ink/10 bg-white px-2 py-1.5 text-[0.625rem] font-bold tracking-tight"
                  style={{ color: ch.color }}
                >
                  {ch.name}
                </span>
              ))}
              <span className="rounded-md border border-ink/10 bg-white px-2 py-1.5 text-[0.625rem] font-bold tracking-tight text-ink">
                Cash on Delivery
              </span>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[0.6875rem] text-ink/45">
              <Icon name="lock" size={12} /> Payments secured by SSLCommerz
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-ink/10 pt-7 text-[0.75rem] text-ink/45 sm:flex-row">
          <p>© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Made in {brand.locationLabel} <span className="text-rose">♥</span>{' '}
            {contact.tradeLicence && `Trade Licence: ${contact.tradeLicence}`}
            {contact.binNumber && ` · BIN: ${contact.binNumber}`}
          </p>
        </div>
      </div>
    </footer>
  )
}
