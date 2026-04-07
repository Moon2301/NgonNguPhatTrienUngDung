import { useEffect, useState } from 'react'
import { API_BASE, apiPost } from '../api'

export default function DatingProfilePage() {
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState({})
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/dating/profile`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const p = d.profile || {}
        setForm({
          displayName: p.display_name || '',
          age: p.age || 18,
          height: p.height || 170,
          hometown: p.hometown || '',
          bio: p.bio || '',
          maritalStatus: p.marital_status || 'SINGLE',
          avatarUrl: p.avatar_url || 'https://placehold.co/120x120/1f2833/fff?text=PELE',
          isActive: p.is_active !== false,
        })
        setReady(true)
      })
  }, [])

  async function uploadAvatar(file) {
    setMsg('')
    setUploading(true)
    try {
      if (!file) return
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        throw new Error('Chỉ hỗ trợ ảnh JPG/PNG/WebP.')
      }
      if (file.size > 3 * 1024 * 1024) {
        throw new Error('Ảnh quá lớn (tối đa 3MB).')
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(new Error('Không đọc được file.'))
        r.readAsDataURL(file)
      })

      const res = await apiPost('/api/uploads/avatar', {
        filename: file.name,
        mimeType: file.type,
        dataUrl,
      })
      setForm((f) => ({ ...f, avatarUrl: res.url }))
      setMsg('Đã tải ảnh lên.')
    } finally {
      setUploading(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setMsg('')
    try {
      await apiPost('/api/dating/profile', {
        ...form,
        photo1: null,
        photo2: null,
        photo3: null,
        photo4: null,
      })
      setMsg('Đã lưu.')
    } catch (er) {
      setMsg(er.message)
    }
  }

  if (!ready) return <main className="page-shell"><p>Đang tải...</p></main>

  return (
    <main className="page-shell" style={{ maxWidth: 520 }}>
      <h1>Hồ sơ Dating</h1>
      {msg && <p className="muted">{msg}</p>}
      <form className="form-pele card-pele" onSubmit={save}>
        <label>Ảnh đại diện</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <img
            src={form.avatarUrl}
            alt="avatar"
            style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.12)' }}
          />
          <div style={{ flex: 1 }}>
            <input
              id="avatarFile"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(e) => uploadAvatar(e.target.files?.[0])}
              style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
            />
            <label htmlFor="avatarFile" className="btn-clear" style={{ display: 'inline-block', padding: '10px 14px' }}>
              {uploading ? 'Đang tải...' : 'Chọn ảnh'}
            </label>
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              JPG/PNG/WebP, tối đa 3MB.
            </p>
          </div>
        </div>
        <label>Tên hiển thị</label>
        <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
        <label>Tuổi</label>
        <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} />
        <label>Chiều cao (cm)</label>
        <input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: Number(e.target.value) })} />
        <label>Quê quán</label>
        <input value={form.hometown} onChange={(e) => setForm({ ...form, hometown: e.target.value })} required />
        <label>Giới thiệu</label>
        <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
        <label>Tình trạng</label>
        <select value={form.maritalStatus} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}>
          <option value="SINGLE">Độc thân</option>
          <option value="MARRIED">Đã kết hôn</option>
        </select>
        <div className="toggle-row">
          <span className="toggle-label">Hiển thị hồ sơ</span>
          <label className="toggle-switch" aria-label="Hiển thị hồ sơ">
            <input
              type="checkbox"
              checked={!!form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        <button type="submit" className="btn-primary-pele">
          Lưu
        </button>
      </form>
    </main>
  )
}
