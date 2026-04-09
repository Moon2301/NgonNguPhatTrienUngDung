// Tự động nhận diện API Base để tránh lỗi CORS/Cookie khi chuyển đổi localhost và IP
const getApiBase = () => {
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const port = 4567 // Port thực tế từ file .env của bạn
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//localhost:${port}`
  }
  return `${protocol}//${hostname}:${port}`
}

export const API_BASE = getApiBase()

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export async function apiPostForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}
