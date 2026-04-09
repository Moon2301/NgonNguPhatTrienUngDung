import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

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
            <h4 style={{ marginTop: 0 }}>{p.movieTitle}</h4>
            <p className="small muted">{p.seat_numbers}</p>
            <p style={{ fontWeight: 800, color: '#e50914' }}>{Number(p.pass_price).toLocaleString('vi-VN')}đ</p>
            <span className="small">{p.status}</span>
          </Link>
        ))}
      </div>
      {!passes.length && <p className="muted">Không có vé pass.</p>}
    </main>
  )
}
