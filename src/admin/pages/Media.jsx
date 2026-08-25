import { useCallback, useEffect, useRef, useState } from 'react'
import { optimisationSummary } from '@/utils/format'
import { adminApi } from '@/lib/api'
import { AdminPage, Btn, Card, ConfirmDialog, EmptyRow, Spinner, useToasts } from '../components/ui'
import { Icon } from '@/components/ui/Icon'

const kb = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`)

export default function Media() {
  const [data, setData] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const inputRef = useRef(null)
  const { push, node } = useToasts()

  const load = useCallback(async () => {
    try {
      setData(await adminApi.get('/media?limit=60'))
    } catch (err) {
      push(err.message, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const upload = async (files) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(files).forEach((f) => fd.append('files', f))
      const res = await adminApi.upload('/media', fd)
      const summary = optimisationSummary(res.optimisation)
      push(
        `${res.media.length} file${res.media.length > 1 ? 's' : ''} uploaded` +
          (summary ? ` — ${summary}` : ''),
      )
      load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      push('URL copied — paste it into a product', 'info')
    } catch {
      push('Could not copy — select the URL manually', 'error')
    }
  }

  return (
    <AdminPage
      title="Media"
      subtitle="Product photos, logos and anything else you need a URL for"
      actions={
        <Btn variant="primary" size="md" loading={uploading} onClick={() => inputRef.current?.click()}>
          <Icon name="plus" size={15} /> Upload images
        </Btn>
      }
    >
      {node}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      <Card
        padded={false}
        className="mb-4"
      >
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files) }}
          className="m-4 rounded-xl border-2 border-dashed border-ink/15 px-6 py-9 text-center transition-colors hover:border-ink/35"
        >
          <Icon name="plus" size={24} className="mx-auto text-ink/30" />
          <p className="mt-2.5 text-[0.9375rem] font-medium">Drop images here, or click Upload</p>
          <p className="mt-1 text-[0.75rem] text-ink/45">
            JPG, PNG, WebP, AVIF or SVG · up to 10 MB each · 10 files at a time
          </p>
        </div>
      </Card>

      {!data ? (
        <Spinner />
      ) : data.media.length === 0 ? (
        <Card><EmptyRow icon="eye" title="No files yet" body="Upload your product photos to use them across the shop." /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {data.media.map((m) => (
            <div key={m._id} className="group overflow-hidden rounded-xl border border-ink/10 bg-white">
              <div className="aspect-square bg-sand">
                <img src={m.url} alt={m.alt || m.originalName} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="p-2.5">
                <p className="truncate text-[0.75rem] font-medium" title={m.originalName}>{m.originalName}</p>
                <p className="text-[0.6875rem] text-ink/45">{kb(m.size)}</p>
                <div className="mt-2 flex gap-1.5">
                  <Btn size="xs" className="flex-1" onClick={() => copyUrl(m.url)}>Copy URL</Btn>
                  <Btn size="xs" variant="danger" onClick={() => setConfirm(m)} aria-label="Delete">
                    <Icon name="trash" size={11} />
                  </Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Delete this file?"
        body="Any product still pointing at this URL will fall back to generated artwork."
        onConfirm={async () => {
          await adminApi.delete(`/media/${confirm._id}`)
          push('File deleted')
          load()
        }}
      />
    </AdminPage>
  )
}
