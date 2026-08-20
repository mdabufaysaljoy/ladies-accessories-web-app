/**
 * YouTube helpers shared by the admin editor and the storefront gallery.
 *
 * This mirrors `parseYouTubeId` on the server. The server's copy is the one
 * that decides what gets stored; this one exists so the admin can validate a
 * pasted link and show a thumbnail without a round trip.
 */
export function youTubeId(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  if (/^[\w-]{11}$/.test(raw)) return raw

  let url
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const allowed = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'youtu.be']
  if (!allowed.includes(host)) return null

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return /^[\w-]{11}$/.test(id) ? id : null
  }

  const v = url.searchParams.get('v')
  if (v && /^[\w-]{11}$/.test(v)) return v

  const match = url.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/)
  return match ? match[2] : null
}

/**
 * `hqdefault` exists for every video; `maxresdefault` does not, and a missing
 * one renders as a broken grey box. The lower resolution is the safe default
 * for a thumbnail that is never shown larger than a gallery tile.
 */
export const youTubeThumb = (videoId) =>
  videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''

/**
 * Privacy-preserving embed, only ever built from an id we parsed ourselves.
 * `autoplay=1` is intended: the iframe is inserted after a click, so the
 * viewer has already asked for the video to play.
 */
export const youTubeEmbed = (videoId) =>
  `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
