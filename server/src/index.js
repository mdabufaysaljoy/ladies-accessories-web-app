import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'

import { env, isProd } from './config/env.js'
import { connectDb } from './config/db.js'
import { notFound, errorHandler } from './middleware/error.js'

import authRoutes from './routes/auth.js'
import settingsRoutes from './routes/settings.js'
import productRoutes from './routes/products.js'
import categoryRoutes from './routes/categories.js'
import orderRoutes from './routes/orders.js'
import paymentRoutes from './routes/payments.js'
import couponRoutes from './routes/coupons.js'
import customerRoutes from './routes/customers.js'
import inboxRoutes from './routes/inbox.js'
import campaignRoutes from './routes/campaigns.js'
import analyticsRoutes from './routes/analytics.js'
import mediaRoutes from './routes/media.js'
import reviewRoutes from './routes/reviews.js'
import courierRoutes from './routes/couriers.js'
import accountRoutes from './routes/account.js'
import trackingRoutes from './routes/tracking.js'
import { startCourierPoller } from './services/courierPoller.js'

const app = express()
app.set('trust proxy', 1)

app.use(
  helmet({
    // Uploaded images are consumed by the storefront on another origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
)

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true) // server-to-server, curl, gateways
      if (env.clientOrigin.includes(origin)) return cb(null, true)
      cb(new Error(`Origin not allowed by CORS: ${origin}`))
    },
    credentials: true,
  }),
)

app.use(compression())
app.use(cookieParser())

// Meta verifies webhooks against the exact raw bytes, so keep a copy.
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      if (req.originalUrl.includes('/webhook/')) req.rawBody = buf
    },
  }),
)
// Payment gateways post form-encoded callbacks.
app.use(express.urlencoded({ extended: true }))

if (!isProd) app.use(morgan('dev'))

app.use('/uploads', express.static(env.uploadDir, { maxAge: '30d' }))

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    // Gateway callbacks and Meta webhooks must never be throttled.
    skip: (req) => req.path.startsWith('/payments/') || req.path.includes('/webhook/'),
  }),
)

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, env: env.nodeEnv, time: new Date().toISOString() }),
)

app.use('/api/auth', authRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/products', productRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/coupons', couponRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/inbox', inboxRoutes)
app.use('/api/campaigns', campaignRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/couriers', courierRoutes)
app.use('/api/account', accountRoutes)
app.use('/api/track', trackingRoutes)

app.use(notFound)
app.use(errorHandler)

const start = async () => {
  try {
    await connectDb()
    startCourierPoller()
    app.listen(env.port, () => {
      console.log(`\n  Goods by Sadia API`)
      console.log(`  → http://localhost:${env.port}/api/health`)
      console.log(`  → env: ${env.nodeEnv}\n`)
    })
  } catch (error) {
    console.error('[boot] failed to start:', error.message)
    process.exit(1)
  }
}

start()

export default app
