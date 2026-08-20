import nodemailer from 'nodemailer'
import { Settings } from '../models/Settings.js'
import { decryptSecret } from '../utils/crypto.js'

/**
 * When SMTP is not configured the mailer runs in "simulated" mode: everything
 * is composed and logged but nothing leaves the box. That keeps the admin
 * panel fully usable before the shop has real mail credentials.
 */
let cached = { transport: null, signature: '' }

async function getTransport() {
  const settings = await Settings.getSingleton()
  const cfg = settings.integrations?.email ?? {}

  if (cfg.provider !== 'smtp' || !cfg.smtpHost) {
    return { transport: null, cfg, simulated: true }
  }

  const password = decryptSecret(cfg.smtpPassword)
  const signature = [cfg.smtpHost, cfg.smtpPort, cfg.smtpUser, cfg.smtpSecure, password].join('|')

  if (!cached.transport || cached.signature !== signature) {
    cached = {
      signature,
      transport: nodemailer.createTransport({
        host: cfg.smtpHost,
        port: Number(cfg.smtpPort) || 587,
        secure: Boolean(cfg.smtpSecure),
        auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: password } : undefined,
      }),
    }
  }

  return { transport: cached.transport, cfg, simulated: false }
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  const { transport, cfg, simulated } = await getTransport()
  const from = `"${cfg.fromName || 'Goods by Sadia'}" <${cfg.fromEmail || 'hello@goodsbysadia.com'}>`

  if (simulated) {
    console.log(`[mail:simulated] → ${to} · ${subject}`)
    return { ok: true, simulated: true, messageId: `sim-${Date.now()}` }
  }

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject,
      html,
      text: text ?? html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      replyTo: replyTo ?? cfg.replyTo ?? undefined,
    })
    return { ok: true, simulated: false, messageId: info.messageId }
  } catch (error) {
    console.error('[mail:failed]', error.message)
    return { ok: false, simulated: false, error: error.message }
  }
}

export async function verifyTransport() {
  const { transport, simulated } = await getTransport()
  if (simulated) return { ok: false, simulated: true, message: 'SMTP is not configured' }
  try {
    await transport.verify()
    return { ok: true, simulated: false, message: 'SMTP connection verified' }
  } catch (error) {
    return { ok: false, simulated: false, message: error.message }
  }
}

/* ----------------------------- email templates ---------------------------- */

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const taka = (n) => `৳${Number(n || 0).toLocaleString('en-US')}`

