import mongoose from 'mongoose'

/**
 * First-party page views, so the dashboard can show real traffic without the
 * shop depending on Google Analytics being configured — and without sending
 * every visitor's browsing to a third party just to count them.
 *
 * Deliberately thin on personal data: a random session id generated in the
 * browser, the path, and where they came from. No IP address, no cookie, no
 * fingerprint. That is enough to answer "how many people came today and what
 * did they look at", which is the question the dashboard is asking.
 */
const visitSchema = new mongoose.Schema(
  {
    /** Random per-tab id from sessionStorage. Not tied to a person. */
    sessionId: { type: String, required: true, index: true },
    path: { type: String, required: true },
    /** True for the first view of a session — this is what "visitors" counts. */
    isEntry: { type: Boolean, default: false, index: true },
    /** Referrer host only (`facebook.com`), never the full URL. */
    source: { type: String, default: 'direct' },
    device: { type: String, enum: ['mobile', 'tablet', 'desktop'], default: 'mobile' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)

/**
 * Traffic rows are only useful while they are recent, and this ships on a 25 GB
 * VPS where an unbounded collection is a slow-motion outage. Mongo drops them
 * after 90 days on its own.
 */
visitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })
visitSchema.index({ createdAt: -1, isEntry: 1 })

/** Visitors, page views and the daily series for a dashboard range. */
visitSchema.statics.summary = async function (since, previousSince) {
  const [visitors, pageViews, prevVisitors, today, series, topPages, sources, devices] =
    await Promise.all([
      this.distinct('sessionId', { createdAt: { $gte: since } }).then((ids) => ids.length),
      this.countDocuments({ createdAt: { $gte: since } }),
      this.distinct('sessionId', { createdAt: { $gte: previousSince, $lt: since } }).then((ids) => ids.length),
      this.distinct('sessionId', {
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }).then((ids) => ids.length),

      this.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            views: { $sum: 1 },
            visitors: { $addToSet: '$sessionId' },
          },
        },
        { $project: { views: 1, visitors: { $size: '$visitors' } } },
        { $sort: { _id: 1 } },
      ]),

      this.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$path', views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 8 },
      ]),

      this.aggregate([
        { $match: { createdAt: { $gte: since }, isEntry: true } },
        { $group: { _id: '$source', visits: { $sum: 1 } } },
        { $sort: { visits: -1 } },
        { $limit: 6 },
      ]),

      this.aggregate([
        { $match: { createdAt: { $gte: since }, isEntry: true } },
        { $group: { _id: '$device', visits: { $sum: 1 } } },
      ]),
    ])

  return {
    visitors,
    pageViews,
    today,
    change: prevVisitors === 0 ? (visitors > 0 ? 100 : 0) : Math.round(((visitors - prevVisitors) / prevVisitors) * 100),
    // Views per visitor says more about engagement than either number alone.
    viewsPerVisitor: visitors ? Math.round((pageViews / visitors) * 10) / 10 : 0,
    series: series.map((s) => ({ date: s._id, views: s.views, visitors: s.visitors })),
    topPages: topPages.map((p) => ({ path: p._id, views: p.views })),
    sources: sources.map((s) => ({ source: s._id, visits: s.visits })),
    devices: Object.fromEntries(devices.map((d) => [d._id, d.visits])),
  }
}

export const Visit = mongoose.model('Visit', visitSchema)
