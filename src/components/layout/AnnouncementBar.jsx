import { Icon } from '@/components/ui/Icon'
import { useSettings } from '@/context/SettingsContext'

/**
 * Seamless marquee — the list is rendered twice so the -50% translation loops
 * without a visible seam. Messages come from the admin panel.
 */
export function AnnouncementBar() {
  const { announcements, tf } = useSettings()
  if (!announcements.length) return null

  const items = [...announcements, ...announcements]

  return (
    <div className="relative overflow-hidden bg-ink py-2.5 text-cream">
      <div className="flex w-max animate-[marquee_38s_linear_infinite] items-center gap-10 whitespace-nowrap will-change-transform hover:[animation-play-state:paused]">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-3 text-[0.75rem] tracking-wide text-cream/85">
            <Icon name="sparkle" size={12} className="text-gold" fill />
            {tf(item, 'text')}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink to-transparent" />
    </div>
  )
}
