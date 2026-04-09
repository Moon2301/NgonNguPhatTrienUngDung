import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import { useUi } from '../context/useUi.js'

const empty = {
  id: undefined,
  code: '',
  title: '',
  description: '',
  discountAmount: 0,
  discountPercent: 0,
  expiresAt: '',
  active: true,
  usageLimit: '',
}

export default function AdminPromotions() {
  const ui = useUi()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(empty)

  function load() {
    fetch(`${API_BASE}/api/admin/promotions`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRows(d.promotions || []))
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e) {
    e.preventDefault()
    if (!String(form.code || '').trim()) return ui.toast.warn('Nhập code.')
    if (!String(form.title || '').trim()) return ui.toast.warn('Nhập tiêu đề.')
    try {
      await apiPost('/api/admin/promotions', {
        ...form,
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        expiresAt: form.expiresAt || null,
      })
      ui.toast.success(form.id ? 'Đã cập nhật khuyến mãi.' : 'Đã tạo khuyến mãi.')
      setForm(empty)
      load()
    } catch (er) {
      ui.toast.error(er.message)
    }
  }

  async function del(id) {
    const ok = await ui.confirm({ title: 'Xóa khuyến mãi', message: `Xóa #${id}?`, confirmText: 'Xóa', cancelText: 'Hủy' })
    if (!ok) return
    await fetch(`${API_BASE}/api/admin/promotions/${id}`, { method: 'DELETE', credentials: 'include' })
    ui.toast.success('Đã xóa.')
    load()
  }

  function edit(p) {
    const expiresAt = p.expires_at ? String(p.expires_at).slice(0, 10) : ''
    setForm({
      id: p.id,
      code: p.code || '',
      title: p.title || '',
      description: p.description || '',
      discountAmount: Number(p.discount_amount || 0),
      discountPercent: Number(p.discount_percent || 0),
      expiresAt,
      active: p.active !== false,
      usageLimit: p.usage_limit == null ? '' : String(p.usage_limit),
    })
  }

  return (
    <main className="page-shell">
      <Link
        to="/admin"
        className="admin-back btn-ghost"
        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}
      >
        ← Dashboard
      </Link>
      <h1 style={{ marginTop: 8 }}>Khuyến mãi</h1>

      <form className="form-pele card-pele" onSubmit={save} noValidate style={{ maxWidth: 820 }}>
        <h3 style={{ marginTop: 0 }}>{form.id ? `Sửa #${form.id}` : 'Tạo khuyến mãi'}</h3>
        <label>Code</label>
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <label>Tiêu đề</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <label>Mô tả</label>
        <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label>Giảm tiền (đ)</label>
            <input type="number" min={0} value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })} />
          </div>
          <div>
            <label>Giảm %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.discountPercent}
              onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label>Hết hạn</label>
            <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <div>
            <label>Giới hạn lượt dùng</label>
            <input
              type="number"
              min={0}
              placeholder="Để trống = không giới hạn"
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
            />
          </div>
        </div>
        <label>
          <input
            type="checkbox"
            checked={!!form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            style={{ width: 18, height: 18, marginRight: 8 }}
          />
          Kích hoạt
        </label>
        <button type="submit" className="btn-primary-pele">
          Lưu
        </button>
      </form>

      <table className="table-pele" style={{ marginTop: 18 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Code</th>
            <th>Tiêu đề</th>
            <th>Lượt</th>
            <th>Hết hạn</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td style={{ fontWeight: 800, color: '#ff6b6b' }}>{p.code}</td>
              <td>{p.title}</td>
              <td>
                {Number(p.usage_count || 0).toLocaleString('vi-VN')}
                {p.usage_limit != null ? ` / ${Number(p.usage_limit).toLocaleString('vi-VN')}` : ''}
              </td>
              <td>{p.expires_at ? String(p.expires_at).slice(0, 10) : '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="btn-ghost" style={{ marginRight: 8 }} onClick={() => edit(p)}>
                  Sửa
                </button>
                <button type="button" className="btn-danger" onClick={() => del(p.id)}>
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="muted">Chưa có khuyến mãi.</p>}
    </main>
  )
}

