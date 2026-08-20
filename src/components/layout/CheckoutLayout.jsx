import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/common/Toaster'
import { ScrollToTop } from '@/components/common/PageShell'

/**
 * Checkout and the payment gateway run without the storefront chrome — no nav,
 * no cart drawer, no footer links. Fewer exits means fewer abandoned carts.
 */
export function CheckoutLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
