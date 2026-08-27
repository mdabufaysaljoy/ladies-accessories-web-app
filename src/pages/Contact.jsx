import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Accordion } from '@/components/ui/Accordion'
import { Section, SectionHeader } from '@/components/ui/Section'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useSettings, useWhatsAppLink } from '@/context/SettingsContext'
import { FAQS as FALLBACK_FAQS } from '@/data/content'
import { useStore } from '@/context/StoreContext'
import { cx, isValidBdPhone, isValidEmail, sanitisePhoneInput } from '@/utils/format'

const TOPICS = [
  'Order status',
  'Return or exchange',
  'Product advice',
  'Wholesale enquiry',
  'Something else',
]

const buildChannels = (contact, waLink) => [
  {
    icon: 'whatsapp',
    title: 'WhatsApp',
    body: 'Fastest — usually answered within an hour during business hours.',
    action: 'Start a chat',
    href: waLink,
  },
  {
    icon: 'phone',
    title: 'Call us',
    body: contact.hours,
    action: contact.phone,
    href: `tel:${String(contact.phone).replace(/\s/g, '')}`,
  },
  {
    icon: 'mail',
    title: 'Email',
    body: 'For wholesale, press and partnership enquiries.',
    action: contact.email,
    href: `mailto:${contact.email}`,
  },
]

