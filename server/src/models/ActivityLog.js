import mongoose from 'mongoose'

/** Audit trail — who changed what, so settings/price edits are traceable. */
const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    actorName: String,
    action: { type: String, required: true },
    entity: String,
    entityId: String,
    summary: String,
    meta: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true },
)

activityLogSchema.index({ createdAt: -1 })

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema)

export const logActivity = async (payload) => {
  try {
    await ActivityLog.create(payload)
  } catch {
    // Audit logging must never break the request it is recording.
  }
}
