import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function MyPassesPage() {
  const [passes, setPasses] = useState([])
  useEffect(() => {
    fetch(`${API_BASE}/api/ticket-passes/me/list`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPasses(d.passes || []))
  }, [])

  return (
    <main className="page-shell">
      <h1>Vé đang bán</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {passes.map((p) => (
          <li key={p.id} className="card-pele" style={{ marginBottom: 8 }}>
            <Link to={`/ticket/${p.id}`}>
              #{p.id} — {p.movieTitle} — {Number(p.pass_price).toLocaleString('vi-VN')}đ — {p.status}
            </Link>
          </li>
        ))}
      </ul>
      {!passes.length && <p className="muted">Chưa đăng bán vé nào.</p>}
    </main>
  )
}
