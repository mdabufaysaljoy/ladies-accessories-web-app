import { useMemo, useState } from 'react'
import { Accordion } from '@/components/ui/Accordion'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useSettings, useWhatsAppLink } from '@/context/SettingsContext'
import { FAQS as FALLBACK_FAQS } from '@/data/content'

export default function Faq() {
  const [query, setQuery] = useState('')
  const { faqs } = useSettings()
  const waLink = useWhatsAppLink()
  const source = faqs.length ? faqs : FALLBACK_FAQS
  usePageMeta('FAQ', 'Delivery times, cash on delivery, SSLCommerz payment, returns and product advice.')

  const results = useMemo(() => {
    const list = source.map((f) => ({ q: f.q, a: f.a }))
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(q))
  }, [query, source])

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'FAQ' }]}
        eyebrow="Help centre"
        title="Frequently asked questions"
        lead="Delivery, payment, returns and product advice — answered plainly."
      >
        <div className="mt-8 max-w-lg">
          <div className="flex h-[3.25rem] items-center gap-3 rounded-full border border-ink/15 bg-cream px-5 transition-colors focus-within:border-ink">
            <Icon name="search" size={19} className="shrink-0 text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions…"
              aria-label="Search FAQs"
              className="h-full flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-ink/35"
            />
          </div>
        </div>
      </PageHeader>

      <div className="container-x py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          {results.length === 0 ? (
            <div className="rounded-2xl bg-sand p-10 text-center">
              <p className="font-display text-xl">No answer matches “{query}”</p>
              <p className="mt-2.5 text-[0.9375rem] text-ink/60">
                Ask us directly — we usually reply within an hour on WhatsApp.
              </p>
              <Button
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5"
              >
                <Icon name="whatsapp" size={16} /> Ask on WhatsApp
              </Button>
            </div>
          ) : (
            <Accordion items={results} defaultOpen={0} single={false} />
          )}

          <div className="mt-14 rounded-[1.5rem] bg-plum p-9 text-center text-cream">
            <h2 className="font-display text-2xl">Still not sure?</h2>
            <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-cream/70">
              Tell us your routine, your skin type or how you usually wear your hijab, and we will
              recommend exactly what to buy — including telling you when not to buy something.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                variant="gold"
                size="lg"
              >
                <Icon name="whatsapp" size={17} /> Chat with us
              </Button>
              <Button to="/contact" variant="light" size="lg">
                Send a message
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
