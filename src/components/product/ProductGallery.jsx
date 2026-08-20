import { useEffect, useMemo, useRef, useState } from 'react'
import { ProductArt } from './ProductArt'
import { Icon } from '@/components/ui/Icon'
import { youTubeEmbed, youTubeThumb } from '@/utils/video'
import { cx } from '@/utils/format'

/**
 * Four framings of the generated artwork. Only used when a product has no
 * photographs of its own, so a listing still looks like a gallery rather than
 * one lonely placeholder.
 */
const ART_VIEWS = [
  { id: 'art-front', label: 'Front', decorative: true, transform: 'none' },
  { id: 'art-detail', label: 'Detail', decorative: false, transform: 'scale(1.9) translate(-6%, 4%)' },
  { id: 'art-styled', label: 'Styled', decorative: true, transform: 'scale(1.25) translate(9%, -5%)' },
  { id: 'art-packed', label: 'Packaging', decorative: false, transform: 'scale(0.82) rotate(-4deg)' },
]

/**
 * The product gallery: every uploaded photo, then every YouTube video, with
 * the generated artwork standing in when there are no photos at all.
 *
 * Videos are click-to-load. Embedding an iframe per video on mount would pull
 * roughly a megabyte of YouTube player code into a page most shoppers reach on
 * mobile data, and would let YouTube see every product view — so a thumbnail
 * stands in until someone actually presses play.
 */
export function ProductGallery({ product, children }) {
  const slides = useMemo(() => {
    const photos = (product.images ?? [])
      .filter((img) => img?.url)
      .map((img, i) => ({
        id: `photo-${i}-${img.url}`,
        type: 'photo',
        url: img.url,
        alt: img.alt || `${product.name} — photo ${i + 1}`,
      }))

    const videos = (product.videos ?? [])
      .filter((v) => v?.videoId)
      .map((v) => ({
        id: `video-${v.videoId}`,
        type: 'video',
        videoId: v.videoId,
        title: v.title || `${product.name} — video`,
      }))

    // No photographs: fall back to the generated art, framed four ways.
    if (!photos.length) {
      return [...ART_VIEWS.map((v) => ({ ...v, type: 'art' })), ...videos]
    }
    return [...photos, ...videos]
  }, [product])

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const touchStart = useRef(null)

  // A different product means a different gallery — never keep the old index.
  useEffect(() => {
    setIndex(0)
    setPlaying(false)
  }, [product.slug])

  const active = slides[index] ?? slides[0]
  const showArrows = slides.length > 1

  const go = (next) => {
    const count = slides.length
    setIndex(((next % count) + count) % count)
    setPlaying(false)
  }

  return (
    <div>
      <div
        className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-sand"
        onTouchStart={(e) => {
          touchStart.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchStart.current == null) return
          const dx = e.changedTouches[0].clientX - touchStart.current
          if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1))
          touchStart.current = null
        }}
      >
        {active?.type === 'video' ? (
          playing ? (
            <iframe
              src={youTubeEmbed(active.videoId)}
              title={active.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play ${active.title}`}
              className="group relative h-full w-full"
            >
              <img
                src={youTubeThumb(active.videoId)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute inset-0 grid place-items-center bg-ink/25 transition-colors group-hover:bg-ink/35">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-cream/95 shadow-pop transition-transform duration-300 group-hover:scale-110">
                  {/* A play triangle, drawn rather than added to the icon set */}
                  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="ml-1 fill-ink">
                    <path d="M6 4.5v15l13-7.5z" />
                  </svg>
                </span>
              </span>
            </button>
          )
        ) : active?.type === 'photo' ? (
          <img
            src={active.url}
            alt={active.alt}
            className="h-full w-full object-cover"
            fetchPriority={index === 0 ? 'high' : 'auto'}
          />
        ) : (
          <div
            className="h-full w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: active?.transform }}
          >
            <ProductArt product={product} decorative={active?.decorative} priority />
          </div>
        )}

        {/* badges and the share button live over the image */}
        {children}

        {showArrows && !playing && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-cream/85 backdrop-blur-sm transition-colors hover:bg-cream"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-cream/85 backdrop-blur-sm transition-colors hover:bg-cream"
            >
              <Icon name="chevronRight" size={18} />
            </button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-2.5 py-1 text-[0.6875rem] font-medium text-cream backdrop-blur-sm">
              {index + 1} / {slides.length}
            </span>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => go(i)}
              aria-label={
                slide.type === 'video'
                  ? `Video: ${slide.title}`
                  : slide.type === 'art'
                    // The four art framings have names worth keeping.
                    ? `${slide.label} view`
                    : `View photo ${i + 1}`
              }
              aria-pressed={index === i}
              className={cx(
                'relative aspect-square overflow-hidden rounded-xl bg-sand transition-all duration-300',
                index === i
                  ? 'ring-2 ring-ink ring-offset-2 ring-offset-cream'
                  : 'opacity-65 hover:opacity-100',
              )}
            >
              {slide.type === 'video' ? (
                <>
                  <img src={youTubeThumb(slide.videoId)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <span className="absolute inset-0 grid place-items-center bg-ink/30">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="ml-0.5 fill-cream">
                      <path d="M6 4.5v15l13-7.5z" />
                    </svg>
                  </span>
                </>
              ) : slide.type === 'photo' ? (
                <img src={slide.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div style={{ transform: slide.transform }} className="h-full w-full">
                  <ProductArt product={product} decorative={slide.decorative} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
