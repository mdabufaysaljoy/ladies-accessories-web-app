import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { env } from '../config/env.js'

/**
 * Every uploaded image is re-encoded before it is stored.
 *
 * Shop owners upload straight from a phone camera — 4000px, 6 MB, full EXIF.
 * Served as-is that is the single biggest thing slowing a storefront down on
 * mobile data, which is how nearly all of this shop's customers browse. So the
 * original never reaches disk: it is resized to a sane maximum and re-encoded
 * to WebP (or AVIF), and the metadata — including GPS coordinates from the
 * phone — is dropped on the way through.
 */

/** Anything wider than this is a photo nobody needs at full size on the web. */
const DEFAULT_MAX_WIDTH = 2000
const DEFAULT_QUALITY = 78

/**
 * SVGs are passed through untouched. Rasterising a logo would defeat the point
 * of it being a vector, and they are already served under a sandbox CSP.
 */
export const isPassThrough = (mimetype) => mimetype === 'image/svg+xml'

const EXTENSION = { webp: 'webp', avif: 'avif' }

/**
 * Re-encodes one in-memory upload and writes it to the uploads directory.
 *
 * Returns what was written plus the original byte count, so the admin can see
 * what the optimisation actually saved rather than taking it on trust.
 */
export async function optimiseImage(file, options = {}) {
  const {
    format = 'webp',
    quality = DEFAULT_QUALITY,
    maxWidth = DEFAULT_MAX_WIDTH,
  } = options

  const stamp = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`

  // Vectors and disabled optimisation both mean "store exactly what arrived".
  if (isPassThrough(file.mimetype) || format === 'original') {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || '.bin'
    const filename = `${stamp}${ext}`
    await fs.writeFile(path.join(env.uploadDir, filename), file.buffer)
    return {
      filename,
      mimeType: file.mimetype,
      size: file.buffer.length,
      originalSize: file.buffer.length,
      width: null,
      height: null,
      optimised: false,
    }
  }

  const target = EXTENSION[format] ? format : 'webp'
  const filename = `${stamp}.${EXTENSION[target]}`

  // `animated` keeps a GIF moving instead of flattening it to the first frame.
  const isAnimated = file.mimetype === 'image/gif'
  let pipeline = sharp(file.buffer, { animated: isAnimated, failOn: 'none' })

  const meta = await pipeline.metadata()

  // `withoutEnlargement` matters: upscaling a small logo to 2000px would make
  // the file bigger and the image blurrier.
  pipeline = pipeline.rotate().resize({
    width: maxWidth,
    height: maxWidth,
    fit: 'inside',
    withoutEnlargement: true,
  })

  const encoded =
    target === 'avif'
      ? await pipeline.avif({ quality, effort: 4 }).toBuffer({ resolveWithObject: true })
      : await pipeline.webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true })

  await fs.writeFile(path.join(env.uploadDir, filename), encoded.data)

  return {
    filename,
    mimeType: `image/${EXTENSION[target]}`,
    size: encoded.info.size,
    originalSize: file.buffer.length,
    width: encoded.info.width,
    // An animated WebP reports the height of every frame stacked together.
    height: isAnimated && meta.pages ? Math.round(encoded.info.height / meta.pages) : encoded.info.height,
    optimised: true,
  }
}

/**
 * Reads the admin's media preferences, falling back to values that are safe on
 * the smallest VPS. AVIF compresses harder but costs several times more CPU per
 * image, which is a real consideration on a single shared core.
 */
export function mediaOptions(settings) {
  const media = settings?.media ?? {}
  const format = ['webp', 'avif', 'original'].includes(media.format) ? media.format : 'webp'
  const quality = Number.isFinite(media.quality) ? Math.min(100, Math.max(40, media.quality)) : DEFAULT_QUALITY
  const maxWidth = Number.isFinite(media.maxWidth) ? Math.min(4000, Math.max(600, media.maxWidth)) : DEFAULT_MAX_WIDTH
  return { format, quality, maxWidth }
}

/** "1.8 MB → 210 KB (88% smaller)" for the admin's upload confirmation. */
export const savingsSummary = (originalSize, size) => {
  if (!originalSize || size >= originalSize) return null
  return Math.round(((originalSize - size) / originalSize) * 100)
}
