import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

function fmtDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('vi-VN')
}

function statusLabel(s) {
  const v = String(s || '').toUpperCase()
  if (v === 'AVAILABLE') return 'Còn bán'
  if (v === 'LOCKED') return 'Đang được giữ'
  if (v === 'SOLD') return 'Đã bán'
  if (v === 'CANCELLED') return 'Đã hủy'
  return v || '—'
}

export default function TicketMarketPage() {
  const [passes, setPasses] = useState([])
  const [kw, setKw] = useState('')

  function load() {
    const q = kw.trim() ? `?keyword=${encodeURIComponent(kw.trim())}` : ''
    fetch(`${API_BASE}/api/ticket-passes${q}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPasses(d.passes || []))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="page-shell">
      <h1>Chợ pass vé</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="search-input"
          style={{ maxWidth: 280 }}
          placeholder="Tìm theo tên phim..."
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />
        <button type="button" className="btn-ghost" onClick={load}>
          Tìm
        </button>
        <Link to="/ticket/post" className="btn-primary-pele" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          Đăng bán
        </Link>
      </div>
      <div className="promo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {passes.map((p) => (
          <Link key={p.id} to={`/ticket/${p.id}`} className="card-pele" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'stretch' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>{p.movieTitle}</h4>
                <p className="small muted" style={{ margin: '0 0 6px' }}>
                  Ghế: {p.seat_number || '—'}
                </p>
                <p className="small muted" style={{ margin: '0 0 10px' }}>
                  Suất chiếu: {fmtDateTime(p.start_time)}
                </p>
                <p style={{ fontWeight: 800, color: '#e50914', margin: 0 }}>{Number(p.pass_price).toLocaleString('vi-VN')}đ</p>
                <span className="small muted">{statusLabel(p.status)}</span>
              </div>
              <div
                style={{
                  width: 86,
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.06)',
                  flex: '0 0 auto',
                }}
              >
                {p.posterUrl ? (
                  <img src={p.posterUrl} alt={p.movieTitle || 'poster'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: 120 }} />
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {!passes.length && <p className="muted">Không có vé pass.</p>}
    </main>
  )
}
