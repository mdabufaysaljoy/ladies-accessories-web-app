import { Settings } from '../models/Settings.js'

/**
 * Invoice numbering and rendering.
 *
 * Numbers are allocated with an atomic $inc so two orders placed in the same
 * second can never be handed the same invoice number.
 */
export async function allocateInvoiceNumber() {
  const doc = await Settings.findOneAndUpdate(
    { key: 'primary' },
    { $inc: { 'invoice.nextNumber': 1 } },
    { new: false, upsert: true, setDefaultsOnInsert: true },
  )

  const prefix = doc?.invoice?.prefix ?? 'INV'
  const current = doc?.invoice?.nextNumber ?? 1001
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(current).padStart(5, '0')}`
}

export async function ensureInvoice(order) {
  if (order.invoice?.number) return order
  order.invoice = { number: await allocateInvoiceNumber(), issuedAt: new Date() }
  await order.save()
  return order
}

/* ------------------------------- rendering ------------------------------- */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const taka = (n) => `৳${Number(n || 0).toLocaleString('en-US')}`

/** 8801911223344 → 01911-223344, which is how a Bangladeshi reads it. */
const phoneFmt = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  const local = digits.startsWith('880') ? `0${digits.slice(3)}` : digits
  return local.length === 11 ? `${local.slice(0, 5)}-${local.slice(5)}` : local || '—'
}

const dateFmt = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const PAYMENT_LABEL = {
  cod: 'Cash on Delivery',
  sslcommerz: 'SSLCommerz (online)',
  bkash: 'bKash Checkout',
  'bkash-manual': 'bKash — Send Money',
  'nagad-manual': 'Nagad — Send Money',
}

/**
 * Self-contained printable invoice. No external assets and no JavaScript beyond
 * an optional auto-print, so it renders identically from the admin, the
 * customer's confirmation page, or a saved PDF.
 */
export function renderInvoiceHtml(order, settings, { autoPrint = false } = {}) {
  const brand = settings.brand ?? {}
  const contact = settings.contact ?? {}
  const inv = settings.invoice ?? {}
  const colors = brand.colors ?? {}

  const ink = colors.ink ?? '#171114'
  const plum = colors.plum ?? '#5b2a4d'
  const blush = colors.blush ?? '#f6eae7'

  const paid = order.payment?.status === 'paid'
  const due = paid ? 0 : Math.max(0, order.totals.total - (order.payment?.amountPaid ?? 0))

  const rows = order.lines
    .map((l, i) => {
      const variant = [l.color, l.size].filter(Boolean).join(' · ')
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>
          <span class="item">${esc(l.name)}</span>
          ${variant ? `<span class="variant">${esc(variant)}</span>` : ''}
          ${l.sku ? `<span class="sku">SKU ${esc(l.sku)}</span>` : ''}
        </td>
        <td class="num">${l.qty}</td>
        <td class="num">${taka(l.price)}</td>
        <td class="num strong">${taka(l.price * l.qty)}</td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Invoice ${esc(order.invoice?.number ?? order.orderNumber)} — ${esc(brand.name ?? '')}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: ${ink}; background: #f4f1ee; font-size: 13px; line-height: 1.5;
  }
  .sheet {
    max-width: 780px; margin: 0 auto; background: #fff;
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 10px 40px -20px rgba(0,0,0,.3);
  }

  header { background: ${plum}; color: #fff; padding: 28px 32px; display: flex; justify-content: space-between; gap: 24px; }
  .brand-name { font-size: 21px; font-weight: 700; letter-spacing: -.3px; }
  .brand-tag { font-size: 11px; opacity: .75; margin-top: 3px; }
  .brand-meta { font-size: 11px; opacity: .8; margin-top: 12px; line-height: 1.6; }
  .logo { height: 44px; width: auto; margin-bottom: 10px; display: block; }
  .doc { text-align: right; flex-shrink: 0; }
  .doc h1 { margin: 0; font-size: 26px; letter-spacing: 3px; font-weight: 300; text-transform: uppercase; }
  .doc .no { margin-top: 8px; font-size: 15px; font-weight: 700; font-family: ui-monospace, Menlo, monospace; }
  .doc .date { font-size: 11px; opacity: .8; margin-top: 4px; }
  .stamp {
    display: inline-block; margin-top: 10px; padding: 4px 12px; border-radius: 999px;
    font-size: 10px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;
    border: 1.5px solid currentColor;
  }
  .stamp.paid { color: #7ee2b8; }
  .stamp.due  { color: #ffd98a; }

  .parties { display: flex; gap: 24px; padding: 24px 32px; border-bottom: 1px solid #eee; }
  .party { flex: 1; }
  .party h2 { margin: 0 0 8px; font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: #9a8f94; }
  .party .name { font-weight: 700; font-size: 14px; }
  .party p { margin: 3px 0 0; color: #574c52; }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: ${blush}; color: ${plum};
    font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase;
    padding: 10px 12px; text-align: left;
  }
  thead th.num, tbody td.num { text-align: right; }
  thead th:first-child, tbody td:first-child { text-align: center; width: 34px; }
  tbody td { padding: 11px 12px; border-bottom: 1px solid #f0ecea; vertical-align: top; }
  tbody td.strong { font-weight: 700; }
  .item { display: block; font-weight: 600; }
  .variant, .sku { display: block; font-size: 11px; color: #8b7d83; margin-top: 2px; }

  .totals { display: flex; justify-content: flex-end; padding: 18px 32px 6px; }
  .totals table { width: auto; min-width: 320px; }
  .totals td { padding: 5px 0; white-space: nowrap; }
  .totals td:first-child { padding-right: 32px; }
  .totals td:last-child { text-align: right; font-weight: 600; }
  .totals tr.grand td { border-top: 2px solid ${ink}; padding-top: 10px; font-size: 18px; font-weight: 800; }
  .totals tr.due td { color: #b8860b; font-weight: 700; }
  .totals tr.discount td { color: #4f6152; }

  .info { display: flex; gap: 24px; padding: 20px 32px; border-top: 1px solid #eee; margin-top: 12px; }
  .info div { flex: 1; }
  .info h3 { margin: 0 0 6px; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: #9a8f94; }
  .info p { margin: 0; color: #574c52; }

  footer { padding: 20px 32px 28px; border-top: 1px solid #eee; }
  footer .note { color: #574c52; }
  footer .terms { margin-top: 8px; font-size: 11px; color: #8b7d83; }
  .sign { margin-top: 26px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
  .sign div { text-align: center; font-size: 11px; color: #8b7d83; }
  .sign .line { width: 150px; border-top: 1px solid #ccc; padding-top: 5px; margin-bottom: 0; }
  .legal { margin-top: 22px; text-align: center; font-size: 10px; color: #a89ea3; }

  .toolbar { max-width: 780px; margin: 0 auto 14px; display: flex; justify-content: flex-end; gap: 8px; }
  .toolbar button {
    border: 0; border-radius: 999px; padding: 9px 18px; font-size: 13px; font-weight: 600;
    background: ${ink}; color: #fff; cursor: pointer; font-family: inherit;
  }

  @media print {
    body { background: #fff; padding: 0; font-size: 12px; }
    .sheet { box-shadow: none; border-radius: 0; max-width: none; }
    .toolbar { display: none; }
    header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr { break-inside: avoid; }
  }
  @page { margin: 12mm; size: A4; }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>

  <div class="sheet">
    <header>
      <div>
        ${inv.showLogo && brand.logoUrl ? `<img class="logo" src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" />` : ''}
        <div class="brand-name">${esc(brand.name ?? 'Goods by Sadia')}</div>
        <div class="brand-tag">${esc(brand.tagline ?? '')}</div>
        <div class="brand-meta">
          ${esc(contact.address ?? '')}<br />
          ${esc(contact.phone ?? '')}${contact.email ? ` · ${esc(contact.email)}` : ''}
          ${contact.tradeLicence ? `<br />Trade Licence: ${esc(contact.tradeLicence)}` : ''}
          ${contact.binNumber ? `<br />BIN: ${esc(contact.binNumber)}` : ''}
        </div>
      </div>
      <div class="doc">
        <h1>Invoice</h1>
        <div class="no">${esc(order.invoice?.number ?? order.orderNumber)}</div>
        <div class="date">Issued ${dateFmt(order.invoice?.issuedAt ?? order.createdAt)}</div>
        <div class="date">Order ${esc(order.orderNumber)}</div>
        <span class="stamp ${paid ? 'paid' : 'due'}">${paid ? 'Paid' : 'Payment due'}</span>
      </div>
    </header>

    <section class="parties">
      <div class="party">
        <h2>Billed to</h2>
        <div class="name">${esc(order.customer.name)}</div>
        <p>${esc(order.customer.address ?? '')}</p>
        <p>${esc([order.customer.area, order.customer.district].filter(Boolean).join(', '))}</p>
        <p>${esc(phoneFmt(order.customer.phone))}${order.customer.altPhone ? ` · ${esc(phoneFmt(order.customer.altPhone))}` : ''}</p>
        ${order.customer.email ? `<p>${esc(order.customer.email)}</p>` : ''}
      </div>
      <div class="party">
        <h2>Delivery</h2>
        <div class="name">${esc(order.delivery?.zoneLabel ?? '—')}</div>
        <p>Estimated: ${esc(order.delivery?.eta ?? '—')}</p>
        ${order.delivery?.courier ? `<p>Courier: ${esc(order.delivery.courier)}</p>` : ''}
        ${order.delivery?.trackingNumber ? `<p>Tracking: ${esc(order.delivery.trackingNumber)}</p>` : ''}
        <p>Order date: ${dateFmt(order.createdAt)}</p>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th>#</th><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Subtotal</td><td>${taka(order.totals.subtotal)}</td></tr>
        ${order.totals.discount ? `<tr class="discount"><td>Discount${order.coupon?.code ? ` (${esc(order.coupon.code)})` : ''}</td><td>−${taka(order.totals.discount)}</td></tr>` : ''}
        <tr><td>Delivery charge</td><td>${order.totals.shipping ? taka(order.totals.shipping) : 'Free'}</td></tr>
        <tr class="grand"><td>Total</td><td>${taka(order.totals.total)}</td></tr>
        ${order.payment?.amountPaid ? `<tr><td>Paid</td><td>−${taka(order.payment.amountPaid)}</td></tr>` : ''}
        ${due > 0 ? `<tr class="due"><td>Amount due on delivery</td><td>${taka(due)}</td></tr>` : ''}
      </table>
    </div>

    <section class="info">
      <div>
        <h3>Payment method</h3>
        <p>${esc(PAYMENT_LABEL[order.payment?.method] ?? order.payment?.method ?? '—')}</p>
        ${order.payment?.transactionId ? `<p>TrxID: ${esc(order.payment.transactionId)}</p>` : ''}
      </div>
      <div>
        <h3>Order status</h3>
        <p style="text-transform:capitalize">${esc(order.status)}</p>
      </div>
      ${order.customer.notes ? `<div><h3>Note</h3><p>${esc(order.customer.notes)}</p></div>` : ''}
    </section>

    <footer>
      <p class="note">${esc(inv.footerNote ?? '')}</p>
      <p class="terms">${esc(inv.termsNote ?? '')}</p>

      <div class="sign">
        <div><p class="line">Customer signature</p></div>
        <div><p class="line">${esc(inv.signatureName || brand.name || 'Authorised signatory')}</p></div>
      </div>

      <p class="legal">
        This is a computer-generated invoice and is valid without a physical signature.
        ${contact.email ? `Questions? ${esc(contact.email)}` : ''}
      </p>
    </footer>
  </div>

  ${autoPrint ? '<script>window.addEventListener("load", () => window.print())</script>' : ''}
</body>
</html>`
}

/** Compact HTML for the order-confirmation email body. */
export function renderInvoiceSummary(order) {
  return order.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${esc(l.name)}${
          [l.color, l.size].filter(Boolean).length
            ? `<br/><span style="font-size:12px;color:#8b7d83">${esc([l.color, l.size].filter(Boolean).join(' · '))}</span>`
            : ''
        }</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">×${l.qty}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${taka(
          l.price * l.qty,
        )}</td></tr>`,
    )
    .join('')
}
