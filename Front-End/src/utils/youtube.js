export function toYoutubeEmbedUrl(url) {
  if (!url || !String(url).trim()) return ''
  const u = String(url).trim()
  if (u.includes('youtube.com/embed/')) return u
  const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  return u
}
