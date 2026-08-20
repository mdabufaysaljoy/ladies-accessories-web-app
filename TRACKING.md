# Marketing tracking — Facebook & Google

Everything below is configured from **Admin → Settings → Integrations**. No code
changes, no redeploy. With the fields empty, no tracking script is loaded at all.

---

## What is already wired up

| Event | Fires when | Browser pixel | Server (CAPI) |
| --- | --- | --- | --- |
| `PageView` | Every route change | ✅ | ✅ |
| `ViewContent` | Product page opens | ✅ | ✅ |
| `AddToCart` | Add to bag / Buy now | ✅ | ✅ |
| `AddToWishlist` | Heart on a product | ✅ | ✅ |
| `Search` | Search box, after typing stops | ✅ | ✅ |
| `InitiateCheckout` | Checkout page opens | ✅ | ✅ |
| `Purchase` | Order is placed | ✅ | ✅ **from the order record** |

Every event is sent **twice on purpose** — once from the browser, once from our
server — carrying the same `event_id`. Meta throws one of the two away. This is
the standard deduplication setup and it is what makes the numbers trustworthy:

- The browser copy dies to ad blockers, iOS tracking prevention, and shoppers
  who close the tab. Roughly a third of traffic in practice.
- The server copy always goes through.

`Purchase` is special: it is sent **from the saved order**, not from the browser,
using the order number as the event id. So a sale is reported with its real
total even if the shopper never sees the thank-you page, and the reported value
can never be faked from the browser console.

---

## Facebook / Meta setup

### 1. Pixel ID (5 minutes)

1. Open [Events Manager](https://business.facebook.com/events_manager2).
2. **Data sources** → your pixel → **Settings**.
3. Copy the **Dataset ID / Pixel ID** (a long number).
4. Paste it into **Settings → Integrations → Facebook / Meta tracking → Pixel ID**.
5. Save.

That alone gets the browser pixel running. Check it with the
[Meta Pixel Helper](https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
Chrome extension — open the shop and the badge should show your pixel firing.

### 2. Conversions API (server-side)

1. Same page in Events Manager → **Settings** → scroll to **Conversions API**.
2. **Generate access token** → copy it. It is shown once.
3. Paste into **Conversions API access token**.
4. Turn on **Send events from the server (Conversions API)**.
5. Save, then press **Send test event**.
   - Success → the token works.
   - An error → Meta's own message is shown, e.g. *"Malformed access token"*.

The token is encrypted before it is stored, is never sent to the storefront, and
the admin panel only ever shows the last 4 characters.

### 3. Confirm events are arriving

1. Events Manager → your pixel → **Test events**.
2. Copy the test code shown there (e.g. `TEST12345`) into **Test event code**.
3. Browse the shop and place a test order.
4. You should see each event **once**, with **Browser + Server** on it — that
   badge means deduplication is working. Two separate rows for the same action
   means the ids are not matching; check that Pixel ID and token belong to the
   same dataset.
5. **Clear the test event code when you are done.** Left in place, real events
   keep going to the test stream.

### 4. Domain verification

Needed for iOS 14+ campaigns and to control your own link previews.

1. Business Settings → **Brand safety** → **Domains** → add your domain.
2. Choose the **meta-tag** method and copy only the `content="..."` value.
3. Paste into **Domain verification code** and save.
4. Press verify in Meta.

---

## Google setup

### Google Analytics 4

1. GA4 → **Admin** → **Data streams** → your web stream.
2. Copy the **Measurement ID** (`G-XXXXXXXXXX`).
3. Paste into **Google Analytics 4 ID**.

Purchases, add-to-carts, checkouts and searches are reported as GA4's standard
ecommerce events (`purchase`, `add_to_cart`, `begin_checkout`, `search`), so the
built-in Monetisation reports work with no extra configuration.

### Google Ads conversion tracking

1. Google Ads → **Goals** → **Conversions** → **New conversion action** →
   **Website** → set it up as a **Purchase**.
2. Choose **Install the tag yourself**. You will see two values:
   - **Conversion ID** — looks like `AW-123456789`
   - **Conversion label** — looks like `AbC-D_efG12h34i5j6`
3. Paste them into **Google Ads conversion ID** and **Purchase conversion label**.

The purchase value and order number are sent with the conversion, so Ads can
report real revenue and ROAS rather than just conversion counts.

### Google Tag Manager (optional)

Only if you prefer managing tags in GTM. Paste the container ID (`GTM-XXXXXXX`).
Every event is also pushed to `window.dataLayer` as `gbs_<EventName>`
(e.g. `gbs_Purchase`) with its value, items and `eventId`, so you can build GTM
triggers on them.

Do **not** set up the Meta pixel in both GTM and here — it would fire twice.

---

## Adding a new tracked event

1. Add the event name to `CLIENT_EVENTS` in `server/src/services/pixel.js`.
2. Call `track('YourEvent', { ... })` from the component, or add a wrapper next
   to `trackAddToCart` in `src/lib/tracking.js`.

The browser copy, the server copy and the deduplication id are all handled for
you. If the event carries money, add it server-side instead — see how
`trackPurchase` reads its value from the order rather than from the client.

---

## Troubleshooting

**No events at all.** Check the Pixel ID is saved, then reload the storefront —
scripts are injected only when an ID is present. Confirm with the Pixel Helper.

**Browser events but no server events.** The CAPI toggle is off, or the token is
missing. Press **Send test event** to see the real reason.

**The same action counted twice.** The browser and server events are not being
matched. Both must use the same dataset, and the pixel must not also be
installed through GTM or a theme snippet.

**Low match quality score in Events Manager.** Expected on cash-on-delivery
traffic where shoppers rarely give an email. Every order still sends hashed
name, phone, city and country plus the click id, which is what Meta matches on
for Bangladeshi traffic. Nothing is sent unhashed except `fbp`/`fbc`, which Meta
requires in the clear.

**Events stopped after the ad campaign started.** Check the test event code is
cleared — otherwise everything is still going to the test stream.

---

## Privacy notes

- Customer details are **SHA-256 hashed before they leave the server** — email,
  phone, name and city. Meta receives hashes, never the raw values.
- Phone numbers are normalised to `8801XXXXXXXXX` before hashing, so the same
  shopper matches whether they typed `01712345678` or `+8801712345678`.
- Nothing is tracked at all until an ID is entered in the admin panel.
- The admin panel itself is excluded from tracking — staff traffic would
  otherwise pollute your ad audiences.
