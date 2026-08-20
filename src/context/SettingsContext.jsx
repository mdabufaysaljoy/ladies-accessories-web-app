import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { BRAND, DELIVERY_ZONES, FREE_SHIPPING_THRESHOLD } from '@/data/content'

const SettingsContext = createContext(null)

/**
 * Everything editable from the admin panel — brand, contact, delivery, copy —
 * loads here once and flows through the storefront. The bundled `data/content`
 * values are the fallback so the site still renders if the API is down.
 */
const FALLBACK = {
  brand: {
    name: BRAND.name,
    nameBn: 'গুডস বাই সাদিয়া',
    tagline: BRAND.tagline,
    logoMark: 'S',
    logoUrl: '',
    established: '2021',
    locationLabel: 'Dhaka',
    colors: {},
  },
  contact: {
    phone: BRAND.phone,
    whatsapp: BRAND.whatsapp,
    whatsappGreeting: 'Hi Sadia! I have a question about ',
    email: BRAND.email,
    address: BRAND.address,
    hours: BRAND.hours,
    tradeLicence: 'TRAD/DNCC/024518/2021',
  },
  socials: BRAND.socials.map((s) => ({ ...s, icon: s.name.toLowerCase(), enabled: true })),
  announcements: [],
  delivery: {
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    codAdvanceThreshold: 5000,
    codAdvanceAmount: 200,
    returnWindowDays: 7,
    zones: DELIVERY_ZONES.map((z) => ({ ...z, enabled: true })),
    couriers: [],
  },
  payments: { cod: { enabled: true }, bkashManual: { enabled: false }, sslcommerz: { enabled: false }, bkash: { enabled: false }, nagadManual: { enabled: false } },
  storefront: {
    language: 'en',
    allowLanguageToggle: true,
    currencySymbol: '৳',
    maintenanceMode: false,
    showQuickOrder: true,
    showWhatsAppFab: true,
    heroHeadline: 'Modest style, honest beauty.',
    stats: [],
  },
  faqs: [],
  policies: [],
  seo: {},
}

const LANG_KEY = 'gbs.lang'

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(false)
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(LANG_KEY) ?? 'en'
    } catch {
      return 'en'
    }
  })

  const load = useCallback(async () => {
    try {
      const data = await api.get('/settings')
      // Merge over the fallback so a partially-populated document still renders.
      setSettings((prev) => ({ ...prev, ...data.settings }))
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setLang = useCallback((next) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  /** Picks the Bangla variant of a field when the site is in Bangla. */
  const tf = useCallback(
    (obj, field) => {
      if (!obj) return ''
      if (lang === 'bn') {
        const bnField = `${field}Bn`
        if (obj[bnField]) return obj[bnField]
      }
      return obj[field] ?? ''
    },
    [lang],
  )

  const value = useMemo(
    () => ({
      settings,
      loading,
      online,
      reload: load,
      lang,
      setLang,
      isBn: lang === 'bn',
      tf,
      brand: settings.brand ?? FALLBACK.brand,
      contact: settings.contact ?? FALLBACK.contact,
      socials: (settings.socials ?? []).filter((s) => s.enabled !== false),
      announcements: (settings.announcements ?? []).filter((a) => a.enabled !== false),
      delivery: settings.delivery ?? FALLBACK.delivery,
      zones: (settings.delivery?.zones ?? FALLBACK.delivery.zones).filter((z) => z.enabled !== false),
      storefront: settings.storefront ?? FALLBACK.storefront,
      faqs: settings.faqs ?? [],
      policies: settings.policies ?? [],
    }),
    [settings, loading, online, load, lang, setLang, tf],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}

/** Builds a wa.me link from the admin-configured number and greeting. */
export function useWhatsAppLink(message) {
  const { contact } = useSettings()
  const number = String(contact.whatsapp ?? '').replace(/\D/g, '')
  const text = encodeURIComponent(message ?? contact.whatsappGreeting ?? '')
  return `https://wa.me/${number}${text ? `?text=${text}` : ''}`
}
