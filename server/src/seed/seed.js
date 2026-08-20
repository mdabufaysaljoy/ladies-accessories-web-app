import mongoose from 'mongoose'
import { connectDb } from '../config/db.js'
import { Settings } from '../models/Settings.js'
import { Category } from '../models/Category.js'
import { Product } from '../models/Product.js'
import { Coupon } from '../models/Coupon.js'
import { AdminUser } from '../models/AdminUser.js'
import { Conversation } from '../models/Conversation.js'
import { Subscriber } from '../models/Subscriber.js'
import { Order } from '../models/Order.js'
import { Customer } from '../models/Customer.js'
import { Review } from '../models/Review.js'
import { CATEGORIES, PRODUCTS } from './catalog.js'

const fresh = process.argv.includes('--fresh')

const DEFAULT_SETTINGS = {
  socials: [
    { name: 'Facebook', href: 'https://facebook.com/goodsbysadia', icon: 'facebook', enabled: true },
    { name: 'Instagram', href: 'https://instagram.com/goodsbysadia', icon: 'instagram', enabled: true },
    { name: 'TikTok', href: 'https://tiktok.com/@goodsbysadia', icon: 'tiktok', enabled: true },
    { name: 'YouTube', href: 'https://youtube.com/@goodsbysadia', icon: 'youtube', enabled: true },
  ],
  announcements: [
    { text: 'Free delivery on orders over ৳2,000', textBn: '২০০০৳ এর উপরে ফ্রি ডেলিভারি', enabled: true },
    { text: 'Cash on delivery available nationwide', textBn: 'সারাদেশে ক্যাশ অন ডেলিভারি', enabled: true },
    { text: '100% authentic — or your money back', textBn: '১০০% অরিজিনাল — নয়তো টাকা ফেরত', enabled: true },
    { text: 'Same-day dispatch inside Dhaka before 4 PM', textBn: 'ঢাকায় বিকাল ৪টার আগে অর্ডারে সেইম-ডে ডেলিভারি', enabled: true },
  ],
  delivery: {
    freeShippingThreshold: 2000,
    codAdvanceThreshold: 5000,
    codAdvanceAmount: 200,
    returnWindowDays: 7,
    zones: [
      { id: 'dhaka-city', label: 'Inside Dhaka City', labelBn: 'ঢাকা সিটির ভিতরে', charge: 70, eta: '1–2 working days', etaBn: '১–২ কর্মদিবস', enabled: true },
      { id: 'dhaka-sub', label: 'Dhaka Suburb / Savar / Keraniganj', labelBn: 'ঢাকা সাবএরিয়া / সাভার / কেরানীগঞ্জ', charge: 100, eta: '2–3 working days', etaBn: '২–৩ কর্মদিবস', enabled: true },
      { id: 'outside', label: 'Outside Dhaka (all districts)', labelBn: 'ঢাকার বাইরে (সব জেলা)', charge: 130, eta: '2–4 working days', etaBn: '২–৪ কর্মদিবস', enabled: true },
    ],
    couriers: [
      { name: 'Steadfast Courier', enabled: true },
      { name: 'Pathao Courier', enabled: true },
      { name: 'RedX', enabled: true },
      { name: 'Sundarban Courier', enabled: true },
      { name: 'Own rider (Dhaka)', enabled: true },
    ],
  },
  couriers: {
    autoCreateConsignment: false,
    defaultProvider: 'steadfast',
    statusSyncMinutes: 60,
  },
  notifications: {
    emailAdminOnNewOrder: true,
    emailCustomerOnNewOrder: true,
    emailCustomerOnStatusChange: true,
    adminNotifyEmail: '',
  },
  invoice: {
    prefix: 'INV',
    nextNumber: 1001,
    footerNote: 'Thank you for shopping with us. Please record a video while opening your parcel.',
    termsNote: 'Unopened items may be returned within 7 days. Opened cosmetics cannot be returned for hygiene reasons.',
    showLogo: true,
    signatureName: 'Goods by Sadia',
  },
  promotions: {
    enabled: true,
    heading: 'Limited time offers',
    headingBn: 'সীমিত সময়ের অফার',
    subheading: 'Ends when the timer does — no extensions.',
    offers: [
      {
        eyebrow: 'Limited — today only',
        eyebrowBn: 'শুধু আজকের জন্য',
        title: 'Up to 30% off the hijab edit',
        titleBn: 'হিজাব কালেকশনে ৩০% পর্যন্ত ছাড়',
        body: 'Georgette, jersey, chiffon and voile — every fabric we make, reduced until midnight.',
        bodyBn: 'জর্জেট, জার্সি, শিফন ও ভয়েল — সব কাপড়ে ছাড়, মধ্যরাত পর্যন্ত।',
        ctaLabel: 'Shop the edit',
        ctaHref: '/shop/hijabs',
        layout: 'large',
        theme: 'plum',
        art: { shape: 'hijab', hue: 275 },
        countdownEnabled: true,
        enabled: true,
        order: 0,
      },
      {
        eyebrow: 'Gifting',
        eyebrowBn: 'উপহার',
        title: 'Ready-to-give bundles',
        titleBn: 'উপহারের জন্য প্রস্তুত বক্স',
        body: 'Boxed, ribboned and packed with a handwritten note — send it straight to her door.',
        bodyBn: 'বক্স, ফিতা ও হাতে লেখা কার্ডসহ — সরাসরি পৌঁছে যাবে।',
        ctaLabel: 'Browse gift sets',
        ctaHref: '/shop?filter=gift',
        badge: 'Gifting',
        layout: 'compact',
        theme: 'sand',
        art: { shape: 'giftbox', hue: 335 },
        countdownEnabled: false,
        enabled: true,
        order: 1,
      },
    ],
  },
  storefront: {
    stats: [
      { value: '12,000+', label: 'Orders delivered' },
      { value: '4.9 / 5', label: 'Average rating' },
      { value: '64', label: 'Districts served' },
    ],
  },
  faqs: [
    { q: 'How long does delivery take?', a: 'Inside Dhaka: 1–2 working days. Outside Dhaka: 2–4 working days. Orders placed before 4:00 PM are dispatched the same day. You will receive an SMS with your courier tracking number as soon as the parcel leaves us.', qBn: 'ডেলিভারিতে কত সময় লাগে?', aBn: 'ঢাকার ভিতরে ১–২ কর্মদিবস, ঢাকার বাইরে ২–৪ কর্মদিবস। বিকাল ৪টার আগে অর্ডার করলে একই দিনে পাঠানো হয়।' },
    { q: 'Is cash on delivery available everywhere?', a: 'Yes. Cash on delivery is available in all 64 districts of Bangladesh. You pay the courier in cash when the parcel reaches you. For orders above ৳5,000 we ask for a ৳200 advance to confirm the order, which is deducted from the total.', qBn: 'ক্যাশ অন ডেলিভারি কি সব জায়গায় আছে?', aBn: 'হ্যাঁ, ৬৪ জেলাতেই ক্যাশ অন ডেলিভারি আছে। ৫০০০৳ এর উপরে অর্ডারে ২০০৳ অ্যাডভান্স লাগে, যা মোট বিল থেকে বাদ যায়।' },
    { q: 'Which online payment methods do you accept?', a: 'You can pay with bKash (Send Money or app checkout), Nagad, Rocket, Upay, or any Bangladeshi bank card via SSLCommerz. Every card transaction is processed on SSLCommerz’s secure servers — we never see or store your card details.', qBn: 'কোন অনলাইন পেমেন্ট নেওয়া হয়?', aBn: 'বিকাশ, নগদ, রকেট, উপায় এবং যেকোনো ব্যাংক কার্ড (SSLCommerz এর মাধ্যমে)।' },
    { q: 'Are your cosmetics and skincare authentic?', a: 'Yes, without exception. We source directly from authorised distributors and every unit carries a verifiable batch code and expiry date. If any product you receive from us is not authentic, we will refund you in full and let you keep the item.', qBn: 'পণ্য কি অরিজিনাল?', aBn: 'হ্যাঁ, ১০০% অরিজিনাল। প্রতিটি পণ্যে ব্যাচ কোড ও এক্সপায়ারি ডেট আছে।' },
    { q: 'Can I return or exchange an item?', a: 'You may return any unopened, unused item with its seal intact within 7 days of delivery. Hijabs may be exchanged for a different colour or size within 7 days provided the tags are attached. For hygiene reasons, opened cosmetics and skincare cannot be returned unless the product is faulty or you received the wrong item.', qBn: 'পণ্য ফেরত বা পরিবর্তন করা যাবে?', aBn: '৭ দিনের মধ্যে সিল না খোলা পণ্য ফেরত দেওয়া যাবে। হিজাব ট্যাগসহ থাকলে রঙ বা সাইজ বদলানো যাবে।' },
    { q: 'What if my product arrives damaged or wrong?', a: 'Record a video while opening the parcel and message us on WhatsApp within 48 hours. We will arrange a free replacement and cover the return courier charge. The unboxing video is the only thing we ask for.', qBn: 'ভুল বা নষ্ট পণ্য পেলে কী করব?', aBn: 'পার্সেল খোলার সময় ভিডিও করুন এবং ৪৮ ঘণ্টার মধ্যে হোয়াটসঅ্যাপে জানান। আমরা ফ্রি রিপ্লেসমেন্ট দেব।' },
    { q: 'How do I know which hijab fabric to choose?', a: 'Jersey for everyday, pin-free wear. Georgette for a structured drape that holds a style. Chiffon for occasions and photographs. Cotton voile for the hottest months. Message us on WhatsApp with your usual routine and we will recommend the right one.', qBn: 'কোন হিজাব কাপড় নেব?', aBn: 'প্রতিদিনের জন্য জার্সি, স্টাইলিং এর জন্য জর্জেট, অনুষ্ঠানের জন্য শিফন, গরমে কটন ভয়েল।' },
    { q: 'Do you deliver outside Bangladesh?', a: 'Not yet. We currently ship within Bangladesh only. International shipping is planned for 2027 — join the newsletter and we will tell you when it opens.', qBn: 'দেশের বাইরে ডেলিভারি হয়?', aBn: 'এখনো নয়। ২০২৭ সালে আন্তর্জাতিক ডেলিভারি চালুর পরিকল্পনা আছে।' },
  ],
  policies: [
    {
      slug: 'shipping', title: 'Delivery & shipping', lead: 'Where we deliver, what it costs and how long it takes.', updated: '1 August 2026',
      sections: [
        { heading: 'Coverage', body: ['We deliver to all 64 districts of Bangladesh. Orders inside Dhaka City are handled by our own rider network; everywhere else we use Steadfast, Pathao and RedX.', 'We do not currently ship outside Bangladesh. International delivery is planned for 2027.'] },
        { heading: 'Charges and timing', body: ['Delivery is free on every order over ৳2,000, regardless of zone.', 'Orders confirmed before 4:00 PM are dispatched the same working day. We are closed on Fridays, so Thursday afternoon orders leave on Saturday.'] },
        { heading: 'Tracking', body: ['You will receive an SMS with your courier tracking number as soon as the parcel leaves our studio, and a call from us before dispatch to confirm you will be available.', 'You can also look your order up any time on the tracking page using your order number and mobile number.'] },
        { heading: 'Failed deliveries', body: ['Couriers attempt delivery twice. If both attempts fail because the number is unreachable, the parcel returns to us and we will contact you to arrange redelivery.', 'Repeated refusal of cash-on-delivery parcels without notice may mean we ask for advance payment on future orders.'] },
      ],
    },
    {
      slug: 'returns', title: 'Returns & exchange', lead: 'Seven days, no interrogation — with sensible limits for hygiene.', updated: '1 August 2026',
      sections: [
        { heading: 'What can be returned', body: ['Any unopened, unused item with its seal and tags intact may be returned within 7 days of delivery for a full refund.', 'Hijabs can be exchanged for a different colour or size within 7 days, provided tags are attached and the item has not been worn or washed.'] },
        { heading: 'What cannot be returned', body: ['For hygiene reasons, opened cosmetics and skincare cannot be returned unless the product is faulty, expired or not what you ordered.', 'Inner caps, hijab pins and earrings cannot be returned once the packaging is opened.', 'Gift sets must be returned complete — individual items from a set cannot be returned separately.'] },
        { heading: 'Damaged, wrong or faulty items', body: ['Record a video while opening your parcel. If anything is damaged, missing or wrong, send us that video on WhatsApp within 48 hours of delivery.', 'We will send a free replacement and cover the return courier charge. The unboxing video is the only thing we ask for — there is no further process.'] },
        { heading: 'How to start a return', body: ['Message us on WhatsApp with your order number and a photograph of the item. We will confirm and arrange collection or share the return address.', 'Refunds are issued to the original payment method within 5–7 working days of us receiving the item. Cash-on-delivery orders are refunded by bKash or bank transfer.'] },
      ],
    },
    {
      slug: 'privacy', title: 'Privacy policy', lead: 'What we collect, why, and what we will never do with it.', updated: '1 August 2026',
      sections: [
        { heading: 'What we collect', body: ['To fulfil an order we collect your name, mobile number, delivery address and — if you provide one — your email address.', 'Your shopping bag and wishlist are stored in your own browser on your device. They are not uploaded to us until you place an order.'] },
        { heading: 'Payment information', body: ['We never see, handle or store your card, bKash or bank credentials. Online payments are processed entirely on SSLCommerz’s and bKash’s PCI DSS compliant servers.', 'What we receive back is a transaction reference and a success or failure status — nothing more.'] },
        { heading: 'How we use it', body: ['Your details are used to process, pack and deliver your order, and to contact you about it. We share your name, address and number with our courier partner solely for that delivery.', 'If you subscribe to our newsletter we will email you about new products and offers. Every email has a one-click unsubscribe link.'] },
        { heading: 'What we will never do', body: ['We do not sell, rent or trade your personal information to anyone, for any price.', 'We do not send marketing SMS to customers who have not asked for it.'] },
      ],
    },
    {
      slug: 'terms', title: 'Terms of service', lead: 'The agreement between you and Goods by Sadia.', updated: '1 August 2026',
      sections: [
        { heading: 'Orders', body: ['Placing an order is an offer to buy. The order is accepted once we confirm it by phone or SMS, and a contract exists only from that point.', 'We may decline or cancel an order if the item is out of stock, the price was listed in error, or the delivery address falls outside our courier network. In every case you will be refunded in full.'] },
        { heading: 'Pricing', body: ['All prices are in Bangladeshi Taka and include VAT where applicable. Delivery is charged separately unless your order qualifies for free delivery.', 'We do not inflate an "original" price to make a discount appear larger. A struck-through price is a price the item has genuinely been sold at.'] },
        { heading: 'Cash on delivery', body: ['Cash on delivery is available nationwide. Orders above ৳5,000 require a ৳200 advance to confirm, which is deducted from the amount due to the courier.', 'Please keep the exact amount ready. Couriers frequently cannot provide change.'] },
        { heading: 'Product information', body: ['We describe colours, sizes and formulations as accurately as we can, but screens vary and fabric dye lots differ slightly between batches.', 'Nothing on this site is medical advice. If you have a skin condition or a known allergy, patch test first and consult a dermatologist.'] },
        { heading: 'Governing law', body: ['These terms are governed by the laws of Bangladesh, and any dispute falls under the jurisdiction of the courts of Dhaka.'] },
      ],
    },
  ],
}

