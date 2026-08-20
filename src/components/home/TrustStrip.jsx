import { Icon } from '@/components/ui/Icon'
import { TRUST_POINTS } from '@/data/content'
import { useReveal } from '@/hooks/useReveal'

export function TrustStrip() {
  const ref = useReveal({ stagger: 80 })

  return (
    <div ref={ref} className="border-b border-ink/8 bg-cream">
      <div className="container-x">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4">
          {TRUST_POINTS.map((point) => (
            <li key={point.title} className="reveal flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blush text-plum">
                <Icon name={point.icon} size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.875rem] font-semibold leading-snug tracking-tight">
                  {point.title}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-snug text-ink/55">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