export function renderShell({ brand, heading, intro, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const accent = brand?.colors?.plum ?? '#5b2a4d'
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6eae7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171114">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6eae7;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fcf9f6;border-radius:20px;overflow:hidden">
        <tr><td style="background:${accent};padding:28px 32px;color:#fcf9f6">
          <div style="font-size:20px;font-weight:700;letter-spacing:-0.3px">${escapeHtml(brand?.name ?? 'Goods by Sadia')}</div>
          <div style="font-size:12px;opacity:.7;margin-top:4px">${escapeHtml(brand?.tagline ?? '')}</div>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">${escapeHtml(heading)}</h1>
          ${intro ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3b2f35">${escapeHtml(intro)}</p>` : ''}
          ${bodyHtml ?? ''}
          ${ctaUrl ? `<p style="margin:28px 0 0"><a href="${ctaUrl}" style="display:inline-block;background:#171114;color:#fcf9f6;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;font-weight:600">${escapeHtml(ctaLabel ?? 'View')}</a></p>` : ''}
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #eee;font-size:12px;color:#8b7d83;line-height:1.6">
          ${footerNote ? `${escapeHtml(footerNote)}<br/>` : ''}
          ${escapeHtml(brand?.name ?? '')} · ${escapeHtml(brand?.address ?? '')}<br/>
          ${escapeHtml(brand?.phone ?? '')}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function orderLinesTable(order) {
  const rows = order.lines
    .map(
      (l) => `<tr>
        <td style="padding:10px 0;font-size:14px;border-bottom:1px solid #eee">
          ${escapeHtml(l.name)}
          ${l.color || l.size ? `<br/><span style="font-size:12px;color:#8b7d83">${escapeHtml([l.color, l.size].filter(Boolean).join(' · '))}</span>` : ''}
        </td>
        <td style="padding:10px 0;font-size:14px;text-align:center;border-bottom:1px solid #eee">×${l.qty}</td>
        <td style="padding:10px 0;font-size:14px;text-align:right;border-bottom:1px solid #eee">${taka(l.price * l.qty)}</td>
      </tr>`,
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0">
    ${rows}
    <tr><td colspan="2" style="padding:10px 0 0;font-size:14px;color:#8b7d83">Subtotal</td><td style="padding:10px 0 0;font-size:14px;text-align:right">${taka(order.totals.subtotal)}</td></tr>
    ${order.totals.discount ? `<tr><td colspan="2" style="padding:4px 0;font-size:14px;color:#4f6152">Discount</td><td style="padding:4px 0;font-size:14px;text-align:right;color:#4f6152">−${taka(order.totals.discount)}</td></tr>` : ''}
    <tr><td colspan="2" style="padding:4px 0;font-size:14px;color:#8b7d83">Delivery</td><td style="padding:4px 0;font-size:14px;text-align:right">${order.totals.shipping ? taka(order.totals.shipping) : 'Free'}</td></tr>
    <tr><td colspan="2" style="padding:12px 0 0;font-size:17px;font-weight:700">Total</td><td style="padding:12px 0 0;font-size:17px;font-weight:700;text-align:right">${taka(order.totals.total)}</td></tr>
  </table>`
}

export const ORDER_EMAIL_TEMPLATES = {
  'order-confirmed': (order) => ({
    subject: `Order ${order.orderNumber} confirmed`,
    heading: `Thank you, ${String(order.customer.name).split(' ')[0]}!`,
    intro: `We have your order and it is queued for packing. We will call ${order.customer.phone} before dispatch.`,
  }),
  'order-packed': (order) => ({
    subject: `Order ${order.orderNumber} is packed`,
    heading: 'Your parcel is packed',
    intro: 'Wrapped by hand and sealed with a tamper tag. It goes to the courier next.',
  }),
  'order-shipped': (order) => ({
    subject: `Order ${order.orderNumber} is on the way`,
    heading: 'Your parcel is on the way',
    intro: order.delivery?.trackingNumber
      ? `${order.delivery.courier ?? 'Courier'} tracking number: ${order.delivery.trackingNumber}. Estimated ${order.delivery.eta ?? 'in a few days'}.`
      : `Handed to ${order.delivery?.courier ?? 'the courier'}. Estimated ${order.delivery?.eta ?? 'in a few days'}.`,
    extraHtml: order.delivery?.trackingUrl
      ? `<p style="margin:16px 0 0"><a href="${order.delivery.trackingUrl}" style="color:#5b2a4d;font-weight:600">Track your parcel with ${order.delivery.courier}</a></p>`
      : '',
  }),
  'order-delivered': (order) => ({
    subject: `Order ${order.orderNumber} delivered`,
    heading: 'Delivered — enjoy!',
    intro: 'If anything is not right, message us on WhatsApp within 48 hours with your unboxing video and we will fix it.',
  }),
  'order-cancelled': (order) => ({
    subject: `Order ${order.orderNumber} cancelled`,
    heading: 'Your order has been cancelled',
    intro: 'If this was not expected, reply to this email or message us on WhatsApp and we will sort it out.',
  }),
  'payment-received': (order) => ({
    subject: `Payment received for ${order.orderNumber}`,
    heading: 'Payment confirmed',
    intro: `We have received ${taka(order.payment.amountPaid || order.totals.total)}${order.payment.channel ? ` via ${order.payment.channel}` : ''}. Your order is now being prepared.`,
  }),
}

/** Tells the shop a new order came in, so nobody has to watch the dashboard. */
export async function sendNewOrderAdminEmail(order, { brand, settings, adminUrl }) {
  const to = settings.notifications?.adminNotifyEmail || settings.contact?.email
  if (!to) return { ok: false, skipped: 'no-admin-email' }

  const method = order.payment?.method === 'cod' ? 'Cash on delivery' : order.payment?.method
  const html = renderShell({
    brand,
    heading: `New order · ${taka(order.totals.total)}`,
    intro: `${order.customer.name} (${order.customer.phone}) just placed order ${order.orderNumber} — ${method}.`,
    bodyHtml: `${orderLinesTable(order)}
      <p style="margin:20px 0 0;font-size:13px;color:#3b2f35;line-height:1.7">
        <strong>Deliver to</strong><br/>
        ${String(order.customer.address ?? '')}<br/>
        ${[order.customer.area, order.customer.district].filter(Boolean).join(', ')}<br/>
        ${order.delivery?.zoneLabel ?? ''} · ${order.delivery?.eta ?? ''}
      </p>`,
    ctaLabel: 'Open in admin',
    ctaUrl: `${adminUrl}/admin/orders/${order._id}`,
    footerNote: `Invoice ${order.invoice?.number ?? '—'}`,
  })

  return sendMail({ to, subject: `New order ${order.orderNumber} · ${taka(order.totals.total)}`, html })
}

/** The customer's copy, sent the moment the order is placed. */
export async function sendOrderPlacedEmail(order, { brand, storefrontUrl }) {
  if (!order.customer?.email) return { ok: false, skipped: 'no-email' }

  const due =
    order.payment?.status === 'paid'
      ? 0
      : Math.max(0, order.totals.total - (order.payment?.amountPaid ?? 0))

  const html = renderShell({
    brand,
    heading: `Thank you, ${String(order.customer.name).split(' ')[0]}!`,
    intro: `We have your order ${order.orderNumber}. We will call ${order.customer.phone} before dispatch.`,
    bodyHtml: `${orderLinesTable(order)}
      ${due > 0 ? `<p style="margin:18px 0 0;padding:12px 14px;background:#f6eae7;border-radius:10px;font-size:14px"><strong>${taka(due)}</strong> to pay the courier on delivery.</p>` : ''}
      <p style="margin:18px 0 0;font-size:13px;color:#8b7d83">Invoice ${order.invoice?.number ?? ''}</p>`,
    ctaLabel: 'View your invoice',
    ctaUrl: `${storefrontUrl}/order/${order.orderNumber}`,
    footerNote: `Order ${order.orderNumber}`,
  })

  return sendMail({ to: order.customer.email, subject: `Order ${order.orderNumber} received`, html })
}

export async function sendOrderEmail(order, template, { brand, storefrontUrl }) {
  if (!order.customer?.email) return { ok: false, skipped: 'no-email' }
  const build = ORDER_EMAIL_TEMPLATES[template]
  if (!build) return { ok: false, skipped: 'unknown-template' }

  const t = build(order)
  const html = renderShell({
    brand,
    heading: t.heading,
    intro: t.intro,
    bodyHtml: `${orderLinesTable(order)}${t.extraHtml ?? ''}`,
    ctaLabel: 'View your order',
    ctaUrl: `${storefrontUrl}/order/${order.orderNumber}`,
    footerNote: `Order ${order.orderNumber}`,
  })

  return sendMail({ to: order.customer.email, subject: t.subject, html })
}
