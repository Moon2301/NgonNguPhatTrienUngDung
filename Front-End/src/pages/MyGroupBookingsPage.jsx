import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function MyGroupBookingsPage() {
  const [list, setList] = useState([])
  useEffect(() => {
    fetch(`${API_BASE}/api/group-bookings/me/list`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setList(d.groupBookings || []))
  }, [])

  return (
    <main className="page-shell">
      <h1>Vé nhóm của tôi</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {list.map((g) => (
          <li key={g.id} className="card-pele" style={{ marginBottom: 8 }}>
            <Link to={`/group/${g.room_code}`}>
              Mã {g.room_code} — {g.movieTitle} — {g.start_time ? String(g.start_time).slice(0, 16) : ''}
            </Link>
          </li>
        ))}
      </ul>
      {!list.length && <p className="muted">Chưa có phòng nhóm.</p>}
    </main>
  )
}