const COUPONS = [
  { code: 'SADIA10', label: '10% off orders over ৳1,000', type: 'percent', value: 10, minSpend: 1000, maxDiscount: 500, active: true },
  { code: 'HIJAB200', label: '৳200 off orders over ৳1,500', type: 'flat', value: 200, minSpend: 1500, active: true },
  { code: 'FREESHIP', label: 'Free delivery over ৳1,200', type: 'shipping', value: 0, minSpend: 1200, active: true },
  { code: 'EID25', label: '25% off — Eid special', type: 'percent', value: 25, minSpend: 2500, maxDiscount: 1200, active: true },
]

const DEMO_CHATS = [
  {
    channel: 'whatsapp', externalId: '8801711223344',
    contact: { name: 'Nusrat Jahan', phone: '8801711223344' },
    messages: [
      { direction: 'in', text: 'Assalamu alaikum, georgette hijab ta ki stock e ache?', minsAgo: 46 },
      { direction: 'out', text: 'Walaikum assalam! Yes, Signature Georgette is in stock in all 6 colours. Which one would you like?', minsAgo: 42, sentBy: 'Sadia' },
      { direction: 'in', text: 'Dusty rose ta nibo. Delivery charge koto Mirpur e?', minsAgo: 38 },
    ],
  },
  {
    channel: 'messenger', externalId: 'psid-4471928',
    contact: { name: 'Farhana Rahman' },
    messages: [
      { direction: 'in', text: 'Hi! Is the sunscreen suitable for oily skin?', minsAgo: 190 },
      { direction: 'out', text: 'Yes — it finishes completely matte and is non-comedogenic. It is our best seller for oily skin in this weather.', minsAgo: 185, sentBy: 'Sadia' },
      { direction: 'in', text: 'Perfect, I will order tonight. Thank you!', minsAgo: 180 },
    ],
  },
  {
    channel: 'instagram', externalId: 'igsid-88211',
    contact: { name: 'sumaiya.akter', username: 'sumaiya.akter' },
    messages: [
      { direction: 'in', text: 'oi rosemary oil ta ki really kaj kore? 🥺', minsAgo: 620 },
      { direction: 'out', text: 'Most customers see less shedding in 4–6 weeks with 2–3 uses a week. It is not instant, but it is consistent.', minsAgo: 610, sentBy: 'Sadia' },
      { direction: 'in', text: 'ok ordering 200ml one', minsAgo: 600 },
    ],
  },
  {
    channel: 'whatsapp', externalId: '8801855667788',
    contact: { name: 'Tasnim Haque', phone: '8801855667788' },
    messages: [{ direction: 'in', text: 'Amar order GBS-XXXX kobe pabo?', minsAgo: 12 }],
  },
]

