import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { CheckoutLayout } from '@/components/layout/CheckoutLayout'
import Home from '@/pages/Home'

/**
 * Home ships in the main bundle; everything else is split so the first paint
 * stays light on a mobile connection.
 */
const Shop = lazy(() => import('@/pages/Shop'))
const ProductDetail = lazy(() => import('@/pages/ProductDetail'))
const Cart = lazy(() => import('@/pages/Cart'))
const Checkout = lazy(() => import('@/pages/Checkout'))
const PaymentGateway = lazy(() => import('@/pages/PaymentGateway'))
const OrderConfirmation = lazy(() => import('@/pages/OrderConfirmation'))
const TrackOrder = lazy(() => import('@/pages/TrackOrder'))
const Wishlist = lazy(() => import('@/pages/Wishlist'))
const About = lazy(() => import('@/pages/About'))
const Contact = lazy(() => import('@/pages/Contact'))
const Faq = lazy(() => import('@/pages/Faq'))
const Policy = lazy(() => import('@/pages/Policy'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const AccountAuth = lazy(() => import('@/pages/AccountAuth'))
const Account = lazy(() => import('@/pages/Account'))
const AdminApp = lazy(() => import('@/admin/AdminApp'))

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-ink/15 border-t-plum"
        role="status"
        aria-label="Loading"
      />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* The admin panel is a separate app under /admin/*. */}
        <Route path="/admin/*" element={<AdminApp />} />

        {/* Checkout and the gateway run without storefront nav — fewer exits. */}
        <Route element={<CheckoutLayout />}>
          <Route path="checkout" element={<Checkout />} />
          <Route path="payment/sslcommerz" element={<PaymentGateway />} />
        </Route>

        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="shop/:category" element={<Shop />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="order/:id" element={<OrderConfirmation />} />
          <Route path="track-order" element={<TrackOrder />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="login" element={<AccountAuth mode="login" />} />
          <Route path="register" element={<AccountAuth mode="register" />} />
          <Route path="account" element={<Account />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="faq" element={<Faq />} />
          <Route path="policy/:slug" element={<Policy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
