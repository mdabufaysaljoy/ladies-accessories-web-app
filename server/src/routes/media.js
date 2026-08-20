import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Media } from '../models/Media.js'
import { upload } from '../middleware/upload.js'
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

    const created = await Media.insertMany(
      req.files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        // Absolute, not relative: this URL is read by the frontend on a
        // different origin (domain.com vs api.domain.com) and by emails, which
        // have no page origin to resolve a relative path against at all.
        url: `${env.publicUrl}/uploads/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        folder: req.body.folder ?? 'general',
        alt: req.body.alt ?? '',
        uploadedBy: req.user._id,
      })),
    )

    res.status(201).json({ media: created })
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
