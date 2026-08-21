import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '@/lib/api'
import { Badge, Btn, Modal, Spinner } from './ui'
import { Icon } from '@/components/ui/Icon'
import { cx, optimisationSummary } from '@/utils/format'

/* ------------------------------ media picker ------------------------------ */

export function MediaPicker({ open, onClose, onSelect, multiple = true }) {
  const [media, setMedia] = useState(null)
  const [picked, setPicked] = useState([])
  const [uploading, setUploading] = useState(false)
  const [savings, setSavings] = useState('')
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const d = await adminApi.get('/media?limit=60')
      setMedia(d.media)
    } catch {
      setMedia([])
    }
  }, [])

  useEffect(() => {
    if (open) {
      setPicked([])
      load()
    }
  }, [open, load])

  const upload = async (files) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(files).forEach((f) => fd.append('files', f))
      const res = await adminApi.upload('/media', fd)
      await load()
      // Newly uploaded files are almost always what you meant to pick.
      setPicked((p) => [...p, ...res.media.map((m) => m.url)])
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const toggle = (url) =>
    setPicked((p) => (multiple ? (p.includes(url) ? p.filter((x) => x !== url) : [...p, url]) : [url]))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose images"
      description="Pick from your media library, or upload new files here."
      size="lg"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            disabled={!picked.length}
            onClick={() => {
              onSelect(picked)
              onClose()
            }}
          >
            Use {picked.length || ''} {picked.length === 1 ? 'image' : 'images'}
          </Btn>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          upload(e.dataTransfer.files)
        }}
        className="mb-4 rounded-xl border-2 border-dashed border-ink/15 px-5 py-6 text-center transition-colors hover:border-ink/35"
      >
        <Icon name="plus" size={20} className="mx-auto text-ink/30" />
        <p className="mt-2 text-[0.875rem] font-medium">Drop images here</p>
        <Btn size="sm" className="mt-2.5" loading={uploading} onClick={() => inputRef.current?.click()}>
          Browse files
        </Btn>
      </div>

      {!media ? (
        <Spinner />
      ) : media.length === 0 ? (
        <p className="py-10 text-center text-[0.875rem] text-ink/45">
          Nothing in your library yet — upload something above.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {media.map((m) => {
            const selected = picked.includes(m.url)
            return (
              <button
                key={m._id}
                type="button"
                onClick={() => toggle(m.url)}
                className={cx(
                  'relative aspect-square overflow-hidden rounded-xl border-2 transition-all',
                  selected ? 'border-ink ring-2 ring-ink/20' : 'border-transparent hover:border-ink/25',
                )}
              >
                <img src={m.url} alt={m.alt || m.originalName} className="h-full w-full object-cover" loading="lazy" />
                {selected && (
                  <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-cream">
                    <Icon name="check" size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

/* ----------------------------- image manager ------------------------------ */

/**
 * Product image list: upload straight from here or pick from the library,
 * reorder by moving, and remove. `value` is the product's `images` array.
 * The first image is the one the storefront uses.
 */
export function ImageManager({ value = [], onChange, alt = '' }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const append = (urls) =>
    onChange([...value, ...urls.filter((u) => !value.some((v) => v.url === u)).map((url) => ({ url, alt }))])

  const upload = async (files) => {
    if (!files?.length) return
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(files).forEach((f) => fd.append('files', f))
      const res = await adminApi.upload('/media', fd)
      append(res.media.map((m) => m.url))
      setSavings(optimisationSummary(res.optimisation))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const move = (from, to) => {
    if (to < 0 || to >= value.length) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      {value.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-xl border border-ink/12 bg-sand"
            >
              <img src={img.url} alt={img.alt || alt} className="h-full w-full object-cover" />

              {i === 0 && (
                <Badge tone="success" className="absolute left-1.5 top-1.5">
                  Main
                </Badge>
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-ink/70 p-1.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label="Move earlier"
                  className="grid h-6 w-6 place-items-center rounded text-cream disabled:opacity-30 hover:bg-cream/20"
                >
                  <Icon name="chevronLeft" size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === value.length - 1}
                  aria-label="Move later"
                  className="grid h-6 w-6 place-items-center rounded text-cream disabled:opacity-30 hover:bg-cream/20"
                >
                  <Icon name="chevronRight" size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, n) => n !== i))}
                  aria-label="Remove image"
                  className="grid h-6 w-6 place-items-center rounded text-cream hover:bg-red-500"
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          upload(e.dataTransfer.files)
        }}
        className="rounded-xl border-2 border-dashed border-ink/15 px-5 py-7 text-center transition-colors hover:border-ink/35"
      >
        <Icon name="plus" size={22} className="mx-auto text-ink/30" />
        <p className="mt-2 text-[0.875rem] font-medium">
          {value.length ? 'Add more images' : 'Drop a product photo here'}
        </p>
        <p className="mt-1 text-[0.75rem] text-ink/45">
          JPG, PNG, WebP or AVIF · up to 5 MB each
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Btn size="sm" variant="primary" loading={uploading} onClick={() => inputRef.current?.click()}>
            Upload image
          </Btn>
          <Btn size="sm" onClick={() => setPickerOpen(true)}>
            <Icon name="eye" size={14} /> Choose from Media
          </Btn>
        </div>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-red-600">
          <Icon name="alert" size={13} /> {error}
        </p>
      )}

      {savings && !error && (
        <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-moss">
          <Icon name="checkCircle" size={13} /> Optimised — {savings}
        </p>
      )}

      {value.length > 1 && (
        <p className="mt-2 text-[0.75rem] text-ink/45">
          The first image is used everywhere on the storefront — use the arrows to reorder.
        </p>
      )}

      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={append} />
    </div>
  )
}
