import mongoose from 'mongoose'

/**
 * A record of every inbound webhook delivery — accepted or rejected.
 *
 * Without this, a webhook that Meta considers "connected" but which this
 * server rejects (a mismatched app secret, say) fails completely silently:
 * the shop owner sees an empty inbox and has no way to tell whether Meta is
 * calling at all, or calling and being turned away. That is the difference
 * between a five-minute fix and an afternoon of guessing.
 *
 * Deliberately small and short-lived: a preview of the payload rather than the
 * whole thing, and Mongo drops rows after seven days.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'meta' },
    /** `page`, `instagram`, `whatsapp_business_account` — Meta's own field. */
    object: { type: String, default: '' },
    status: { type: String, enum: ['accepted', 'rejected'], required: true, index: true },
    /** Why it was turned away. Empty when accepted. */
    reason: { type: String, default: '' },
    /** How many conversations the payload actually produced. */
    ingested: { type: Number, default: 0 },
    /** Trimmed body, purely so the operator can see what shape arrived. */
    preview: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)

webhookEventSchema.index({ createdAt: -1 })
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 })

/** Never let diagnostics break the thing they are diagnosing. */
webhookEventSchema.statics.record = async function (entry) {
  try {
    await this.create({
      ...entry,
      preview: String(entry.preview ?? '').slice(0, 800),
    })
  } catch (error) {
    console.error('[webhook-log] could not record:', error.message)
  }
}

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema)
