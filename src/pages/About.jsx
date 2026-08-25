import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Section, SectionHeader } from '@/components/ui/Section'
import { ProductArt } from '@/components/product/ProductArt'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { getProduct } from '@/data/products'
import { useCategories } from '@/hooks/useCategories'
import { useReveal } from '@/hooks/useReveal'

const MILESTONES = [
  {
    year: '2021',
    title: 'A bedroom and thirty hijabs',
    body: 'Sadia bought thirty georgette hijabs with her savings, photographed them on her balcony, and sold out in nine days through an Instagram DM inbox she answered herself.',
  },
  {
    year: '2022',
    title: 'Our own workshop',
    body: 'We stopped reselling. A four-person cutting and hemming workshop in Narayanganj now makes every hijab we sell, which is why the hems do not fray.',
  },
  {
    year: '2023',
    title: 'Skincare, done properly',
    body: 'We added skincare only after eighteen months of testing formulas in Dhaka humidity. Everything is sourced from authorised distributors with verifiable batch codes.',
  },
  {
    year: '2024',
    title: 'Nationwide delivery',
    body: 'Cash on delivery reached all 64 districts. Around 40% of our orders now come from outside Dhaka.',
  },
  {
    year: '2026',
    title: '12,000 orders later',
    body: 'A team of eleven, a 4.9 average rating, and the same rule we started with: if it does not survive Sadia’s own week, it does not get listed.',
  },
]

const VALUES = [
  {
    icon: 'shield',
    title: 'Authentic or free',
    body: 'If anything you receive from us turns out not to be authentic, we refund you in full and you keep the product. We have never had to.',
  },
  {
    icon: 'cash',
    title: 'No fake discounts',
    body: 'We do not invent an inflated "original" price to make a sale look bigger. When something is reduced, it is genuinely reduced.',
  },
  {
    icon: 'leaf',
    title: 'Tested where you live',
    body: 'Every formula is trialled through a Dhaka summer before it goes on the site. A cream that works in a dry winter is not good enough.',
  },
  {
    icon: 'phone',
    title: 'A real person replies',
    body: 'Our WhatsApp is answered by our own team between 10 and 8, not a bot. Ask us what suits your skin and you will get an honest answer.',
  },
]

export default function About() {
  const categories = useCategories()
  const ref = useReveal({ stagger: 90 })
  usePageMeta(
    'About us',
    'How Goods by Sadia grew from thirty hijabs on a balcony to 12,000 orders across Bangladesh.',
  )

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'About' }]}
        eyebrow="Our story"
        title="We started because nothing on the market was good enough."
        lead="Goods by Sadia is a small Dhaka studio selling hijabs, skincare, hair care and colour we would happily use ourselves — and nothing else."
      />

      {/* intro */}
      <Section>
        <div className="container-x">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative">
              <div className="aspect-[5/6] overflow-hidden rounded-[1.75rem] shadow-lift">
                <ProductArt product={getProduct('signature-georgette-hijab')} />
              </div>
              <div className="absolute -bottom-7 -right-3 w-56 rounded-2xl bg-cream p-6 shadow-lift md:right-8">
                <p className="font-display text-[2.5rem] leading-none">11</p>
                <p className="mt-2 text-[0.8125rem] leading-snug text-ink/60">
                  People on the team — nine of them women.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-[2rem] leading-[1.1] md:text-[2.5rem]">
                One rule, since the first order.
              </h2>
              <div className="mt-6 space-y-4 text-[1.0625rem] leading-relaxed text-ink/70 text-balance-pretty">
                <p>
                  In 2021 Sadia bought a hijab online that arrived a completely different colour from the
                  photograph, slipped off her head all day, and faded after two washes. She had bought
                  five like it that year.
                </p>
                <p>
                  So she ordered thirty hijabs from a mill in Narayanganj, washed each one four times,
                  wore them for a week, and kept only the fabric that survived. That batch sold out in
                  nine days.
                </p>
                <p>
                  Five years and twelve thousand orders later the process has not changed. Every product
                  on this site has been through the same week. If it fails, it does not get listed —
                  regardless of the margin.
                </p>
              </div>
              <Button to="/shop" size="lg" className="mt-8">
                Shop the collection <Icon name="arrowRight" size={17} />
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* values */}
      <Section className="bg-sand/50">
        <div className="container-x">
          <SectionHeader
            eyebrow="What we promise"
            title="Four things we will not compromise on"
            align="center"
          />
          <div ref={ref} className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.title} className="reveal rounded-[1.25rem] bg-cream p-7">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-blush text-plum">
                  <Icon name={v.icon} size={22} />
                </span>
                <h3 className="mt-5 text-[1.25rem] tracking-tight">{v.title}</h3>
                <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink/60 text-balance-pretty">
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* timeline */}
      <Section>
        <div className="container-x">
          <SectionHeader eyebrow="The road here" title="Five years, one standard" />

          <ol className="mt-14 border-l border-ink/12 pl-8 md:pl-12">
            {MILESTONES.map((m) => (
              <li key={m.year} className="relative pb-12 last:pb-0">
                <span className="absolute -left-[2.4rem] top-1.5 grid h-5 w-5 place-items-center rounded-full bg-cream md:-left-[3.4rem]">
                  <span className="h-2.5 w-2.5 rounded-full bg-plum" />
                </span>
                <p className="font-display text-[1.75rem] leading-none text-plum">{m.year}</p>
                <h3 className="mt-3 text-[1.375rem] tracking-tight">{m.title}</h3>
                <p className="mt-2.5 max-w-2xl text-[0.9375rem] leading-relaxed text-ink/65 text-balance-pretty">
                  {m.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* categories cta */}
      <Section className="bg-ink text-cream">
        <div className="container-x text-center">
          <p className="eyebrow text-gold-soft">Where to start</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-[2rem] leading-[1.1] md:text-[2.75rem]">
            Five edits, each one held to the same test.
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-2.5">
            {categories.map((c) => (
              <Button key={c.slug} to={`/shop/${c.slug}`} variant="light" size="md">
                {c.name}
              </Button>
            ))}
          </div>
        </div>
      </Section>
    </>
  )
}