export default function Contact() {
  const { toast } = useStore()
  const { contact, faqs } = useSettings()
  const waLink = useWhatsAppLink()
  const CHANNELS = buildChannels(contact, waLink)
  const faqItems = (faqs.length ? faqs : FALLBACK_FAQS).map((f) => ({ q: f.q, a: f.a }))
  const [form, setForm] = useState({ name: '', phone: '', email: '', topic: TOPICS[0], message: '' })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)

  usePageMeta('Contact us', 'Questions about an order, a return or which product suits you? Talk to us.')

  /**
   * Phone boxes only ever hold what a phone number can contain. Stripping as
   * the shopper types means a field can never be submitted full of letters —
   * `isValidBdPhone` still checks the shape on submit.
   */
  const set = (key) => (e) => {
    const value = /phone/i.test(key) ? sanitisePhoneInput(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Please tell us your name'
    if (!isValidBdPhone(form.phone)) next.phone = 'Enter a valid mobile number (01XXXXXXXXX)'
    if (form.email && !isValidEmail(form.email)) next.email = 'That email does not look right'
    if (form.message.trim().length < 10) next.message = 'A little more detail helps us help you'

    setErrors(next)
    if (Object.keys(next).length) {
      toast('Please check the highlighted fields', { kind: 'error' })
      return
    }

    // A real deployment posts this to your CRM or inbox endpoint.
    setSent(true)
    toast('Message sent — we will reply within one business day', { kind: 'success' })
  }

  const inputClass = (error) =>
    cx(
      'h-12 w-full rounded-xl border bg-cream px-4 text-[0.9375rem] outline-none transition-colors placeholder:text-ink/30',
      error ? 'border-red-400' : 'border-ink/15 focus:border-ink',
    )

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Contact' }]}
        eyebrow="We are here"
        title="Talk to us"
        lead="Questions about an order, a return, or which fabric suits your routine? A real person on our team will answer."
      />

      <div className="container-x py-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
          {/* form */}
          <div>
            {sent ? (
              <div className="rounded-[1.5rem] bg-moss/10 p-10 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-moss text-white">
                  <Icon name="check" size={30} strokeWidth={2.5} />
                </span>
                <h2 className="mt-6 font-display text-2xl">Message received</h2>
                <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-ink/65">
                  Thank you, {form.name.split(' ')[0]}. We reply to everything within one business day —
                  usually much sooner. For anything urgent, WhatsApp is faster.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="whatsapp" size={16} /> Chat on WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => setSent(false)}>
                    Send another message
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[0.8125rem] font-medium text-ink/70">
                    Your name <span className="text-rose">*</span>
                  </span>
                  <input
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Nusrat Jahan"
                    className={cx('mt-1.5', inputClass(errors.name))}
                  />
                  {errors.name && (
                    <span className="mt-1.5 block text-[0.75rem] text-red-600">{errors.name}</span>
                  )}
                </label>

                <label className="block">
                  <span className="text-[0.8125rem] font-medium text-ink/70">
                    Mobile number <span className="text-rose">*</span>
                  </span>
                  <input
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="01XXXXXXXXX"
                    inputMode="tel"
                    className={cx('mt-1.5', inputClass(errors.phone))}
                  />
                  {errors.phone && (
                    <span className="mt-1.5 block text-[0.75rem] text-red-600">{errors.phone}</span>
                  )}
                </label>

                <label className="block">
                  <span className="text-[0.8125rem] font-medium text-ink/70">Email (optional)</span>
                  <input
                    value={form.email}
                    onChange={set('email')}
                    type="email"
                    placeholder="you@email.com"
                    className={cx('mt-1.5', inputClass(errors.email))}
                  />
                  {errors.email && (
                    <span className="mt-1.5 block text-[0.75rem] text-red-600">{errors.email}</span>
                  )}
                </label>

                <label className="block">
                  <span className="text-[0.8125rem] font-medium text-ink/70">What is it about?</span>
                  <select
                    value={form.topic}
                    onChange={set('topic')}
                    className={cx('mt-1.5 cursor-pointer', inputClass(false))}
                  >
                    {TOPICS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-[0.8125rem] font-medium text-ink/70">
                    Your message <span className="text-rose">*</span>
                  </span>
                  <textarea
                    value={form.message}
                    onChange={set('message')}
                    rows={6}
                    placeholder="Include your order number if you have one…"
                    className={cx('mt-1.5 h-auto resize-none py-3.5', inputClass(errors.message))}
                  />
                  {errors.message && (
                    <span className="mt-1.5 block text-[0.75rem] text-red-600">{errors.message}</span>
                  )}
                </label>

                <div className="sm:col-span-2">
                  <Button type="submit" size="lg">
                    Send message <Icon name="arrowRight" size={17} />
                  </Button>
                  <p className="mt-3 text-[0.75rem] text-ink/45">
                    We use your details only to reply to this enquiry. See our{' '}
                    <Link to="/policy/privacy" className="underline underline-offset-2">
                      privacy policy
                    </Link>
                    .
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* channels */}
          <aside className="space-y-4">
            {CHANNELS.map((c) => (
              <a
                key={c.title}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="group block rounded-2xl border border-ink/12 p-6 transition-all duration-300 hover:border-ink hover:shadow-soft"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-blush text-plum transition-colors group-hover:bg-ink group-hover:text-cream">
                  <Icon name={c.icon} size={20} />
                </span>
                <h2 className="mt-4 text-[1.125rem] tracking-tight font-display">{c.title}</h2>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink/55">{c.body}</p>
                <p className="mt-3 flex items-center gap-1.5 text-[0.875rem] font-medium text-plum">
                  {c.action}
                  <Icon
                    name="arrowRight"
                    size={15}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </p>
              </a>
            ))}

            <div className="rounded-2xl bg-sand p-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-cream text-plum">
                <Icon name="pin" size={20} />
              </span>
              <h2 className="mt-4 text-[1.125rem] tracking-tight font-display">Studio</h2>
              <address className="mt-1.5 text-[0.8125rem] not-italic leading-relaxed text-ink/60">
                {contact.address}
              </address>
              <p className="mt-3 text-[0.75rem] text-ink/45">
                Pickup by appointment only — message us first.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Section className="bg-sand/50">
        <div className="container-x">
          <SectionHeader
            eyebrow="Before you write"
            title="These come up most often"
            action="See all FAQs"
            actionTo="/faq"
          />
          <div className="mt-10 max-w-3xl">
            <Accordion items={faqItems.slice(0, 4)} defaultOpen={0} />
          </div>
        </div>
      </Section>
    </>
  )
}
