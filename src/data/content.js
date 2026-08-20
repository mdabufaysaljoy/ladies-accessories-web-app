export const BRAND = {
  name: 'Goods by Sadia',
  short: 'GBS',
  tagline: 'Hijabs, skin & colour — chosen with care.',
  phone: '+880 1712-345678',
  whatsapp: '8801712345678',
  email: 'hello@goodsbysadia.com',
  address: 'House 42, Road 11, Banani, Dhaka 1213, Bangladesh',
  hours: 'Sat–Thu, 10:00 – 20:00',
  socials: [
    { name: 'Facebook', href: 'https://facebook.com/goodsbysadia' },
    { name: 'Instagram', href: 'https://instagram.com/goodsbysadia' },
    { name: 'TikTok', href: 'https://tiktok.com/@goodsbysadia' },
    { name: 'YouTube', href: 'https://youtube.com/@goodsbysadia' },
  ],
}

export const ANNOUNCEMENTS = [
  'Free delivery on orders over ৳2,000',
  'Cash on delivery available nationwide',
  '100% authentic — or your money back',
  'Same-day dispatch inside Dhaka before 4 PM',
]

export const TRUST_POINTS = [
  {
    icon: 'truck',
    title: 'Free delivery over ৳2,000',
    body: 'Dhaka in 1–2 days, nationwide in 2–4.',
  },
  {
    icon: 'cash',
    title: 'Cash on delivery',
    body: 'Pay the courier. No advance needed.',
  },
  {
    icon: 'shield',
    title: '100% authentic',
    body: 'Sourced direct. Verified batch codes.',
  },
  {
    icon: 'refresh',
    title: '7-day easy return',
    body: 'Unopened items, no questions asked.',
  },
]

export const TESTIMONIALS = [
  {
    name: 'Nusrat J.',
    location: 'Dhanmondi, Dhaka',
    rating: 5,
    product: 'Signature Georgette Hijab',
    body: 'I have bought georgette from six different pages. This one is genuinely different — it does not slip, and after eight washes the colour is exactly the same. I ordered four more.',
  },
  {
    name: 'Farhana R.',
    location: 'Chattogram',
    rating: 5,
    product: 'Invisible Sunscreen SPF 50+',
    body: 'Finally a sunscreen with no white cast on my skin tone. I wear it under foundation every day and nothing pills. Delivery to Chattogram took three days, packed properly.',
  },
  {
    name: 'Sumaiya A.',
    location: 'Uttara, Dhaka',
    rating: 5,
    product: 'Rosemary Scalp Growth Oil',
    body: 'My edges were thinning from wearing a scarf every day. Three months of using this twice a week and there is real regrowth. The nozzle makes it so much easier to apply.',
  },
  {
    name: 'Tasnim H.',
    location: 'Sylhet',
    rating: 4,
    product: 'Velvet Matte Lipstick',
    body: 'Rosewood is my everyday shade now. It lasted through lunch and a whole afternoon of meetings. Cash on delivery made it easy to try without risk.',
  },
  {
    name: 'Ayesha K.',
    location: 'Mirpur, Dhaka',
    rating: 5,
    product: 'Self-Care Sunday Bundle',
    body: 'Sent this to my sister for her birthday. The packaging is beautiful — she thought I spent twice as much. Sadia even wrote the gift note by hand.',
  },
  {
    name: 'Rumana S.',
    location: 'Rajshahi',
    rating: 5,
    product: 'Niacinamide 10% Clarity Serum',
    body: 'My acne marks have faded noticeably in about five weeks. No irritation at all, and it layers well with everything else. Real product, real results.',
  },
]

