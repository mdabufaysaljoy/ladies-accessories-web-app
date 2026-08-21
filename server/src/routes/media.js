import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Media } from '../models/Media.js'
import { upload } from '../middleware/upload.js'
import { Settings } from '../models/Settings.js'
import { mediaOptions, optimiseImage, savingsSummary } from '../services/imageOptimiser.js'
import { requireAuth, requireAbility } from '../middleware/auth.js'
import { ApiError, asyncHandler, paginate, meta } from '../utils/helpers.js'
import { env } from '../config/env.js'

const router = Router()
router.use(requireAuth, requireAbility('media'))

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate({ ...req.query, limit: req.query.limit ?? 40 })
    const filter = req.query.folder ? { folder: req.query.folder } : {}
    const [items, total] = await Promise.all([
      Media.find(filter).sort('-createdAt').skip(skip).limit(limit),
      Media.countDocuments(filter),
    ])
    res.json({ media: items, meta: meta(total, page, limit) })
  }),
)

router.post(
  '/',
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) throw ApiError.badRequest('No files uploaded')

    const settings = await Settings.getSingleton()
    const options = mediaOptions(settings)

    /**
     * Re-encode one at a time rather than in parallel. On a single shared vCPU
     * ten concurrent sharp pipelines would fight each other for the core and
     * the memory, and a ten-image upload is not worth stalling the whole API
     * for. Sequential keeps the box responsive.
     */
    const processed = []
    for (const file of req.files) {
      try {
        processed.push({ file, result: await optimiseImage(file, options) })
      } catch (error) {
        // One unreadable file must not lose the rest of the batch.
        console.error('[media] could not process', file.originalname, error.message)
      }
    }

    if (!processed.length) {
      throw ApiError.badRequest('None of those files could be read as an image')
    }

    const created = await Media.insertMany(
      processed.map(({ file, result }) => ({
        filename: result.filename,
        originalName: file.originalname,
        // Absolute, not relative: this URL is read by the frontend on a
        // different origin (domain.com vs api.domain.com) and by emails, which
        // have no page origin to resolve a relative path against at all.
        url: `${env.publicUrl}/uploads/${result.filename}`,
        mimeType: result.mimeType,
        size: result.size,
        originalSize: result.originalSize,
        width: result.width,
        height: result.height,
        optimised: result.optimised,
        folder: req.body.folder ?? 'general',
        alt: req.body.alt ?? '',
        uploadedBy: req.user._id,
      })),
    )

    const originalBytes = processed.reduce((sum, p) => sum + p.result.originalSize, 0)
    const storedBytes = processed.reduce((sum, p) => sum + p.result.size, 0)

    res.status(201).json({
      media: created,
      optimisation: {
        format: options.format,
        originalBytes,
        storedBytes,
        savedPercent: savingsSummary(originalBytes, storedBytes),
        skipped: req.files.length - processed.length,
      },
    })
  }),
)

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const media = await Media.findByIdAndUpdate(
      req.params.id,
      { alt: req.body.alt, folder: req.body.folder },
      { new: true },
    )
    if (!media) throw ApiError.notFound('File not found')
    res.json({ media })
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const media = await Media.findById(req.params.id)
    if (!media) throw ApiError.notFound('File not found')

    // Resolve inside the upload dir so a crafted filename cannot escape it.
    const target = path.resolve(env.uploadDir, path.basename(media.filename))
    if (target.startsWith(path.resolve(env.uploadDir))) {
      await fs.unlink(target).catch(() => {})
    }
    await media.deleteOne()

    res.json({ ok: true })
  }),
)

export default router