async function seed() {
  await connectDb()

  if (fresh) {
    console.log('[seed] --fresh: dropping collections')
    await Promise.all([
      Category.deleteMany({}), Product.deleteMany({}), Coupon.deleteMany({}),
      Conversation.deleteMany({}), Subscriber.deleteMany({}), Order.deleteMany({}),
      Customer.deleteMany({}), Review.deleteMany({}), Settings.deleteMany({}),
    ])
  }

  /* ------------------------------- settings ------------------------------ */
  const settings = await Settings.getSingleton()
  if (fresh || !settings.delivery?.zones?.length) {
    Object.assign(settings, DEFAULT_SETTINGS)
    await settings.save()
    console.log('[seed] settings initialised')
  }

  /* ------------------------------ admin user ----------------------------- */
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@goodsbysadia.com').toLowerCase()
  let owner = await AdminUser.findOne({ email })
  if (!owner) {
    owner = new AdminUser({
      name: process.env.SEED_ADMIN_NAME ?? 'Sadia',
      email,
      role: 'owner',
    })
    await owner.setPassword(process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!')
    await owner.save()
    console.log(`[seed] owner created → ${email} / ${process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'}`)
  }

  /* ------------------------------ categories ----------------------------- */
  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate({ slug: cat.slug }, { $set: cat }, { upsert: true, new: true, setDefaultsOnInsert: true })
  }
  console.log(`[seed] ${CATEGORIES.length} categories`)

  /* ------------------------------- products ------------------------------ */
  let created = 0
  for (const p of PRODUCTS) {
    const res = await Product.findOneAndUpdate(
      { slug: p.slug },
      { $set: { ...p, status: 'active' } },
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true },
    )
    if (res?.lastErrorObject?.upserted) created += 1
  }
  console.log(`[seed] ${PRODUCTS.length} products (${created} new)`)

  /* -------------------------------- coupons ------------------------------ */
  for (const c of COUPONS) {
    await Coupon.findOneAndUpdate({ code: c.code }, { $set: c }, { upsert: true, setDefaultsOnInsert: true })
  }
  console.log(`[seed] ${COUPONS.length} coupons`)

  /* ------------------------------ demo inbox ----------------------------- */
  if ((await Conversation.countDocuments()) === 0) {
    for (const chat of DEMO_CHATS) {
      const convo = new Conversation({
        channel: chat.channel,
        externalId: chat.externalId,
        contact: chat.contact,
      })
      chat.messages.forEach((m) =>
        convo.appendMessage({
          direction: m.direction,
          text: m.text,
          sentBy: m.sentBy,
          status: m.direction === 'in' ? 'delivered' : 'sent',
          simulated: m.direction === 'out',
          at: new Date(Date.now() - m.minsAgo * 60 * 1000),
        }),
      )
      await convo.save()
    }
    console.log(`[seed] ${DEMO_CHATS.length} demo conversations`)
  }

  /* ----------------------------- subscribers ----------------------------- */
  if ((await Subscriber.countDocuments()) === 0) {
    await Subscriber.insertMany(
      ['nusrat@example.com', 'farhana@example.com', 'sumaiya@example.com', 'tasnim@example.com', 'ayesha@example.com']
        .map((e) => ({ email: e, source: 'seed' })),
    )
    console.log('[seed] 5 demo subscribers')
  }

  /* ------------------------------ demo orders ---------------------------- */
  if ((await Order.countDocuments()) === 0) {
    const products = await Product.find({ status: 'active' }).limit(12)
    const zones = settings.delivery.zones
    const buyers = [
      { name: 'Nusrat Jahan', phone: '8801711223344', district: 'Dhaka', area: 'Dhanmondi', email: 'nusrat@example.com' },
      { name: 'Farhana Rahman', phone: '8801822334455', district: 'Chattogram', area: 'Panchlaish', email: 'farhana@example.com' },
      { name: 'Sumaiya Akter', phone: '8801933445566', district: 'Dhaka', area: 'Uttara' },
      { name: 'Tasnim Haque', phone: '8801855667788', district: 'Sylhet', area: 'Zindabazar', email: 'tasnim@example.com' },
      { name: 'Ayesha Karim', phone: '8801766778899', district: 'Dhaka', area: 'Mirpur 10' },
    ]
    const statuses = ['delivered', 'delivered', 'shipped', 'confirmed', 'pending', 'delivered', 'packed', 'cancelled']
    const methods = ['cod', 'cod', 'bkash-manual', 'cod', 'sslcommerz', 'cod', 'bkash-manual', 'cod']

    for (let i = 0; i < 24; i++) {
      const buyer = buyers[i % buyers.length]
      const zone = zones[i % zones.length]
      const picks = [products[i % products.length], products[(i * 3 + 2) % products.length]].filter(Boolean)
      const lines = picks.map((p, n) => ({
        product: p._id, slug: p.slug, name: p.name, sku: p.sku,
        price: p.price, compareAt: p.compareAt, qty: (n % 2) + 1,
        color: p.colors?.[0]?.name ?? null, size: p.sizes?.[0]?.label ?? null, art: p.art,
      }))
      const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
      const shipping = subtotal >= 2000 ? 0 : zone.charge
      const status = statuses[i % statuses.length]
      const method = methods[i % methods.length]
      const placedAt = new Date(Date.now() - i * 1.6 * 24 * 60 * 60 * 1000)

      const order = new Order({
        customer: { ...buyer, address: `House ${20 + i}, Road ${3 + (i % 12)}, ${buyer.area}` },
        lines,
        delivery: { zoneId: zone.id, zoneLabel: zone.label, eta: zone.eta, charge: shipping, courier: i % 3 === 0 ? 'Steadfast Courier' : 'Pathao Courier' },
        totals: { subtotal, discount: 0, shipping, total: subtotal + shipping },
        payment: {
          method,
          status: status === 'delivered' ? 'paid' : method === 'sslcommerz' ? 'paid' : 'unpaid',
          channel: method === 'bkash-manual' ? 'bKash (manual)' : method === 'sslcommerz' ? 'Visa' : '',
          amountPaid: status === 'delivered' || method === 'sslcommerz' ? subtotal + shipping : 0,
          paidAt: status === 'delivered' ? placedAt : undefined,
        },
        status,
        source: i % 7 === 0 ? 'whatsapp' : 'web',
        createdAt: placedAt,
      })
      order.timeline = [{ status: 'pending', note: 'Order placed', by: 'system', at: placedAt }]
      if (status !== 'pending') order.timeline.push({ status, note: 'Seeded demo order', by: 'system', at: placedAt })
      await order.save()

      await Customer.findOneAndUpdate(
        { phone: buyer.phone },
        {
          $setOnInsert: { phone: buyer.phone },
          $set: { name: buyer.name, email: buyer.email, district: buyer.district, area: buyer.area, lastOrderAt: placedAt },
          $inc: { orderCount: 1, totalSpent: subtotal + shipping },
        },
        { upsert: true },
      )
    }
    console.log('[seed] 24 demo orders + customers')
  }

  /* ------------------------------ demo reviews --------------------------- */
  if ((await Review.countDocuments()) === 0) {
    const reviewSeeds = [
      { slug: 'signature-georgette-hijab', name: 'Nusrat J.', location: 'Dhanmondi, Dhaka', rating: 5, body: 'I have bought georgette from six different pages. This one is genuinely different — it does not slip, and after eight washes the colour is exactly the same. I ordered four more.' },
      { slug: 'invisible-sunscreen-spf50', name: 'Farhana R.', location: 'Chattogram', rating: 5, body: 'Finally a sunscreen with no white cast on my skin tone. I wear it under foundation every day and nothing pills. Delivery took three days, packed properly.' },
      { slug: 'rosemary-scalp-growth-oil', name: 'Sumaiya A.', location: 'Uttara, Dhaka', rating: 5, body: 'My edges were thinning from wearing a scarf every day. Three months of using this twice a week and there is real regrowth. The nozzle makes it so much easier to apply.' },
      { slug: 'velvet-matte-lipstick', name: 'Tasnim H.', location: 'Sylhet', rating: 4, body: 'Rosewood is my everyday shade now. It lasted through lunch and a whole afternoon of meetings. Cash on delivery made it easy to try without risk.' },
      { slug: 'niacinamide-10-clarity-serum', name: 'Rumana S.', location: 'Rajshahi', rating: 5, body: 'My acne marks have faded noticeably in about five weeks. No irritation at all, and it layers well with everything else. Real product, real results.' },
      { slug: 'everyday-nida-abaya', name: 'Ayesha K.', location: 'Mirpur, Dhaka', rating: 5, body: 'The Nida fabric is thick and completely opaque, which is exactly what I wanted. Sleeve length is generous. Ordered size 56 and it fits perfectly.' },
      { slug: 'oud-rose-attar', name: 'Marium B.', location: 'Khulna', rating: 5, body: 'Lasts genuinely 6+ hours on my wrist. Not overpowering — people ask what I am wearing. Worth the price.' },
      { slug: 'smudge-proof-kajal', name: 'Jarin T.', location: 'Bogura', rating: 5, body: 'I teach all day in the heat and it does not budge. No grey under-eye shadow at all. Buying three more.' },
    ]

    for (const r of reviewSeeds) {
      const product = await Product.findOne({ slug: r.slug })
      if (!product) continue
      await Review.create({ ...r, productSlug: r.slug, product: product._id, verified: true, status: 'published' })
    }
    console.log(`[seed] ${reviewSeeds.length} published reviews`)
  }

  console.log('\n[seed] done\n')
  await mongoose.disconnect()
}

seed().catch((error) => {
  console.error('[seed] failed:', error)
  process.exit(1)
})
