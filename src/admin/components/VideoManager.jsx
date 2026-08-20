import { useState } from 'react'
import { Badge, Btn, Input } from './ui'
import { Icon } from '@/components/ui/Icon'
import { youTubeId, youTubeThumb } from '@/utils/video'

/**
 * YouTube videos attached to a product.
 *
 * The id is parsed here purely so the admin gets an instant thumbnail and a
 * clear error before saving — the server re-derives it on write regardless,
 * and that copy is the one the storefront embeds.
 */
export function VideoManager({ value = [], onChange }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const add = () => {
    const videoId = youTubeId(url)
    if (!videoId) {
      setError('That does not look like a YouTube link. Paste the watch, share or Shorts URL.')
      return
    }
    if (value.some((v) => v.videoId === videoId)) {
      setError('That video is already on this product.')
      return
    }
    onChange([
      ...value,
      { videoId, url: `https://www.youtube.com/watch?v=${videoId}`, title: title.trim() },
    ])
    setUrl('')
    setTitle('')
    setError('')
  }

  const move = (from, to) => {
    if (to < 0 || to >= value.length) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const preview = youTubeId(url)

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-3 space-y-2">
          {value.map((video, i) => (
            <li
              key={video.videoId}
              className="flex items-center gap-3 rounded-xl border border-ink/12 p-2.5"
            >
              <img
                src={youTubeThumb(video.videoId)}
                alt=""
                className="h-14 w-24 shrink-0 rounded-lg bg-sand object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem] font-medium">
                  {video.title || 'Product video'}
                </p>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[0.75rem] text-ink/45 underline underline-offset-2 hover:text-plum"
                >
                  {video.videoId}
                </a>
              </div>

              {i === 0 && <Badge tone="success">First</Badge>}

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink/50 hover:bg-ink/[0.06] disabled:opacity-25"
                >
                  <Icon name="chevronUp" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === value.length - 1}
                  aria-label="Move down"
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink/50 hover:bg-ink/[0.06] disabled:opacity-25"
                >
                  <Icon name="chevronDown" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, n) => n !== i))}
                  aria-label="Remove video"
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink/50 hover:bg-red-50 hover:text-red-600"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-ink/12 p-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="min-w-0 flex-1"
          />
          <Btn size="md" onClick={add} disabled={!url.trim()}>
            <Icon name="plus" size={13} /> Add video
          </Btn>
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Caption (optional) — e.g. How to style this hijab"
          className="mt-2"
        />

        {preview && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-moss/8 p-2.5">
            <img src={youTubeThumb(preview)} alt="" className="h-12 w-20 rounded bg-sand object-cover" />
            <p className="text-[0.8125rem] text-moss">
              Found video <strong>{preview}</strong> — press Add.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-red-600">
            <Icon name="alert" size={13} /> {error}
          </p>
        )}

        <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/45">
          Watch links, share links (youtu.be) and Shorts all work. Videos appear in the product
          gallery after the photos.
        </p>
      </div>
    </div>
  )
}
