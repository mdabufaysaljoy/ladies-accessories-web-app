import mongoose from 'mongoose'
import { encryptSecret, maskSecret } from '../utils/crypto.js'

/**
 * One singleton document driving the entire storefront: brand identity,
 * contact details, delivery zones, payment credentials and integrations.
 * Changing it here changes the live site — nothing is hard-coded in the client.
 */
const secretField = {
  type: String,
  default: '',
  set: (v) => (v === undefined || v === null ? '' : v.startsWith('v1:') ? v : encryptSecret(v)),
}

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'primary', unique: true, immutable: true },

    brand: {
      name: { type: String, default: 'Goods by Sadia' },
      nameBn: { type: String, default: 'গুডস বাই সাদিয়া' },
      tagline: { type: String, default: 'Hijabs, skin & colour — chosen with care.' },
      taglineBn: { type: String, default: 'হিজাব, স্কিনকেয়ার ও কসমেটিকস — যত্ন করে বাছাই করা।' },
      logoUrl: { type: String, default: '' },
      logoMark: { type: String, default: 'S' },
      faviconUrl: { type: String, default: '' },
      established: { type: String, default: '2021' },
      locationLabel: { type: String, default: 'Dhaka' },
      colors: {
        ink: { type: String, default: '#171114' },
        plum: { type: String, default: '#5b2a4d' },
        rose: { type: String, default: '#c4787f' },
        blush: { type: String, default: '#f6eae7' },
        cream: { type: String, default: '#fcf9f6' },
        gold: { type: String, default: '#b78b4f' },
      },
      fonts: {
        display: { type: String, default: 'Fraunces' },
        sans: { type: String, default: 'Plus Jakarta Sans' },
      },
    },

    contact: {
      phone: { type: String, default: '+880 1712-345678' },
      phoneSecondary: { type: String, default: '' },
      whatsapp: { type: String, default: '8801712345678' },
      whatsappGreeting: { type: String, default: 'Hi Sadia! I have a question about ' },
      email: { type: String, default: 'hello@goodsbysadia.com' },
      supportEmail: { type: String, default: 'support@goodsbysadia.com' },
      address: { type: String, default: 'House 42, Road 11, Banani, Dhaka 1213, Bangladesh' },
      addressBn: { type: String, default: 'বাড়ি ৪২, রোড ১১, বনানী, ঢাকা ১২১৩' },
      mapUrl: { type: String, default: '' },
      hours: { type: String, default: 'Sat–Thu, 10:00 – 20:00' },
      tradeLicence: { type: String, default: 'TRAD/DNCC/024518/2021' },
      binNumber: { type: String, default: '' },
    },

    socials: [
      {
        name: String,
        href: String,
        icon: String,
        enabled: { type: Boolean, default: true },
      },
    ],

    announcements: [{ text: String, textBn: String, enabled: { type: Boolean, default: true } }],

    delivery: {
      freeShippingThreshold: { type: Number, default: 2000 },
      codAdvanceThreshold: { type: Number, default: 5000 },
      codAdvanceAmount: { type: Number, default: 200 },
      zones: [
        {
          id: String,
          label: String,
          labelBn: String,
          charge: Number,
          eta: String,
          etaBn: String,
          enabled: { type: Boolean, default: true },
        },
      ],
      couriers: [{ name: String, enabled: { type: Boolean, default: true } }],
      returnWindowDays: { type: Number, default: 7 },
    },

    payments: {
      cod: {
        enabled: { type: Boolean, default: true },
        instructions: {
          type: String,
          default: 'Please keep the exact amount ready — couriers often cannot give change.',
        },
      },
      sslcommerz: {
        enabled: { type: Boolean, default: false },
        sandbox: { type: Boolean, default: true },
        storeId: { type: String, default: '' },
        storePassword: secretField,
      },
      bkash: {
        // Tokenised checkout (bKash PGW API)
        enabled: { type: Boolean, default: false },
        sandbox: { type: Boolean, default: true },
        username: { type: String, default: '' },
        password: secretField,
        appKey: { type: String, default: '' },
        appSecret: secretField,
      },
      bkashManual: {
        // "Send Money then give us the TrxID" — how most small BD shops operate
        enabled: { type: Boolean, default: true },
        number: { type: String, default: '01712345678' },
        accountType: { type: String, enum: ['personal', 'agent', 'merchant'], default: 'personal' },
        instructions: {
          type: String,
          default:
            'Send Money to the number above, then enter the TrxID you receive by SMS. We confirm within 30 minutes.',
        },
      },
      nagadManual: {
        enabled: { type: Boolean, default: false },
        number: { type: String, default: '' },
        instructions: { type: String, default: '' },
      },
    },


    couriers: {
      /** Push a consignment to the courier automatically when an order ships. */
      autoCreateConsignment: { type: Boolean, default: false },
      /** Which courier a new consignment goes to when created automatically. */
      defaultProvider: { type: String, enum: ['steadfast', 'pathao', 'redx', ''], default: 'steadfast' },
      /** Re-check delivery status on this cadence (minutes). 0 disables polling. */
      statusSyncMinutes: { type: Number, default: 60 },

      steadfast: {
        enabled: { type: Boolean, default: false },
        sandbox: { type: Boolean, default: false },
        apiKey: secretField,
        secretKey: secretField,
      },
      pathao: {
        enabled: { type: Boolean, default: false },
        sandbox: { type: Boolean, default: true },
        clientId: { type: String, default: '' },
        clientSecret: secretField,
        username: { type: String, default: '' },
        password: secretField,
        storeId: { type: String, default: '' },
      },
      redx: {
        enabled: { type: Boolean, default: false },
        sandbox: { type: Boolean, default: true },
        accessToken: secretField,
        pickupStoreId: { type: String, default: '' },
      },
    },

    notifications: {
      /** Email the shop when a customer places an order. */
      emailAdminOnNewOrder: { type: Boolean, default: true },
      adminNotifyEmail: { type: String, default: '' },
      /** Email the customer their invoice as soon as the order is placed. */
      emailCustomerOnNewOrder: { type: Boolean, default: true },
      /** Email on every status change (confirmed/packed/shipped/delivered). */
      emailCustomerOnStatusChange: { type: Boolean, default: true },
    },

    invoice: {
      prefix: { type: String, default: 'INV' },
      nextNumber: { type: Number, default: 1001 },
      footerNote: {
        type: String,
        default: 'Thank you for shopping with us. Please record a video while opening your parcel.',
      },
      termsNote: {
        type: String,
        default: 'Unopened items may be returned within 7 days. Opened cosmetics cannot be returned for hygiene reasons.',
      },
      showLogo: { type: Boolean, default: true },
      signatureName: { type: String, default: '' },
    },

    integrations: {
      meta: {
        appSecret: secretField,
        verifyToken: { type: String, default: '' },
        whatsapp: {
          enabled: { type: Boolean, default: false },
          phoneNumberId: { type: String, default: '' },
          accessToken: secretField,
          businessAccountId: { type: String, default: '' },
        },
        messenger: {
          enabled: { type: Boolean, default: false },
          pageId: { type: String, default: '' },
          pageAccessToken: secretField,
        },
        instagram: {
          enabled: { type: Boolean, default: false },
          accountId: { type: String, default: '' },
          accessToken: secretField,
        },
      },
      email: {
        provider: { type: String, enum: ['smtp', 'none'], default: 'none' },
        fromName: { type: String, default: 'Goods by Sadia' },
        fromEmail: { type: String, default: 'hello@goodsbysadia.com' },
        replyTo: { type: String, default: '' },
        smtpHost: { type: String, default: '' },
        smtpPort: { type: Number, default: 587 },
        smtpSecure: { type: Boolean, default: false },
        smtpUser: { type: String, default: '' },
        smtpPassword: secretField,
      },
      sms: {
        enabled: { type: Boolean, default: false },
        provider: { type: String, default: 'bulksmsbd' },
        apiKey: secretField,
        senderId: { type: String, default: '' },
      },
      analytics: {
        facebookPixelId: { type: String, default: '' },
        googleAnalyticsId: { type: String, default: '' },
        googleTagManagerId: { type: String, default: '' },
      },
    },

    storefront: {
      language: { type: String, enum: ['en', 'bn'], default: 'en' },
      allowLanguageToggle: { type: Boolean, default: true },
      currencySymbol: { type: String, default: '৳' },
      maintenanceMode: { type: Boolean, default: false },
      maintenanceMessage: { type: String, default: '' },
      showQuickOrder: { type: Boolean, default: true },
      showWhatsAppFab: { type: Boolean, default: true },
      heroHeadline: { type: String, default: 'Modest style, honest beauty.' },
      heroHeadlineBn: { type: String, default: 'শালীন স্টাইল, সৎ সৌন্দর্য।' },
      heroSubtext: {
        type: String,
        default:
          'Hijabs that hold their drape, skincare that respects your barrier, and colour that lasts through a Dhaka afternoon.',
      },
      heroCtaLabel: { type: String, default: 'Shop the collection' },
      heroCtaHref: { type: String, default: '/shop' },
      stats: [{ value: String, label: String }],
    },


    /**
     * The "limited time offers" band on the home page. Fully admin-managed:
     * the whole section can be hidden, and each offer is created here rather
     * than in code.
     */
    promotions: {
      enabled: { type: Boolean, default: true },
      heading: { type: String, default: 'Limited time offers' },
      headingBn: { type: String, default: 'সীমিত সময়ের অফার' },
      subheading: { type: String, default: 'Ends when the timer does — no extensions.' },
      offers: [
        {
          title: String,
          titleBn: String,
          eyebrow: String,
          eyebrowBn: String,
          body: String,
          bodyBn: String,
          ctaLabel: String,
          ctaHref: String,
          badge: String,
          /** 'large' takes the wide slot; 'compact' stacks in the side column. */
          layout: { type: String, enum: ['large', 'compact'], default: 'compact' },
          imageUrl: String,
          art: { shape: { type: String, default: 'giftbox' }, hue: { type: Number, default: 330 } },
          theme: { type: String, enum: ['plum', 'ink', 'sand', 'blush'], default: 'plum' },
          countdownEnabled: { type: Boolean, default: false },
          /** Blank end date = a timer that resets at midnight each day. */
          endsAt: Date,
          enabled: { type: Boolean, default: true },
          order: { type: Number, default: 0 },
        },
      ],
    },

    seo: {
      metaTitle: { type: String, default: 'Goods by Sadia — Hijabs, Skincare & Cosmetics' },
      metaDescription: { type: String, default: '' },
      ogImageUrl: { type: String, default: '' },
      keywords: [String],
    },

    policies: [
      {
        slug: String,
        title: String,
        lead: String,
        updated: String,
        sections: [{ heading: String, body: [String] }],
      },
    ],

    faqs: [{ q: String, a: String, qBn: String, aBn: String }],
  },
  { timestamps: true },
)

