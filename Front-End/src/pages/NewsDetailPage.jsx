import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { API_BASE } from '../api'
import './pages-extra.css'

export default function NewsDetailPage() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/news/${id}`, { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Lỗi')
        return d.article
      })
      .then(setArticle)
      .catch(() => setErr('Lỗi tải'))
  }, [id])

  if (err) return <main className="page-shell"><p className="muted">{err}</p></main>
  if (!article) return <main className="page-shell"><p>Đang tải...</p></main>

  return (
    <main className="page-shell">
      <Link to="/news" className="back-link">← Tin tức</Link>
      <h1>{article.title}</h1>
      <p className="muted small">{article.author} · {article.category} · {article.published_at ? String(article.published_at).slice(0, 10) : ''}</p>
      <div className="article-body card-pele" dangerouslySetInnerHTML={{ __html: (article.content || '').replace(/\n/g, '<br/>') }} />
    </main>
  )
}
