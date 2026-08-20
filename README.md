# Goods by Sadia

A full-stack Bangladeshi e-commerce platform: React storefront, admin panel, and
an Express + MongoDB API. Hijabs, skincare, hair care and cosmetics, with cash
on delivery, bKash and SSLCommerz, and a unified WhatsApp/Messenger/Instagram
inbox.

```bash
# 1. API  (needs MongoDB running on localhost:27017)
cd server
cp .env.example .env          # then edit the secrets
npm install
npm run seed                  # 5 categories, 41 products, demo orders + chats
npm run dev                   # http://localhost:4000

# 2. Storefront + admin
cd ..
npm install
npm run dev                   # http://localhost:5173
```

| | |
| --- | --- |
| Storefront | http://localhost:5173 |
| Admin panel | http://localhost:5173/admin |
| API health | http://localhost:4000/api/health |
| Demo login | `admin@goodsbysadia.com` / `ChangeMe123!` |

**Change that password immediately in any real deployment.**

Stack: React 19 · Vite 8 · React Router 7 · Tailwind 4 · Express 5 · Mongoose 8.

---

## Storefront

| Route | Purpose |
| --- | --- |
| `/` | Hero, categories, bestsellers, countdown offer, routine bundle, reviews |
| `/shop`, `/shop/:category` | Server-side filtering, sorting, pagination, facets |
| `/product/:slug` | Gallery, variants, specs, reviews, related, **quick order** |
| `/cart`, `/checkout` | Coupons, delivery zones, 3-step distraction-free checkout |
| `/order/:orderNumber` | Confirmation, timeline, printable receipt |
| `/track-order` | Order number **+ phone** lookup, works on any device |
| `/login` `/register` `/account` | Optional customer accounts — orders, saved addresses, profile |
| `/wishlist` `/about` `/contact` `/faq` `/policy/:slug` | Supporting pages |

### Built for the Bangladeshi market

- **Cash on delivery** nationwide, with a configurable advance above a threshold
  (protects against refused parcels)
- **bKash / Nagad "Send Money"** — customer sends manually and enters the TrxID,
  which the admin verifies before dispatch. This is how most BD shops actually
  operate, and it needs no merchant account
- **Quick order** — name, phone, address, done. No cart, no account, ~15 seconds
- **EN / বাংলা toggle**, with Bangla fields throughout the product and settings models
- **Delivery zones** — inside Dhaka / suburb / outside Dhaka, each with its own
  charge and ETA
- **Courier partners** — Steadfast, Pathao, RedX, Sundarban, own rider
- **Risk flags** — repeat COD refusers can be blocked from ordering again
- **WhatsApp-first support** throughout
- **Courier integration** — Steadfast, Pathao and RedX, with live tracking pulled
  from the courier's own API
- **Optional accounts** — signing in pre-fills checkout from a saved address,
  but guest checkout is always available and never gated

---

## Admin panel (`/admin`)

| Section | What it does |
| --- | --- |
| **Dashboard** | Revenue trend, orders by status, payment split, best sellers, low stock |
| **Orders** | COD + online, status flow, courier & tracking, manual payment confirmation, status emails, customer order history |
| **Products** | Full CRUD — title, both descriptions, detail bullets, structured specifications, colours, sizes, stock, SEO, artwork. Bulk publish/stock/archive, duplicate |
| **Categories** | CRUD with subcategories that become storefront filters |
| **Inbox** | WhatsApp, Messenger and Instagram threads in one place, with canned replies and the contact's order history beside each thread |
| **Customers** | Auto-built from orders, segments, lifetime value, risk flags, notes |
| **Reviews** | Moderate before publishing; product ratings recompute automatically |
| **Email** | Promotional campaigns to subscribers or customer segments, batched sending, live progress |
| **Offers** | The limited-time offers band on the home page — show/hide the whole section, create offers with countdowns, images, themes and links |
| **Coupons** | Percent / flat / free-shipping, minimum spend, caps, usage limits, expiry |
| **Media** | Drag-and-drop uploads, copy URL into any product |
| **Settings** | Brand identity, colours, contact, WhatsApp number, address, socials, announcements, delivery zones, **payment API keys**, integrations, SMTP, FAQ and policy pages |

Roles: `owner` · `admin` · `manager` · `support`, each with its own abilities.
Every settings and product change is written to an audit log.

### Everything on the storefront is editable

Brand name, tagline, logo, colours, phone, WhatsApp number, email, address,
opening hours, trade licence, social links, announcement bar, hero copy,
delivery zones and charges, FAQ, and all four policy pages come from the
settings document — nothing is hard-coded in the client.

---

## Couriers

| Provider | Auth | Status |
| --- | --- | --- |
| Steadfast | API key + secret key | Implemented against the live API |
| Pathao | OAuth2 (client credentials + merchant login) | Implemented against the live API |
| RedX | Access token + pickup store | Implemented against the live API |

Add credentials in **Settings → Couriers**. Each provider can be switched on
independently, and adding a fourth means writing one adapter and registering it
in `services/couriers/index.js` — nothing else in the codebase changes.

**What it does**

- Book a consignment from the order page, or automatically the moment an order
  is marked shipped (Settings → Couriers → *Automatically book the courier*)
