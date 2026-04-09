import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'

export default function AdminBookings() {
  const [bookings, setBookings] = useState([])

  function load() {
    fetch(`${API_BASE}/api/admin/bookings`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []))
  }

  useEffect(() => {
    load()
  }, [])

  async function setStatus(id, status) {
    try {
      await apiPost(`/api/admin/bookings/${id}/status`, { status })
      load()
    } catch (er) {
      alert(er.message)
    }
  }

  return (
    <main className="page-shell">
      <Link to="/admin" className="back-link">
        ← Dashboard
      </Link>
      <h1>Quản lý hóa đơn</h1>
      <table className="table-pele">
        <thead>
          <tr>
            <th>ID</th>
            <th>Khách</th>
            <th>Phim</th>
            <th>Tiền</th>
            <th>TT</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.customer_name}</td>
              <td>{b.movieTitle}</td>
              <td>{Number(b.total_amount).toLocaleString('vi-VN')}</td>
              <td>
                <select value={b.status || 'SUCCESS'} onChange={(e) => setStatus(b.id, e.target.value)}>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
