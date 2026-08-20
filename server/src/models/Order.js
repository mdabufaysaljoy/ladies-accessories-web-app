import mongoose from 'mongoose'
import { generateOrderNumber } from '../utils/helpers.js'

const lineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    slug: String,
    name: String,
    sku: String,
    price: Number,
    compareAt: Number,
    qty: { type: Number, min: 1 },
    color: String,
    size: String,
    art: { shape: String, hue: Number },
    imageUrl: String,
  },
  { _id: false },
)

/** Every status change is recorded so the admin can see who did what. */
const timelineSchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    at: { type: Date, default: Date.now },
    by: String,
  },
  { _id: false },
)

export const ORDER_STATUSES = [
  'pending',       // placed, awaiting confirmation call
  'confirmed',     // customer confirmed on the phone
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
]

export const PAYMENT_STATUSES = ['unpaid', 'advance-paid', 'paid', 'refunded', 'failed']

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true },

    /**
     * Set when the order was placed while signed in. This is the authoritative
     * link between an order and an account — order history matches on this
     * first, falling back to `customer.phone` for guest orders and anything
     * placed before this field existed. Deliberately separate from `customer`
     * below, which is a point-in-time snapshot of the delivery contact and may
     * be a different phone/name (ordering for someone else).
     */
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },

    /**
     * Meta pixel identifiers captured in the browser at checkout. They live on
     * the order because the Conversions API Purchase is sent from the server,
     * possibly after the shopper's tab is gone — and because `_fbp`/`_fbc` are
     * first-party cookies on the storefront domain, so the API host never
     * receives them on its own. Match quality collapses without them.
     */
    tracking: {
      fbp: { type: String, default: '' },
      fbc: { type: String, default: '' },
      sourceUrl: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      ip: { type: String, default: '' },
      capi: {
        sent: { type: Boolean, default: false },
        at: Date,
        error: { type: String, default: '' },
      },
    },

    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true, index: true },
      altPhone: String,
      email: String,
      district: String,
      area: String,
      address: String,
      notes: String,
      isGift: { type: Boolean, default: false },
      giftNote: String,
    },

    lines: [lineSchema],

    delivery: {
      zoneId: String,
      zoneLabel: String,
      eta: String,
      charge: { type: Number, default: 0 },
      courier: String,              // human label, e.g. "Steadfast Courier"
      trackingNumber: String,
      trackingUrl: String,
      dispatchedAt: Date,
      deliveredAt: Date,

      /** Live courier integration state. Populated when a consignment is created. */
      provider: { type: String, enum: ['steadfast', 'pathao', 'redx', 'manual', ''], default: '' },
      consignmentId: String,
      trackingCode: String,
      courierStatus: String,        // provider's own status string
      courierStatusNote: String,
      lastSyncedAt: Date,
      courierResponse: mongoose.Schema.Types.Mixed,
    },

    invoice: {
      number: { type: String, index: true },
      issuedAt: Date,
    },

    coupon: { code: String, label: String },

    totals: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    payment: {
      method: {
        type: String,
        enum: ['cod', 'sslcommerz', 'bkash', 'bkash-manual', 'nagad-manual'],
        default: 'cod',
      },
      status: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid', index: true },
      channel: String,           // bKash / Visa / Nagad …
      transactionId: String,     // SSLCommerz tran_id or bKash trxID
      validationId: String,      // SSLCommerz val_id — proof of server validation
      paymentId: String,         // bKash paymentID
      advanceAmount: { type: Number, default: 0 },
      amountPaid: { type: Number, default: 0 },
      paidAt: Date,
      gatewayResponse: mongoose.Schema.Types.Mixed,
    },

    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    timeline: [timelineSchema],

    /** Repeat COD refusers are a real cost in BD — flag them at confirmation. */
    riskFlag: { type: String, enum: ['none', 'watch', 'blocked'], default: 'none' },
    internalNotes: String,
    source: { type: String, enum: ['web', 'quick-order', 'whatsapp', 'phone', 'admin'], default: 'web' },

    emailsSent: [{ template: String, at: Date, to: String }],
  },
  { timestamps: true },
)

orderSchema.index({ createdAt: -1 })
orderSchema.index({ 'customer.phone': 1, createdAt: -1 })

orderSchema.pre('validate', function (next) {
  if (!this.orderNumber) this.orderNumber = generateOrderNumber()
  if (!this.timeline?.length) {
    this.timeline = [{ status: this.status || 'pending', note: 'Order placed', by: 'system' }]
  }
  next()
})

orderSchema.methods.pushStatus = function (status, note, by = 'admin') {
  this.status = status
  this.timeline.push({ status, note, by, at: new Date() })
  if (status === 'shipped' && !this.delivery.dispatchedAt) this.delivery.dispatchedAt = new Date()
  if (status === 'delivered') {
    this.delivery.deliveredAt = new Date()
    // COD is collected on delivery — reflect that automatically.
    if (this.payment.method === 'cod' && this.payment.status !== 'paid') {
      this.payment.status = 'paid'
      this.payment.amountPaid = this.totals.total
      this.payment.paidAt = new Date()
    }
  }
  return this
}

export const Order = mongoose.model('Order', orderSchema)