export const FAQS = [
  {
    q: 'How long does delivery take?',
    a: 'Inside Dhaka: 1–2 working days. Outside Dhaka: 2–4 working days. Orders placed before 4:00 PM are dispatched the same day. You will receive an SMS with your courier tracking number as soon as the parcel leaves us.',
  },
  {
    q: 'Is cash on delivery available everywhere?',
    a: 'Yes. Cash on delivery is available in all 64 districts of Bangladesh. You pay the courier in cash when the parcel reaches you. For orders above ৳5,000 we ask for a ৳200 advance to confirm the order, which is deducted from the total.',
  },
  {
    q: 'Which online payment methods do you accept?',
    a: 'We use SSLCommerz, so you can pay with bKash, Nagad, Rocket, Upay, any Bangladeshi bank card (Visa, Mastercard, Amex, DBBL Nexus) or internet banking. Every transaction is processed on SSLCommerz’s secure servers — we never see or store your card details.',
  },
  {
    q: 'Are your cosmetics and skincare authentic?',
    a: 'Yes, without exception. We source directly from authorised distributors and every unit carries a verifiable batch code and expiry date. If any product you receive from us is not authentic, we will refund you in full and let you keep the item.',
  },
  {
    q: 'Can I return or exchange an item?',
    a: 'You may return any unopened, unused item with its seal intact within 7 days of delivery. Hijabs may be exchanged for a different colour or size within 7 days provided the tags are attached. For hygiene reasons, opened cosmetics and skincare cannot be returned unless the product is faulty or you received the wrong item.',
  },
  {
    q: 'What if my product arrives damaged or wrong?',
    a: 'Record a video while opening the parcel and message us on WhatsApp within 48 hours. We will arrange a free replacement and cover the return courier charge. The unboxing video is the only thing we ask for.',
  },
  {
    q: 'How do I know which hijab fabric to choose?',
    a: 'Jersey for everyday, pin-free wear. Georgette for a structured drape that holds a style. Chiffon for occasions and photographs. Cotton voile for the hottest months. Message us on WhatsApp with your usual routine and we will recommend the right one.',
  },
  {
    q: 'Do you deliver outside Bangladesh?',
    a: 'Not yet. We currently ship within Bangladesh only. International shipping is planned for 2027 — join the newsletter and we will tell you when it opens.',
  },
]

/** Delivery zones — used by checkout to compute shipping. */
export const DELIVERY_ZONES = [
  { id: 'dhaka-city', label: 'Inside Dhaka City', charge: 70, eta: '1–2 working days' },
  { id: 'dhaka-sub', label: 'Dhaka Suburb / Savar / Keraniganj', charge: 100, eta: '2–3 working days' },
  { id: 'outside', label: 'Outside Dhaka (all districts)', charge: 130, eta: '2–4 working days' },
]

export const FREE_SHIPPING_THRESHOLD = 2000

/** Demo coupons. In production these would be validated server-side. */
export const COUPONS = [
  { code: 'SADIA10', type: 'percent', value: 10, min: 1000, label: '10% off orders over ৳1,000' },
  { code: 'HIJAB200', type: 'flat', value: 200, min: 1500, label: '৳200 off orders over ৳1,500' },
  { code: 'FREESHIP', type: 'shipping', value: 0, min: 1200, label: 'Free delivery over ৳1,200' },
]

export const DISTRICTS = [
  'Dhaka', 'Chattogram', 'Khulna', 'Rajshahi', 'Sylhet', 'Barishal', 'Rangpur', 'Mymensingh',
  'Gazipur', 'Narayanganj', 'Cumilla', 'Bogura', 'Jashore', 'Cox’s Bazar', 'Dinajpur',
  'Faridpur', 'Kushtia', 'Noakhali', 'Pabna', 'Tangail', 'Brahmanbaria', 'Feni', 'Jamalpur',
  'Naogaon', 'Netrokona', 'Nilphamari', 'Patuakhali', 'Rangamati', 'Satkhira', 'Sirajganj',
]

export const ROUTINE_STEPS = [
  {
    step: '01',
    title: 'Cleanse',
    body: 'Amino-acid gel that takes off sunscreen and city grime without leaving your skin tight.',
    productSlug: 'gentle-amino-cleanser',
  },
  {
    step: '02',
    title: 'Treat',
    body: 'Niacinamide to fade marks and hold oil back through the afternoon.',
    productSlug: 'niacinamide-10-clarity-serum',
  },
  {
    step: '03',
    title: 'Protect',
    body: 'SPF 50+ that disappears on every skin tone — the step that does the most work.',
    productSlug: 'invisible-sunscreen-spf50',
  },
]
