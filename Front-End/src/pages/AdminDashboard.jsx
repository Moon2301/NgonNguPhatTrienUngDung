import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function AdminDashboard() {
  const [d, setD] = useState(null)
  const [granularity, setGranularity] = useState('week')
  const [series, setSeries] = useState([])

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/dashboard`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setD)
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/revenue-series?granularity=${encodeURIComponent(granularity)}&points=12`, { credentials: 'include' })
      .then((r) => r.json())
      .then((x) => setSeries(x.series || []))
      .catch(() => setSeries([]))
  }, [granularity])

  if (!d) return <main className="page-shell"><p>Đang tải...</p></main>

  const maxRevenue = Math.max(1, ...series.map((s) => Number(s.revenue || 0)))

  return (
    <main className="page-shell">
      <h1>Quản trị</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <div className="card-pele">
          <div className="muted small">Tổng booking</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{d.totalBookings}</div>
        </div>
        <div className="card-pele">
          <div className="muted small">Phim</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{d.totalMovies}</div>
        </div>
        <div className="card-pele">
          <div className="muted small">User</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{d.totalUsers}</div>
        </div>
        <div className="card-pele">
          <div className="muted small">Doanh thu</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Number(d.totalRevenue || 0).toLocaleString('vi-VN')}đ</div>
        </div>
      </div>

      <div className="card-pele" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800 }}>Biểu đồ doanh thu</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={granularity === 'week' ? 'btn-primary-pele' : 'btn-ghost'} onClick={() => setGranularity('week')}>
              Theo tuần
            </button>
            <button type="button" className={granularity === 'month' ? 'btn-primary-pele' : 'btn-ghost'} onClick={() => setGranularity('month')}>
              Theo tháng
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, series.length)}, 1fr)`, gap: 8, alignItems: 'end', height: 160, marginTop: 12 }}>
          {series.map((s) => {
            const h = Math.round((Number(s.revenue || 0) / maxRevenue) * 140)
            return (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                <div title={`${Number(s.revenue || 0).toLocaleString('vi-VN')}đ · ${Number(s.bookings || 0)} bookings`} style={{ width: '100%', height: h, borderRadius: 10, background: 'linear-gradient(180deg, #ff6b6b, #ffb86b)' }} />
                <div className="muted small" style={{ fontSize: 12 }}>{s.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      <p style={{ marginTop: 24 }}>
        <Link to="/admin/movies">Quản lý phim</Link> · <Link to="/admin/showtimes">Suất chiếu</Link> ·{' '}
        <Link to="/admin/bookings">Hóa đơn</Link> · <Link to="/admin/users">Người dùng</Link> · <Link to="/admin/wallet-topups">Nạp ví</Link>
      </p>
    </main>
  )
}
