import mongoose from 'mongoose'

const mediaSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    url: String,
    mimeType: String,
    size: Number,
    /** What the phone sent, before re-encoding — lets the admin see the saving. */
    originalSize: Number,
    width: Number,
    height: Number,
    optimised: { type: Boolean, default: false },
    alt: String,
    folder: { type: String, default: 'general' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true },
)

export const Media = mongoose.model('Media', mediaSchema)
