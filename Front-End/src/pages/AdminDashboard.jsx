import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function AdminDashboard() {
  const [d, setD] = useState(null)
  useEffect(() => {
    fetch(`${API_BASE}/api/admin/dashboard`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setD)
  }, [])

  if (!d) return <main className="page-shell"><p>Đang tải...</p></main>

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
      <p style={{ marginTop: 24 }}>
        <Link to="/admin/movies">Quản lý phim</Link> · <Link to="/admin/showtimes">Suất chiếu</Link> ·{' '}
        <Link to="/admin/bookings">Hóa đơn</Link> · <Link to="/admin/users">Người dùng</Link>
      </p>
    </main>
  )
}
