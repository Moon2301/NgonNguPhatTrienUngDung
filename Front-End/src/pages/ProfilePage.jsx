import { useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { useAuth } from '../context/useAuth.js'
import { useUi } from '../context/useUi.js'

export default function ProfilePage() {
  const { refresh } = useAuth()
  const ui = useUi()
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    age: '',
    phone: '',
    email: '',
    wallet: 0,
  })

  useEffect(() => {
    let ignore = false
    fetch(`${API_BASE}/api/profile`, { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'Lỗi')
        return d
      })
      .then((d) => {
        if (ignore) return
        const p = d.profile || {}
        setForm({
          fullName: p.fullName || '',
          age: p.age ?? '',
          phone: p.phone || '',
          email: p.email || '',
          wallet: Number(p.wallet || 0),
        })
        setReady(true)
      })
      .catch((e) => {
        if (ignore) return
        ui.toast.error(e.message || 'Không tải được hồ sơ.')
        setReady(true)
      })
    return () => {
      ignore = true
    }
  }, [ui.toast])

  async function save(e) {
    e.preventDefault()
    if (!String(form.fullName || '').trim()) return ui.toast.warn('Vui lòng nhập họ tên.')
    if (!String(form.email || '').trim()) return ui.toast.warn('Vui lòng nhập email.')

    const ageVal = form.age === '' ? null : Number(form.age)
    if (ageVal != null && (!Number.isFinite(ageVal) || ageVal < 1 || ageVal > 120)) {
      return ui.toast.warn('Tuổi không hợp lệ.')
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: String(form.fullName || '').trim(),
          email: String(form.email || '').trim(),
          phone: String(form.phone || '').trim() || null,
          age: ageVal,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Lưu thất bại')
      ui.toast.success('Đã lưu hồ sơ.')
      await refresh()
    } catch (er) {
      ui.toast.error(er.message || 'Lưu thất bại.')
    } finally {
      setSaving(false)
    }
  }

  if (!ready) return <main className="page-shell"><p>Đang tải...</p></main>

  return (
    <main className="page-shell" style={{ maxWidth: 520 }}>
      <h1>Hồ sơ</h1>
      <form className="form-pele card-pele" onSubmit={save} noValidate>
        <label>Họ tên</label>
        <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />

        <label>Tuổi</label>
        <input
          type="number"
          min={1}
          max={120}
          value={form.age}
          onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
        />

        <label>Số điện thoại</label>
        <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />

        <label>Túi tiền</label>
        <input value={`${Number(form.wallet || 0).toLocaleString('vi-VN')}đ`} disabled />

        <button type="submit" className="btn-primary-pele" disabled={saving}>
          {saving ? '...' : 'Lưu'}
        </button>
      </form>
    </main>
  )
}

