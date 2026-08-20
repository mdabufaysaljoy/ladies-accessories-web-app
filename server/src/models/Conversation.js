import mongoose from 'mongoose'

export const CHANNELS = ['whatsapp', 'messenger', 'instagram', 'email', 'internal']

const messageSchema = new mongoose.Schema(
  {
    direction: { type: String, enum: ['in', 'out'], required: true },
    text: String,
    attachments: [{ type: { type: String }, url: String, name: String }],
    externalId: String,
    status: { type: String, enum: ['queued', 'sent', 'delivered', 'read', 'failed'], default: 'sent' },
    failureReason: String,
    sentBy: String,          // admin name for outbound
    simulated: { type: Boolean, default: false },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
)

/**
 * One thread per (channel, external contact). WhatsApp, Messenger and Instagram
 * DMs all land here so the team answers everything from one inbox.
 */
const conversationSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: CHANNELS, required: true, index: true },
    externalId: { type: String, required: true, index: true }, // wa phone / PSID / IGSID
    contact: {
      name: String,
      phone: String,
      username: String,
      avatarUrl: String,
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    linkedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

    messages: [messageSchema],

    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: String,
    unreadCount: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'pending', 'closed'], default: 'open', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    tags: [String],
  },
  { timestamps: true },
)

conversationSchema.index({ channel: 1, externalId: 1 }, { unique: true })
conversationSchema.index({ lastMessageAt: -1 })

conversationSchema.methods.appendMessage = function (message) {
  this.messages.push(message)
  this.lastMessageAt = message.at ?? new Date()
  this.lastMessagePreview = (message.text ?? '[attachment]').slice(0, 140)
  if (message.direction === 'in') {
    this.unreadCount += 1
    if (this.status === 'closed') this.status = 'open'
  }
  return this
}

export const Conversation = mongoose.model('Conversation', conversationSchema)
