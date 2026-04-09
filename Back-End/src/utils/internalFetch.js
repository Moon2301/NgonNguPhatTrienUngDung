export async function apiFetchJson(path, { method = 'GET', body } = {}) {
  const base = process.env.INTERNAL_BASE_URL || `http://localhost:${process.env.PORT || 4000}`
  const url = `${base}${path}`
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: 500 })
  return data
}

