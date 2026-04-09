import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

function RevenueBars({ series }) {
  const items = Array.isArray(series) ? series : []
  const max = Math.max(0, ...items.map((x) => Number(x?.revenue || 0)))
  return (
    <div className="card-pele" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div style={{ fontWeight: 900 }}>Biểu đồ doanh thu</div>
        <div className="muted small">{items.length ? `Max: ${max.toLocaleString('vi-VN')}đ` : 'Chưa có dữ liệu'}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(10px, 1fr))`, gap: 8, marginTop: 12, alignItems: 'end', height: 160 }}>
        {items.map((x) => {
          const v = Number(x?.revenue || 0)
          const h = max > 0 ? Math.max(2, Math.round((v / max) * 140)) : 2
          return (
            <div key={x.key || x.label} style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              <div
                title={`${x.label}: ${v.toLocaleString('vi-VN')}đ (${Number(x?.bookings || 0)} booking)`}
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: 10,
                  background: 'linear-gradient(180deg, rgba(229,9,20,0.95), rgba(229,9,20,0.35))',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              />
              <div className="muted small" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {x.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [d, setD] = useState(null)
  const [gran, setGran] = useState('week')
  const [series, setSeries] = useState([])
  const [seriesErr, setSeriesErr] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/dashboard`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setD)
  }, [])

  useEffect(() => {
    setSeriesErr('')
    fetch(`${API_BASE}/api/admin/revenue-series?granularity=${encodeURIComponent(gran)}&points=12`, { credentials: 'include' })
      .then(async (r) => {
        const x = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(x.error || 'Lỗi tải biểu đồ')
        return x
      })
      .then((x) => setSeries(x.series || []))
      .catch((e) => setSeriesErr(e.message || 'Lỗi tải biểu đồ'))
  }, [gran])

  if (!d) return <main className="page-shell"><p>Đang tải...</p></main>

  return (
    <main className="page-shell">
      <h1>Quản trị</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginTop: 12 }}>
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" className="btn-ghost" onClick={() => setGran('week')} style={{ borderColor: gran === 'week' ? 'rgba(229,9,20,0.8)' : undefined }}>
          Theo tuần
        </button>
        <button type="button" className="btn-ghost" onClick={() => setGran('month')} style={{ borderColor: gran === 'month' ? 'rgba(229,9,20,0.8)' : undefined }}>
          Theo tháng
        </button>
        {seriesErr && <span className="muted small">{seriesErr}</span>}
      </div>
      <RevenueBars series={series} />

      <div
        className="admin-nav-links"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 24,
        }}
      >
        <Link to="/admin/movies" className="btn-ghost">
          Quản lý phim
        </Link>
        <Link to="/admin/showtimes" className="btn-ghost">
          Suất chiếu
        </Link>
        <Link to="/admin/seat" className="btn-ghost">
          Sơ đồ ghế
        </Link>
        <Link to="/admin/bookings" className="btn-ghost">
          Hóa đơn
        </Link>
        <Link to="/admin/promotions" className="btn-ghost">
          Khuyến mãi
        </Link>
        <Link to="/admin/products" className="btn-ghost">
          Dịch vụ
        </Link>
        <Link to="/admin/users" className="btn-ghost">
          Người dùng
        </Link>
      </div>
    </main>
  )
}