- COD amount is calculated as what the courier still needs to collect, so an
  order already paid online is booked at ৳0 rather than charging twice
- The customer's tracking page pulls live status straight from the courier
- A background poller re-checks every in-flight parcel on the interval you set,
  and moves the order to *delivered* or *returned* on its own
- If the courier API is down, orders still place and ship — the failure is
  written to the order timeline instead of blocking anything

## Invoices

Every order gets an invoice number the moment it is placed (`INV-2026-01001`),
allocated with an atomic increment so two simultaneous orders can never collide.

- Branded with your logo, colours, address and trade licence, all from Settings
- Line items with variants and SKUs, totals, payment method, amount due on
  delivery, signature blocks and your own footer/terms wording
- Print or save as PDF from the admin order page, from the customer's account,
  or from the order confirmation
- Emailed to the customer automatically on order (toggleable)

Access is either an admin session or the order's own phone number
(`?phone=01…`), so guests can print their own invoice without an account while
nobody can enumerate order numbers to read someone else's details.

## Customer accounts

Accounts are **optional by design** — the entire shop works as a guest.

- Sign up with a mobile number and password; an existing guest record for that
  number is adopted, so past orders carry over instead of starting from zero
- Signing in pre-fills checkout from the default saved address, and only fills
  blanks so a half-typed form is never overwritten
- Saved addresses with a picker at checkout when there is more than one
- Order history with per-order invoice and tracking links
- Customer sessions use a separate cookie and token audience from admin
  sessions — a stolen shopper token cannot open the admin panel

---

## Payments

| Method | Status |
| --- | --- |
| Cash on delivery | Works out of the box |
| bKash / Nagad Send Money | Works out of the box — set your number in Settings → Payments |
| SSLCommerz | Add Store ID + password in Settings → Payments |
| bKash Checkout API | Add app key/secret + username/password in Settings → Payments |

**Security model.** Gateway credentials are encrypted (AES-256-GCM) before being
stored and are never sent to the browser — the admin UI only ever sees a mask.
Every online payment is confirmed by a server-to-server validation call
(`val_id` for SSLCommerz, `/execute` for bKash) before an order is marked paid;
the redirect back from the gateway is treated as untrusted, and an underpayment
fails the order. Order totals are always recomputed on the server from database
prices, so a tampered cart cannot change what is charged.

---

## Chat inbox

WhatsApp Cloud API, Messenger and Instagram all deliver to one webhook:

```
POST /api/inbox/webhook/meta
```

Add your Meta app secret, verify token and per-channel tokens in
**Settings → Integrations**, then point Meta's webhook at that URL (it must be
publicly reachable over HTTPS — use ngrok for local testing). Inbound payloads
are verified against `X-Hub-Signature-256`.

Without tokens the inbox runs in **demo mode**: replies are saved to the thread
and clearly labelled as not delivered, so the UI is fully usable before Meta
business verification completes.

---

## Email

Order status changes (confirmed, packed, shipped, delivered, cancelled) and
payment receipts send automatically when SMTP is configured in
**Settings → Email**. Campaigns send in batches of 20 with a pause between them,
because shared SMTP hosts throttle bursts and can flag the whole domain.

Without SMTP, everything is composed and logged but not sent, and the UI says so.

**Order notifications** (Settings → Couriers → *Order notifications*):

- Email the shop when a customer orders — items, address and payment method
- Email the customer their invoice on order
- Email the customer on every status change, with the tracking link once shipped

Each is independently switchable.

---

## What still needs doing before going live

- **Change `JWT_SECRET`, `SECRET_ENCRYPTION_KEY` and the admin password.** The
  server refuses to boot in production with the default secrets, but the seeded
  admin password is not checked — change it.
- `SECRET_ENCRYPTION_KEY` must be set once and never rotated casually; changing
  it makes previously saved payment credentials unreadable.
- Business details in Settings (phone, address, trade licence, socials) are
  **placeholders** — replace them.
- Product photos are generated SVG artwork until you upload real ones — do that
  from the product's Image tab (drag-drop, file picker, or the media library).
- Serve the API over HTTPS; payment gateways will not call back to plain HTTP.
- There is no manual/phone order entry screen in the admin yet — phone orders
  have to be placed through the storefront.
- SMS notifications have a settings UI and a provider field, but no send
  implementation yet.
- Courier adapters are written against each provider's documented API but have
  only been exercised against invalid credentials (the calls reach the real
  hosts and are correctly rejected). Test each provider in sandbox with your own
  keys before relying on automatic booking.
- Pathao's store picker endpoint exists (`/api/couriers/pathao/stores`) but the
  settings screen still takes the store ID as free text.
- There is no password reset flow for customer accounts yet.

## Project layout

```
src/                    storefront + admin (one Vite app, admin lazy-loaded)
  admin/                admin panel: pages, layout, auth, shared UI
  components/           storefront UI
  context/              SettingsContext (live site config), StoreContext (cart)
  hooks/useCatalog.js   API-backed product hooks with offline fallback
  lib/api.js            fetch wrapper
server/src/
  models/               13 Mongoose models
  routes/               13 route modules
  services/             sslcommerz · bkash · mailer · meta (chat) · invoice · courierPoller
    couriers/           registry + steadfast · pathao · redx adapters
  seed/                 catalogue + demo data
```
