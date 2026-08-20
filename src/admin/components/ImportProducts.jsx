import { useRef, useState } from 'react'
import { adminApi, getToken, API_BASE } from '@/lib/api'
import { Badge, Btn, Modal, Select } from './ui'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/utils/format'

const ACTION_TONE = {
  create: 'success',
  created: 'success',
  update: 'info',
  updated: 'info',
  skipped: 'neutral',
  error: 'danger',
}

/** The verdicts worth showing first — errors are what the admin must act on. */
const ORDER = { error: 0, skipped: 1, update: 2, updated: 2, create: 3, created: 3 }

/**
 * Bulk import: pick a file, see exactly what will happen to every row, then
 * commit. The preview is a real dry run through the same server-side code that
 * performs the import, so it cannot promise something different from what the
 * commit does.
 */
export function ImportProducts({ open, onClose, onImported }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('create')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setReport(null)
    setError('')
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const send = async (dryRun) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('mode', mode)
      form.append('dryRun', String(dryRun))
      const res = await adminApi.upload('/products/import', form)
      if (dryRun) setPreview(res)
      else {
        setReport(res)
        setPreview(null)
        onImported?.()
      }
    } catch (err) {
      setError(err.message ?? 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const pick = (chosen) => {
    if (!chosen) return
    const ok = /\.(csv|json)$/i.test(chosen.name)
    if (!ok) {
      setError('Please choose a .csv or .json file')
      return
    }
    setFile(chosen)
    setPreview(null)
    setReport(null)
    setError('')
  }

  /**
   * The template is an authenticated download, so it cannot be a plain link —
   * fetch it with the admin token and hand the browser a blob instead.
   */
  const downloadTemplate = async (format) => {
    try {
      const res = await fetch(`${API_BASE}/products/import/template?format=${format}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Could not fetch the template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `product-import-template.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  const shown = report ?? preview
  const rows = shown?.results ? [...shown.results].sort(
    (a, b) => (ORDER[a.action] ?? 9) - (ORDER[b.action] ?? 9) || a.row - b.row,
  ) : []

  const s = shown?.summary
  const willWrite = s ? (s.willCreate ?? 0) + (s.willUpdate ?? 0) : 0

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import products"
      description="Upload a CSV or JSON file. Nothing is saved until you confirm."
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" variant="ghost" onClick={() => downloadTemplate('csv')}>
              <Icon name="arrowRight" size={13} /> CSV template
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => downloadTemplate('json')}>
              <Icon name="arrowRight" size={13} /> JSON template
            </Btn>
          </div>

          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={close}>
              {report ? 'Done' : 'Cancel'}
            </Btn>
            {!report && !preview && (
              <Btn onClick={() => send(true)} disabled={!file || busy} loading={busy}>
                Check the file
              </Btn>
            )}
            {!report && preview && (
              <>
                <Btn variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
                  Back
                </Btn>
                <Btn onClick={() => send(false)} disabled={busy || willWrite === 0} loading={busy}>
                  {willWrite === 0
                    ? 'Nothing to import'
                    : `Import ${willWrite} product${willWrite === 1 ? '' : 's'}`}
                </Btn>
              </>
            )}
          </div>
        </div>
      }
    >
      {/* ---------------------------- pick a file ---------------------------- */}
      {!shown && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pick(e.dataTransfer.files?.[0])
            }}
            onClick={() => inputRef.current?.click()}
            className={cx(
              'cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
              dragging ? 'border-ink bg-ink/[0.04]' : 'border-ink/20 hover:border-ink/40',
            )}
          >
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sand text-ink/50">
              <Icon name={file ? 'checkCircle' : 'plus'} size={22} />
            </span>
            {file ? (
              <>
                <p className="mt-3 font-medium">{file.name}</p>
                <p className="mt-1 text-[0.8125rem] text-ink/50">
                  {(file.size / 1024).toFixed(1)} KB · click to choose a different file
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 font-medium">Drop a .csv or .json file here</p>
                <p className="mt-1 text-[0.8125rem] text-ink/50">or click to browse — up to 2000 products</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>

          <div className="rounded-xl border border-ink/10 p-4">
            <label className="text-[0.8125rem] font-medium">If a product already exists</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-2">
              <option value="create">Skip it — only add products that are new</option>
              <option value="upsert">Update it with the values from the file</option>
            </Select>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-ink/55">
              Existing products are matched on slug first, then SKU.
            </p>
          </div>

          <details className="rounded-xl bg-sand p-4 text-[0.8125rem] leading-relaxed text-ink/70">
            <summary className="cursor-pointer font-medium text-ink">
              How to write the columns
            </summary>
            <ul className="mt-3 space-y-1.5">
              <li>
                <strong>Required:</strong> name, category, price. The category must already exist.
              </li>
              <li>
                <strong>Lists</strong> use a pipe: <code>190x75cm | Chiffon | Hand-hemmed</code>
              </li>
              <li>
                <strong>Colors:</strong> <code>Dusty Rose:#c4787f:12</code> (name:hex:stock)
              </li>
              <li>
                <strong>Sizes:</strong> <code>100ml:0:20 | 200ml:250:5</code> (label:extra price:stock)
              </li>
              <li>
                <strong>Specifications:</strong> <code>Fabric=100% georgette | Length=190cm</code>
              </li>
              <li>Column names are flexible — “Compare at price”, “compareAt” and “MRP” all work.</li>
            </ul>
          </details>

          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[0.8125rem] text-red-700">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
        </div>
      )}

      {/* ------------------------- preview / result -------------------------- */}
      {shown && (
        <div className="space-y-4">
          {report && (
            <p className="flex items-center gap-2 rounded-xl bg-moss/10 px-4 py-3 text-[0.875rem] text-moss">
              <Icon name="checkCircle" size={16} />
              Imported — {s.created} created, {s.updated} updated
              {s.errors > 0 && `, ${s.errors} could not be imported`}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{shown.total} rows read</Badge>
            {(s.willCreate > 0 || s.created > 0) && (
              <Badge tone="success">{s.created || s.willCreate} to create</Badge>
            )}
            {(s.willUpdate > 0 || s.updated > 0) && (
              <Badge tone="info">{s.updated || s.willUpdate} to update</Badge>
            )}
            {s.skipped > 0 && <Badge tone="neutral">{s.skipped} skipped</Badge>}
            {s.errors > 0 && <Badge tone="danger">{s.errors} with errors</Badge>}
          </div>

          {!report && s.errors > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-gold/10 px-4 py-3 text-[0.8125rem] text-ink/75">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-gold" />
              Rows with errors will be left out. Fix them in your file and upload again, or import the
              rest now.
            </p>
          )}

          <div className="max-h-[22rem] overflow-y-auto rounded-xl border border-ink/10">
            <table className="w-full text-[0.8125rem]">
              <thead className="sticky top-0 bg-cream">
                <tr className="border-b border-ink/10 text-left text-ink/50">
                  <th className="w-14 px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="w-24 px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} className="border-b border-ink/5 last:border-0 align-top">
                    <td className="px-3 py-2 text-ink/45">{r.row}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{r.name}</span>
                      {r.slug && <span className="block text-[0.6875rem] text-ink/40">{r.slug}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={ACTION_TONE[r.action] ?? 'neutral'}>{r.action}</Badge>
                    </td>
                    <td className="px-3 py-2 text-ink/60">
                      {r.errors?.length > 0 && (
                        <span className="block text-red-700">{r.errors.join('; ')}</span>
                      )}
                      {r.reason && <span className="block">{r.reason}</span>}
                      {r.warnings?.map((w) => (
                        <span key={w} className="block text-ink/45">
                          {w}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[0.8125rem] text-red-700">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
