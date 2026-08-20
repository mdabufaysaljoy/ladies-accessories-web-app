import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useSettings, useWhatsAppLink } from '@/context/SettingsContext'
import { cx, taka } from '@/utils/format'
import NotFound from './NotFound'

/**
 * Policy pages are edited in the admin panel (Settings → FAQ & policies), so
 * this component only renders whatever is stored. The delivery-zone table is
 * injected into the shipping page automatically from live settings.
 */
export default function Policy() {
  const { slug } = useParams()
  const { policies, contact, zones, delivery } = useSettings()
  const waLink = useWhatsAppLink()

  const policy = useMemo(() => policies.find((p) => p.slug === slug), [policies, slug])
  usePageMeta(policy?.title)

  if (!policies.length) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ink/15 border-t-plum" />
      </div>
    )
  }

  if (!policy) return <NotFound />

  return (
    <>
      <PageHeader
        crumbs={[{ label: policy.title }]}
        eyebrow={policy.updated ? `Last updated ${policy.updated}` : undefined}
        title={policy.title}
        lead={policy.lead}
      />

      <div className="container-x py-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[15rem_1fr] lg:gap-16">
          <aside className="lg:sticky lg:top-36 lg:self-start">
            <p className="eyebrow text-ink/40">Policies</p>
            <ul className="mt-4 space-y-1">
              {policies.map((item) => (
                <li key={item.slug}>
                  <Link
                    to={`/policy/${item.slug}`}
                    className={cx(
                      'block rounded-xl px-3.5 py-2.5 text-[0.875rem] transition-colors',
                      item.slug === slug ? 'bg-ink text-cream' : 'text-ink/60 hover:bg-sand hover:text-ink',
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl bg-sand p-5">
              <p className="text-[0.875rem] font-medium">Need a human?</p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink/60">
                Policies are guidelines. If your situation does not fit one, message us — we are
                reasonable.
              </p>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-plum"
              >
                <Icon name="whatsapp" size={15} /> WhatsApp us
              </a>
            </div>
          </aside>

          <article className="max-w-3xl">
            {(policy.sections ?? []).map((section, i) => (
              <section key={`${section.heading}-${i}`} className="mb-11 last:mb-0">
                <h2 className="text-[1.5rem] tracking-tight md:text-[1.75rem]">{section.heading}</h2>

                {/* live delivery rates, so the table can never drift from checkout */}
                {slug === 'shipping' && /charge|timing|rate/i.test(section.heading) && (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[26rem] border-collapse text-left text-[0.875rem]">
                      <thead>
                        <tr className="border-b border-ink/15">
                          <th className="pb-3 font-semibold">Zone</th>
                          <th className="pb-3 font-semibold">Charge</th>
                          <th className="pb-3 font-semibold">Estimated time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/8">
                        {zones.map((z) => (
                          <tr key={z.id}>
                            <td className="py-3 pr-4">{z.label}</td>
                            <td className="py-3 pr-4 font-medium">{taka(z.charge)}</td>
                            <td className="py-3 text-ink/60">{z.eta}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className="py-3 pr-4 text-ink/60" colSpan={3}>
                            Free on every order over {taka(delivery.freeShippingThreshold)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 space-y-3.5">
                  {(section.body ?? []).map((paragraph, n) => (
                    <p
                      key={n}
                      className="text-[1rem] leading-relaxed text-ink/70 text-balance-pretty"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            <div className="mt-14 rounded-2xl border border-ink/12 p-6">
              <p className="text-[0.875rem] leading-relaxed text-ink/60">
                Questions about this policy? Email{' '}
                <a
                  href={`mailto:${contact.email}`}
                  className="font-medium text-plum underline underline-offset-2"
                >
                  {contact.email}
                </a>{' '}
                or call{' '}
                <a
                  href={`tel:${String(contact.phone).replace(/\s/g, '')}`}
                  className="font-medium text-plum underline underline-offset-2"
                >
                  {contact.phone}
                </a>
                .
              </p>
            </div>
          </article>
        </div>
      </div>
    </>
  )
}
