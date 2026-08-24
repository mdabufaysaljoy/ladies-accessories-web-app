import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader, usePageMeta } from '@/components/common/PageShell'
import { useAccount } from '@/context/AccountContext'
import { useSettings } from '@/context/SettingsContext'
import { cx, isValidBdPhone, isValidEmail, sanitisePhoneInput } from '@/utils/format'

const inputClass = (error) =>
  cx(
    'h-12 w-full rounded-xl border bg-cream px-4 text-[0.9375rem] outline-none transition-colors placeholder:text-ink/30',
    error ? 'border-red-400' : 'border-ink/15 focus:border-ink',
  )

/** Shared screen for both sign in and sign up — `mode` picks which. */
export default function AccountAuth({ mode = 'login' }) {
  const isRegister = mode === 'register'
  const { login, register } = useAccount()
  const { isBn } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')

  const t = (en, bn) => (isBn ? bn : en)
  usePageMeta(isRegister ? t('Create account', 'অ্যাকাউন্ট খুলুন') : t('Sign in', 'সাইন ইন'))

  /**
   * Phone boxes only ever hold what a phone number can contain. Stripping as
   * the shopper types means a field can never be submitted full of letters —
   * `isValidBdPhone` still checks the shape on submit.
   */
  const set = (key) => (e) => {
    const value = /phone/i.test(key) ? sanitisePhoneInput(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
    setServerError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (isRegister && form.name.trim().length < 3) next.name = t('Please enter your full name', 'পুরো নাম লিখুন')
    if (!isValidBdPhone(form.phone)) next.phone = t('Enter a valid mobile number (01XXXXXXXXX)', 'সঠিক মোবাইল নম্বর দিন')
    if (isRegister && form.email && !isValidEmail(form.email)) next.email = t('That email does not look right', 'ইমেইল সঠিক নয়')
    if (form.password.length < (isRegister ? 8 : 1)) {
      next.password = isRegister
        ? t('Password must be at least 8 characters', 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে')
        : t('Enter your password', 'পাসওয়ার্ড দিন')
    }

    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      if (isRegister) await register(form)
      else await login(form.phone, form.password)
      navigate(location.state?.from ?? '/account', { replace: true })
    } catch (err) {
      setServerError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: isRegister ? t('Create account', 'অ্যাকাউন্ট') : t('Sign in', 'সাইন ইন') }]}
        eyebrow={t('Your account', 'আপনার অ্যাকাউন্ট')}
        title={isRegister ? t('Create your account', 'অ্যাকাউন্ট খুলুন') : t('Welcome back', 'আবার স্বাগতম')}
        lead={
          isRegister
            ? t(
                'Save your address so checkout takes seconds next time. You can always order without an account.',
                'ঠিকানা সেভ করে রাখুন — পরেরবার চেকআউট আরও দ্রুত হবে। অ্যাকাউন্ট ছাড়াও অর্ডার করা যায়।',
              )
            : t('Sign in to see your orders and saved addresses.', 'অর্ডার ও সেভ করা ঠিকানা দেখতে সাইন ইন করুন।')
        }
      />

      <div className="container-x py-12 md:py-16">
        <div className="mx-auto max-w-md">
          <form onSubmit={submit} className="space-y-4">
            {isRegister && (
              <label className="block">
                <span className="text-[0.8125rem] font-medium text-ink/70">
                  {t('Full name', 'পুরো নাম')} <span className="text-rose">*</span>
                </span>
                <input
                  value={form.name}
                  onChange={set('name')}
                  placeholder={t('e.g. Nusrat Jahan', 'যেমন নুসরাত জাহান')}
                  autoComplete="name"
                  className={cx('mt-1.5', inputClass(errors.name))}
                />
                {errors.name && <span className="mt-1 block text-[0.75rem] text-red-600">{errors.name}</span>}
              </label>
            )}

            <label className="block">
              <span className="text-[0.8125rem] font-medium text-ink/70">
                {t('Mobile number', 'মোবাইল নম্বর')} <span className="text-rose">*</span>
              </span>
              <input
                value={form.phone}
                onChange={set('phone')}
                placeholder="01XXXXXXXXX"
                inputMode="tel"
                autoComplete="tel"
                className={cx('mt-1.5', inputClass(errors.phone))}
              />
              {errors.phone && <span className="mt-1 block text-[0.75rem] text-red-600">{errors.phone}</span>}
            </label>

            {isRegister && (
              <label className="block">
                <span className="text-[0.8125rem] font-medium text-ink/70">
                  {t('Email', 'ইমেইল')}{' '}
                  <span className="text-ink/40">({t('optional — for invoices', 'ঐচ্ছিক — ইনভয়েসের জন্য')})</span>
                </span>
                <input
                  value={form.email}
                  onChange={set('email')}
                  type="email"
                  placeholder="you@email.com"
                  autoComplete="email"
                  className={cx('mt-1.5', inputClass(errors.email))}
                />
                {errors.email && <span className="mt-1 block text-[0.75rem] text-red-600">{errors.email}</span>}
              </label>
            )}

            <label className="block">
              <span className="text-[0.8125rem] font-medium text-ink/70">
                {t('Password', 'পাসওয়ার্ড')} <span className="text-rose">*</span>
              </span>
              <input
                value={form.password}
                onChange={set('password')}
                type="password"
                placeholder="••••••••"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className={cx('mt-1.5', inputClass(errors.password))}
              />
              {errors.password && <span className="mt-1 block text-[0.75rem] text-red-600">{errors.password}</span>}
            </label>

            {serverError && (
              <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-[0.8125rem] text-red-700">
                <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
                {serverError}
              </p>
            )}

            <Button type="submit" size="lg" full loading={busy}>
              {isRegister ? t('Create account', 'অ্যাকাউন্ট খুলুন') : t('Sign in', 'সাইন ইন')}
            </Button>
          </form>

          <p className="mt-6 text-center text-[0.875rem] text-ink/60">
            {isRegister ? (
              <>
                {t('Already have an account?', 'আগে থেকেই অ্যাকাউন্ট আছে?')}{' '}
                <Link to="/login" className="font-medium text-plum underline underline-offset-2">
                  {t('Sign in', 'সাইন ইন')}
                </Link>
              </>
            ) : (
              <>
                {t('New here?', 'নতুন?')}{' '}
                <Link to="/register" className="font-medium text-plum underline underline-offset-2">
                  {t('Create an account', 'অ্যাকাউন্ট খুলুন')}
                </Link>
              </>
            )}
          </p>

          <div className="mt-8 rounded-2xl bg-blush px-5 py-4 text-center">
            <p className="text-[0.8125rem] leading-relaxed text-ink/70">
              <Icon name="info" size={14} className="mr-1.5 inline text-plum" />
              {t(
                'You never need an account to order — guest checkout works exactly the same.',
                'অর্ডার করতে অ্যাকাউন্ট লাগে না — গেস্ট চেকআউটেও একইভাবে অর্ডার করা যায়।',
              )}
            </p>
            <Link to="/shop" className="mt-2 inline-block text-[0.8125rem] font-medium text-plum underline underline-offset-2">
              {t('Continue shopping as a guest', 'গেস্ট হিসেবে কেনাকাটা করুন')}
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
