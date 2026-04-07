import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function MyTicketsPage() {
  const [bookings, setBookings] = useState([])
  useEffect(() => {
    fetch(`${API_BASE}/api/bookings/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []))
  }, [])

  return (
    <main className="page-shell">
      <h1>Vé của tôi</h1>
      <table className="table-pele">
        <thead>
          <tr>
            <th>Phim</th>
            <th>Suất</th>
            <th>Ghế</th>
            <th>Tiền</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.movieTitle}</td>
              <td>{b.start_time ? String(b.start_time).slice(0, 16) : '—'}</td>
              <td>{b.seat_numbers}</td>
              <td>{Number(b.total_amount).toLocaleString('vi-VN')}đ</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!bookings.length && <p className="muted">Chưa có vé.</p>}
      <p style={{ marginTop: 16 }}>
        <Link to="/ticket/post">Đăng bán pass vé</Link>
      </p>
    </main>
  )
}
