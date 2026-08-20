import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { usePageMeta } from '@/components/common/PageShell'
import { SSL_CHANNELS, validateTransaction } from '@/services/payment'
import { useStore } from '@/context/StoreContext'
import { cx, taka } from '@/utils/format'

/**
 * Stand-in for the SSLCommerz hosted gateway page.
 *
 * With a real backend the customer never reaches this route — `initSslcommerzSession`
 * returns SSLCommerz's own GatewayPageURL and the browser leaves the site. This
 * screen exists so the demo has the same shape: choose a channel, pay, and come
 * back to a validated order.
 */

const GROUPS = [
  { kind: 'wallet', label: 'Mobile banking' },
  { kind: 'card', label: 'Cards' },
  { kind: 'bank', label: 'Internet banking' },
]

export default function PaymentGateway() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { placeOrder, toast } = useStore()

  const [order, setOrder] = useState(null)
  const [channel, setChannel] = useState('bkash')
  const [phase, setPhase] = useState('select') // select → processing → done
  const [seconds, setSeconds] = useState(600)

  usePageMeta('Secure payment')

  useEffect(() => {
    const raw = sessionStorage.getItem('gbs.pendingOrder')
    if (!raw) {
      navigate('/checkout', { replace: true })
      return
    }
    setOrder(JSON.parse(raw))
  }, [navigate])

  // Gateway sessions expire — mirror that so the demo behaves believably.
  useEffect(() => {
    if (phase !== 'select') return
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [phase])

  if (!order) return null

  const tranId = params.get('tran_id') ?? order.id
  const selected = SSL_CHANNELS.find((c) => c.id === channel)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  const pay = async () => {
    setPhase('processing')
    try {
      const result = await validateTransaction(`VAL-${tranId}`)
      if (result.status !== 'VALID' && result.status !== 'VALIDATED') {
        throw new Error('The bank declined this transaction')
      }
      const paid = {
        ...order,
        status: 'confirmed',
        payment: {
          ...order.payment,
          status: 'paid',
          channel: selected.name,
          valId: result.val_id,
          paidAt: new Date().toISOString(),
        },
      }
      sessionStorage.removeItem('gbs.pendingOrder')
      placeOrder(paid)
      setPhase('done')
      setTimeout(() => navigate(`/order/${paid.id}`, { replace: true }), 900)
    } catch (error) {
      setPhase('select')
      toast(error.message || 'Payment failed. Please try another method.', { kind: 'error' })
    }
  }

  const cancel = () => {
    sessionStorage.removeItem('gbs.pendingOrder')
    toast('Payment cancelled — your bag is still saved', { kind: 'info' })
    navigate('/checkout', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-[#eef1f5] py-8 md:py-14">
      <div className="mx-auto w-[min(46rem,92vw)]">
        {/* gateway chrome */}
        <div className="flex items-center justify-between rounded-t-2xl bg-[#1b3a5c] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">
              <Icon name="lock" size={18} />
            </span>
            <div>
              <p className="text-[0.9375rem] font-bold tracking-tight">SSLCOMMERZ</p>
              <p className="text-[0.6875rem] text-white/60">Secure Payment Gateway</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[0.6875rem] text-white/60">Session expires in</p>
            <p className="font-mono text-[0.9375rem] tabular-nums">
              {mm}:{ss}
            </p>
          </div>
        </div>

        <div className="rounded-b-2xl bg-white shadow-lift">
          {/* merchant + amount */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/8 px-6 py-5">
            <div>
              <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-black/40">Merchant</p>
              <p className="mt-1 text-[0.9375rem] font-semibold text-[#1b3a5c]">Goods by Sadia</p>
              <p className="mt-0.5 font-mono text-[0.75rem] text-black/45">Txn: {tranId}</p>
            </div>
            <div className="text-right">
              <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-black/40">Amount</p>
              <p className="mt-1 font-display text-[1.75rem] leading-none text-[#1b3a5c]">
                {taka(order.totals.total)}
              </p>
              <p className="mt-1 text-[0.75rem] text-black/45">BDT</p>
            </div>
          </div>

          {phase === 'done' ? (
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700">
                <Icon name="checkCircle" size={32} />
              </span>
              <p className="mt-5 text-xl font-semibold text-[#1b3a5c]">Payment successful</p>
              <p className="mt-2 text-[0.875rem] text-black/50">Redirecting to your order…</p>
            </div>
          ) : phase === 'processing' ? (
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <span className="h-12 w-12 animate-spin rounded-full border-4 border-[#1b3a5c]/15 border-t-[#1b3a5c]" />
              <p className="mt-5 text-[1.0625rem] font-semibold text-[#1b3a5c]">
                Verifying with {selected.name}…
              </p>
              <p className="mt-2 max-w-sm text-[0.875rem] text-black/50">
                Do not close this window or press back. This usually takes a few seconds.
              </p>
            </div>
          ) : (
            <div className="px-6 py-6">
              {GROUPS.map((group) => {
                const options = SSL_CHANNELS.filter((c) => c.kind === group.kind)
                return (
                  <div key={group.kind} className="mb-6 last:mb-0">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-black/40">
                      {group.label}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {options.map((c) => {
                        const active = channel === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setChannel(c.id)}
                            className={cx(
                              'flex h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-center transition-all duration-200',
                              active
                                ? 'border-[#1b3a5c] bg-[#1b3a5c]/5 shadow-sm'
                                : 'border-black/10 hover:border-black/25',
                            )}
                          >
                            <span
                              className="grid h-7 w-7 place-items-center rounded-md text-[0.625rem] font-black text-white"
                              style={{ backgroundColor: c.color }}
                            >
                              {c.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[0.6875rem] font-medium leading-tight text-black/70">
                              {c.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <div className="mt-7 rounded-xl bg-[#f5f7fa] p-4">
                <p className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-black/55">
                  <Icon name="info" size={14} className="mt-0.5 shrink-0 text-[#1b3a5c]" />
                  <span>
                    <strong className="font-semibold">Demonstration gateway.</strong> No money moves and
                    no credentials are collected. A live integration would hand off to SSLCommerz’s own
                    hosted page here, and the order would only be marked paid after server-side
                    validation of the returned <code>val_id</code>.
                  </span>
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Button
                  size="lg"
                  full
                  onClick={pay}
                  disabled={seconds === 0}
                  // inline so the gateway's own brand colour beats the button variant
                  style={{ backgroundColor: seconds === 0 ? undefined : '#1b3a5c' }}
                >
                  <Icon name="lock" size={17} />
                  {seconds === 0 ? 'Session expired' : `Pay ${taka(order.totals.total)}`}
                </Button>
                <Button variant="outline" size="lg" onClick={cancel} className="sm:w-auto">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-[0.75rem] text-black/40">
          Secured by SSLCommerz · PCI DSS compliant · Your card details are never shared with the
          merchant
        </p>
      </div>
    </div>
  )
}
