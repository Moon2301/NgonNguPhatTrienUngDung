import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'
import { useUi } from '../context/useUi.js'

export default function MyPassesPage() {
  const ui = useUi()
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)

  function load() {
    fetch(`${API_BASE}/api/ticket-passes?filter=my`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
          setPasses(d.passes || [])
          setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function cancelPass(p) {
    const ok = await ui.confirm({
      title: 'Huỷ đăng bán',
      message: `Bạc có chắc muốn ngừng rao bán ghế ${p.seat_number || ''} của phim "${p.movieTitle}"?`,
      confirmText: 'Xác nhận huỷ',
      cancelText: 'Đóng',
      tone: 'danger'
    })
    if (!ok) return

    try {
      const res = await fetch(`${API_BASE}/api/ticket-passes/${p.id}/cancel`, { method: 'POST', credentials: 'include' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return ui.toast.error(d.error || 'Huỷ thất bại.')
      ui.toast.success('Đã huỷ đăng bán thành công.')
      load()
    } catch {
      ui.toast.error('Lỗi khi huỷ đăng bán.')
    }
  }

  return (
    <main className="page-shell" style={{ maxWidth: 800, margin: '0 auto' }}>
      <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>Vé đang rao bán</h1>
          <p className="muted">Danh sách các ghế bạn đang đăng bán trên Chợ Vé.</p>
      </header>

      {loading ? (
          <p className="muted">Đang tải...</p>
      ) : passes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <p className="muted">Bạn chưa đăng bán vé nào.</p>
              <Link to="/my-tickets" className="btn-primary-pele" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>Đăng bán từ vé của tôi</Link>
          </div>
      ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {passes.map((p) => (
              <div key={p.id} className="card-pele" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 16, borderRadius: 20 }}>
                <img src={p.posterUrl} style={{ width: 60, height: 80, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} alt="" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 4 }}>
                        {p.movieTitle}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ color: '#e50914', fontWeight: 800, fontSize: 13 }}>Ghế: {p.seat_number}</span>
                        <span className="muted small">Suất: {new Date(p.start_time).toLocaleString('vi-VN')}</span>
                        <span className="muted small">Giá: <strong>{Number(p.pass_price).toLocaleString()}đ</strong></span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                        <span style={{ 
                            fontSize: 9, fontWeight: 900, textTransform: 'uppercase', 
                            padding: '2px 8px', borderRadius: 4, 
                            background: p.status === 'AVAILABLE' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(243, 156, 18, 0.1)',
                            color: p.status === 'AVAILABLE' ? '#2ecc71' : '#f39c12'
                        }}>
                            {p.status === 'AVAILABLE' ? 'Đang rao bán' : (p.status === 'LOCKED' ? 'Đang chờ thanh toán' : p.status)}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/ticket/${p.id}`} className="btn-ghost" style={{ padding: '8px 12px', fontSize: 12, borderRadius: 10, textDecoration: 'none' }}>Chi tiết</Link>
                    {(p.status === 'AVAILABLE' || p.status === 'LOCKED') && (
                      <button type="button" className="btn-danger" onClick={() => cancelPass(p)} style={{ padding: '8px 12px', fontSize: 12, borderRadius: 10 }}>
                        Huỷ bán
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
      )}
    </main>
  )
}
