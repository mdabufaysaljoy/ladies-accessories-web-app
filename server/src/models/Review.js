import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productSlug: String,
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    name: { type: String, required: true },
    location: String,
    phone: String,
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: String,
    images: [String],
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'published', 'rejected'], default: 'pending', index: true },
    reply: { body: String, at: Date, by: String },
  },
  { timestamps: true },
)

export const Review = mongoose.model('Review', reviewSchema)
