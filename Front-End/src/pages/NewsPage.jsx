import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'
import './pages-extra.css'

export default function NewsPage() {
  const [list, setList] = useState([])
  useEffect(() => {
    fetch(`${API_BASE}/api/news`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setList(d.news || []))
  }, [])

  return (
    <main className="page-shell">
      <h1>Tin tức</h1>
      <div className="news-list">
        {list.map((n) => (
          <Link key={n.id} to={`/news/${n.id}`} className="news-card card-pele">
            <h3>{n.title}</h3>
            <p className="muted small">{n.excerpt || ''}</p>
            <span className="small">{n.category} · {n.publishedAt ? String(n.publishedAt).slice(0, 10) : ''}</span>
          </Link>
        ))}
      </div>
      {!list.length && <p className="muted">Chưa có tin.</p>}
    </main>
  )
}
