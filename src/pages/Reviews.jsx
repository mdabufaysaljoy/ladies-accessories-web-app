import { Icon } from '@/components/ui/Icon'
import { Rating } from '@/components/ui/Rating'
import { Section } from '@/components/ui/Section'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { ReviewForm } from '@/components/review/ReviewForm'
import { ReviewList, ReviewSummary } from '@/components/review/ReviewList'
import { useReviews } from '@/hooks/useReviews'
import { useSettings } from '@/context/SettingsContext'

/**
 * Reviews of the business itself — delivery, packing, service — as opposed to
 * the per-product reviews on a product page.
 *
 * Until real ones are published this falls back to the bundled testimonials so
 * the page never looks abandoned, but the fallback is clearly separated: real
 * reviews always render above it and push it out entirely once there are any.
 */
export default function Reviews() {
  const { brand } = useSettings()
  const { reviews, summary, eligibility, loading, refresh } = useReviews()

  usePageMeta(
    'Customer reviews',
    `What customers across Bangladesh say about ordering from ${brand.name}.`,
  )

  const hasReal = reviews.length > 0

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Reviews' }]}
        eyebrow="Customer reviews"
        title={`What it is like to order from ${brand.name}`}
        lead="Every review below comes from a customer with a delivered order. Nothing is bought, nothing is invented."
      >
        {summary?.total > 0 && (
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[2.75rem] leading-none">
                {summary.average.toFixed(1)}
              </span>
              <span className="text-[0.9375rem] text-ink/50">out of 5</span>
            </div>
            <div>
              <Rating value={summary.average} size={18} />
              <p className="mt-1 text-[0.8125rem] text-ink/55">
                From {summary.total} verified {summary.total === 1 ? 'customer' : 'customers'}
              </p>
            </div>
          </div>
        )}
      </PageHeader>

      <Section>
        <div className="container-x">
          <div className="grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-16">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <ReviewSummary summary={summary} label="verified customers" />

              <div className="mt-6 space-y-3 rounded-2xl bg-sand p-5">
                <p className="flex items-start gap-3 text-[0.875rem]">
                  <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-ink/45" />
                  <span className="text-ink/70">
                    Only customers with a delivered order can review, and each can write once.
                  </span>
                </p>
                <p className="flex items-start gap-3 text-[0.875rem]">
                  <Icon name="eye" size={18} className="mt-0.5 shrink-0 text-ink/45" />
                  <span className="text-ink/70">
                    We read every review before it goes up, but we do not delete honest criticism.
                  </span>
                </p>
              </div>
            </div>

            <div>
              <ReviewForm eligibility={eligibility} onSubmitted={refresh} />

              <div className="mt-8">
                {loading ? (
                  <div className="flex min-h-[30vh] items-center justify-center">
                    <span
                      className="h-9 w-9 animate-spin rounded-full border-[3px] border-ink/15 border-t-plum"
                      role="status"
                      aria-label="Loading reviews"
                    />
                  </div>
                ) : hasReal ? (
                  <ReviewList reviews={reviews} />
                ) : (
                  /**
                   * An honest empty state. This used to fall back to a bundled
                   * list of invented testimonials under the heading "What
                   * customers have told us" — fabricated reviews shown to real
                   * shoppers, which is not something a shop should publish.
                   */
                  <div className="rounded-[1.25rem] bg-cream p-9 text-center">
                    <p className="font-display text-[1.25rem] tracking-tight">No reviews yet</p>
                    <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-ink/60 text-balance-pretty">
                      Reviews appear here once customers have bought something and written one.
                      Every review is from a verified order.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
