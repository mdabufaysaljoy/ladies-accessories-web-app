import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../AdminAuth'
import { useSettings } from '@/context/SettingsContext'
import { Btn, Field, Input } from '../components/ui'
import { Icon } from '@/components/ui/Icon'

export default function AdminLogin() {
  const { login } = useAdminAuth()
  const { brand } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate(location.state?.from ?? '/admin', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink font-display text-lg text-cream">
              {brand.logoMark || 'S'}
            </span>
            <div>
              <p className="font-display text-lg leading-tight tracking-tight">{brand.name}</p>
              <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-ink/40">Admin panel</p>
            </div>
          </div>

          <h1 className="mt-10 font-display text-[1.875rem] leading-tight tracking-tight">Sign in</h1>
          <p className="mt-2 text-[0.875rem] text-ink/55">
            Manage orders, products, chat and settings for your store.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@goodsbysadia.com"
                autoComplete="username"
                required
                className="h-11"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="h-11"
              />
            </Field>

            {error && (
              <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3.5 py-3 text-[0.8125rem] text-red-700">
                <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <Btn type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              Sign in
            </Btn>
          </form>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-plum lg:block">
        <div className="absolute -right-32 -top-32 h-[36rem] w-[36rem] rounded-full bg-rose/25 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-[32rem] w-[32rem] rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-14 text-cream">
          <p className="eyebrow text-gold-soft">Everything in one place</p>
          <h2 className="mt-4 max-w-md font-display text-[2.5rem] leading-[1.1] tracking-tight">
            Your whole shop, from one screen.
          </h2>
          <ul className="mt-10 space-y-4">
            {[
              ['bag', 'Orders', 'COD and online payments, courier tracking, status emails'],
              ['whatsapp', 'Unified inbox', 'WhatsApp, Messenger and Instagram in one thread list'],
              ['sparkle', 'Products', 'Full details, specifications, variants and stock'],
              ['mail', 'Campaigns', 'Promotional email to subscribers and customer segments'],
              ['lock', 'Brand & payments', 'Change any text, number or API key without a developer'],
            ].map(([icon, title, body]) => (
              <li key={title} className="flex gap-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cream/12">
                  <Icon name={icon} size={17} />
                </span>
                <span>
                  <span className="block text-[0.9375rem] font-medium">{title}</span>
                  <span className="block text-[0.8125rem] text-cream/60">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
