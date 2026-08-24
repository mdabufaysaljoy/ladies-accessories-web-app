import { Icon } from '@/components/ui/Icon'
import { useSettings } from '@/context/SettingsContext'
import { freeShippingThreshold, taka } from '@/utils/format'

export function FreeShippingBar({ subtotal }) {
  const { delivery } = useSettings()
  const threshold = freeShippingThreshold(delivery)

  /**
   * Nothing to promise when the shop charges delivery on every order — and a
   * threshold of 0 would divide by zero for the progress bar anyway.
   */
  if (threshold <= 0) return null

  const pct = Math.min(100, (subtotal / threshold) * 100)
  const remaining = Math.max(0, threshold - subtotal)
  const unlocked = remaining === 0

  return (
    <div className="rounded-2xl bg-sand px-4 py-3.5">
      <p className="flex items-center gap-2 text-[0.8125rem]">
        <Icon name="truck" size={16} className={unlocked ? 'text-moss' : 'text-ink/45'} />
        {unlocked ? (
          <span className="font-medium text-moss">Free delivery unlocked</span>
        ) : (
          <span className="text-ink/70">
            Add <strong className="font-semibold text-ink">{taka(remaining)}</strong> more for free
            delivery
          </span>
        )}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose to-plum transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
