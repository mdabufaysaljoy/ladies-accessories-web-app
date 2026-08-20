import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AdminAuthProvider } from './AdminAuth'
import { AdminLayout } from './AdminLayout'
import { Spinner } from './components/ui'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Products = lazy(() => import('./pages/Products'))
const ProductEdit = lazy(() => import('./pages/ProductEdit'))
const Categories = lazy(() => import('./pages/Categories'))
const Inbox = lazy(() => import('./pages/Inbox'))
const Customers = lazy(() => import('./pages/Customers'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'))
const Reviews = lazy(() => import('./pages/Reviews'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const Coupons = lazy(() => import('./pages/Coupons'))
const Offers = lazy(() => import('./pages/Offers'))
const Media = lazy(() => import('./pages/Media'))
const Settings = lazy(() => import('./pages/Settings'))

/**
 * The whole admin is lazy-loaded from the storefront bundle, so a shopper never
 * downloads any of it.
 */
export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Suspense fallback={<Spinner className="min-h-dvh" />}>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductEdit />} />
            <Route path="categories" element={<Categories />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="offers" element={<Offers />} />
            <Route path="media" element={<Media />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </AdminAuthProvider>
  )
}
