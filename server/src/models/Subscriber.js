import mongoose from 'mongoose'
import { randomToken } from '../utils/crypto.js'

const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    source: { type: String, default: 'footer' },
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed', index: true },
    unsubscribeToken: { type: String, default: () => randomToken(16) },
    unsubscribedAt: Date,
    tags: [String],
  },
  { timestamps: true },
)

export const Subscriber = mongoose.model('Subscriber', subscriberSchema)
