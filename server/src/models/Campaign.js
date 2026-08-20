import mongoose from 'mongoose'

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    subject: { type: String, required: true },
    preheader: String,
    bodyHtml: String,
    bodyText: String,
    template: { type: String, default: 'promo' },

    audience: {
      type: { type: String, enum: ['subscribers', 'customers', 'segment', 'manual'], default: 'subscribers' },
      segment: { type: String, enum: ['all', 'new', 'repeat', 'vip'], default: 'all' },
      manualEmails: [String],
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
