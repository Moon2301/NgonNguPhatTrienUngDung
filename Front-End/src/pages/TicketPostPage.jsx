import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'

export default function TicketPostPage() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [bookingId, setBookingId] = useState('')
  const [passPrice, setPassPrice] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/bookings/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    try {
      await apiPost('/api/ticket-passes', {
        bookingId: Number(bookingId),
        passPrice: Number(passPrice),
      })
      navigate('/ticket-market')
    } catch (er) {
      setErr(er.message)
    }
  }

  return (
    <main className="page-shell" style={{ maxWidth: 480 }}>
      <Link to="/ticket-market" className="back-link">
        ← Chợ vé
      </Link>
      <h1>Đăng bán pass</h1>
      <form className="form-pele card-pele" onSubmit={submit}>
        {err && <p style={{ color: '#ff6b6b' }}>{err}</p>}
        <label>Chọn booking</label>
        <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} required>
          <option value="">--</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              #{b.id} — {b.movieTitle} — {b.seat_numbers}
            </option>
          ))}
        </select>
        <label>Giá pass (VNĐ)</label>
        <input type="number" min={0} value={passPrice} onChange={(e) => setPassPrice(e.target.value)} required />
        <button type="submit" className="btn-primary-pele">
          Đăng
        </button>
      </form>
    </main>
  )
}
