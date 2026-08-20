import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { SearchOverlay } from '@/components/common/SearchOverlay'
import { Toaster } from '@/components/common/Toaster'
import { ScrollToTop, WhatsAppFab } from '@/components/common/PageShell'

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <Header />

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <Footer />

      <CartDrawer />
      <SearchOverlay />
      <Toaster />
      <WhatsAppFab />
    </div>
  )
}
