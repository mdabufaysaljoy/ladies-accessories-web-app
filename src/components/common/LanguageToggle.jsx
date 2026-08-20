import { useSettings } from '@/context/SettingsContext'
import { cx } from '@/utils/format'

/**
 * EN / বাংলা switch. Hidden unless the shop enables it in Settings → Storefront.
 */
export function LanguageToggle({ className = '' }) {
  const { lang, setLang, storefront } = useSettings()
  if (storefront.allowLanguageToggle === false) return null

  return (
    <div
      role="group"
      aria-label="Language"
      className={cx('flex items-center rounded-full border border-ink/12 p-0.5', className)}
    >
      {[
        { id: 'en', label: 'EN' },
        { id: 'bn', label: 'বাং' },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setLang(option.id)}
          aria-pressed={lang === option.id}
          className={cx(
            'rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors duration-200',
            lang === option.id ? 'bg-ink text-cream' : 'text-ink/50 hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
