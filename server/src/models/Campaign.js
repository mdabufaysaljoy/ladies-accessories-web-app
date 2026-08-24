import mongoose from 'mongoose'

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    /**
     * Email and SMS campaigns share this collection: the audience, scheduling
     * and stats are identical, only the delivery channel and the body differ.
     * `subject` is required for email and unused for SMS.
     */
    channel: { type: String, enum: ['email', 'sms'], default: 'email', index: true },
    subject: { type: String, default: '' },
    /** The SMS body — plain text, measured against the 160-character limit. */
    smsText: { type: String, default: '' },
    preheader: String,
    bodyHtml: String,
    bodyText: String,
    template: { type: String, default: 'promo' },

    audience: {
      type: { type: String, enum: ['subscribers', 'customers', 'segment', 'manual'], default: 'subscribers' },
      segment: { type: String, enum: ['all', 'new', 'repeat', 'vip'], default: 'all' },
      manualEmails: [String],
      /**
       * Phone numbers for an SMS campaign, kept apart from `manualEmails` so a
       * campaign can be switched between channels without one list silently
       * becoming the other.
       */
      manualPhones: [String],
    },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    scheduledFor: Date,
    sentAt: Date,

    stats: {
      recipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      simulated: { type: Boolean, default: false },
    },
    lastError: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true },
)

export const Campaign = mongoose.model('Campaign', campaignSchema)
