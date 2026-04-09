import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import { useUi } from '../context/useUi.js'

function toMoney(n) {
  return Number(n || 0).toLocaleString('vi-VN')
}

export default function AdminProducts() {
  const ui = useUi()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [category, setCategory] = useState('')
  const [active, setActive] = useState(true)

  async function load() {
    const r = await fetch(`${API_BASE}/api/admin/products`, { credentials: 'include' })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || 'Lỗi tải dịch vụ')
    setRows(Array.isArray(d.products) ? d.products : [])
  }

  useEffect(() => {
    load().catch((e) => ui.toast.error(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categories = useMemo(() => {
    const set = new Set()
    for (const p of rows) if (p?.category) set.add(String(p.category))
    return Array.from(set)
  }, [rows])

  function resetForm() {
    setEditingId(null)
    setName('')
    setPrice('')
    setImageUrl('')
    setCategory('')
    setActive(true)
  }

  function startEdit(p) {
    setEditingId(Number(p.id))
    setName(String(p.name || ''))
    setPrice(String(Number(p.price || 0)))
    setImageUrl(String(p.image_url || p.imageUrl || ''))
    setCategory(String(p.category || ''))
    setActive(typeof p.active === 'boolean' ? p.active : true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(e) {
    e.preventDefault()
    if (!String(name || '').trim()) return ui.toast.warn('Vui lòng nhập tên dịch vụ.')
    const p = Number(String(price).replace(/[^\d]/g, '') || 0)
    if (!Number.isFinite(p) || p < 0) return ui.toast.warn('Giá không hợp lệ.')
    setLoading(true)
    try {
      await apiPost('/api/admin/products', {
        id: editingId || undefined,
        name: name.trim(),
        price: p,
        imageUrl: imageUrl.trim() || null,
        category: category.trim() || null,
        active,
      })
      ui.toast.success(editingId ? 'Đã cập nhật.' : 'Đã tạo dịch vụ.')
      resetForm()
      await load()
    } catch (e2) {
      ui.toast.error(e2.message)
    } finally {
      setLoading(false)
    }
  }

  async function del(p) {
    const ok = await ui.confirm({
      title: 'Xóa dịch vụ?',
      message: `Bạn chắc chắn muốn xóa "${p.name}"?`,
      confirmText: 'Xóa',
      danger: true,
    })
    if (!ok) return
    try {
      const r = await fetch(`${API_BASE}/api/admin/products/${p.id}`, { method: 'DELETE', credentials: 'include' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Xóa thất bại')
      ui.toast.success('Đã xóa.')
      await load()
    } catch (e) {
      ui.toast.error(e.message)
    }
  }

  return (
    <main className="page-shell">
      <Link to="/admin" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        ← Dashboard
      </Link>
      <h1 style={{ marginTop: 12 }}>Dịch vụ / Combo</h1>

      <form className="form-pele card-pele" onSubmit={save} style={{ maxWidth: 720 }}>
        <label>Tên</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Combo Bắp + 2 Nước" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Giá (VND)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="99000" />
          </div>
          <div>
            <label>Danh mục</label>
            <input list="svc-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Combo / Nước / ..." />
            <datalist id="svc-cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <label>Ảnh (URL)</label>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ margin: 0 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Đang hoạt động
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={resetForm}>
                Hủy sửa
              </button>
            )}
            <button type="submit" className="btn-primary-pele" disabled={loading}>
              {loading ? '...' : editingId ? 'Cập nhật' : 'Tạo dịch vụ'}
            </button>
          </div>
        </div>
      </form>

      <div className="card-pele" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Danh sách</h3>
        {!rows.length ? (
          <p className="muted">Chưa có dịch vụ.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-pele">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Danh mục</th>
                  <th>Giá</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 180 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 800 }}>{p.name}</td>
                    <td className="muted">{p.category || '-'}</td>
                    <td>{toMoney(p.price)}đ</td>
                    <td>{p.active === false ? <span className="muted">Tắt</span> : <span style={{ color: '#5ce08a', fontWeight: 800 }}>Bật</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn-ghost" onClick={() => startEdit(p)}>
                          Sửa
                        </button>
                        <button type="button" className="btn-danger" onClick={() => del(p)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