/**
 * Never ship raw credentials to the browser. The admin UI receives a masked
 * placeholder and a `*Set` boolean; submitting the mask back is ignored.
 */
settingsSchema.methods.toClientJSON = function ({ includeAdminFields = false } = {}) {
  const obj = this.toObject({ virtuals: true })

  const scrub = (node, secretKeys) => {
    secretKeys.forEach((k) => {
      if (node && k in node) {
        const raw = node[k]
        delete node[k]
        // Only the admin needs to know whether a credential is stored.
        if (includeAdminFields) {
          node[`${k}Set`] = Boolean(raw)
          node[k] = maskSecret(raw)
        }
      }
    })
  }

  scrub(obj.payments?.sslcommerz, ['storePassword'])
  scrub(obj.payments?.bkash, ['password', 'appSecret'])
  scrub(obj.integrations?.meta, ['appSecret'])
  scrub(obj.integrations?.meta?.whatsapp, ['accessToken'])
  scrub(obj.integrations?.meta?.messenger, ['pageAccessToken'])
  scrub(obj.integrations?.meta?.instagram, ['accessToken'])
  scrub(obj.couriers?.steadfast, ['apiKey', 'secretKey'])
  scrub(obj.couriers?.pathao, ['clientSecret', 'password'])
  scrub(obj.couriers?.redx, ['accessToken'])
  scrub(obj.integrations?.email, ['smtpPassword'])
  scrub(obj.integrations?.sms, ['apiKey'])

  if (!includeAdminFields) {
    // Public storefront gets no integration or courier config at all.
    delete obj.integrations
    delete obj.couriers
    delete obj.notifications
    delete obj.invoice
    delete obj.payments.sslcommerz.storeId
    delete obj.payments.bkash.username
    delete obj.payments.bkash.appKey
  }

  return obj
}

settingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ key: 'primary' })
  if (!doc) doc = await this.create({ key: 'primary' })
  return doc
}

export const Settings = mongoose.model('Settings', settingsSchema)
