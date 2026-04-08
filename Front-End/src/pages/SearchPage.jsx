import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../api'
import '../App.css'
//Diem
export default function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    const qs = q.trim() ? `?keyword=${encodeURIComponent(q.trim())}` : ''
    setLoading(true)
    fetch(`${API_BASE}/api/movies${qs}`, { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Lỗi')
        return d
      })
      .then((d) => {
        if (!ignore) setMovies(d.movies || [])
      })
      .catch((e) => {
        if (!ignore) setError(e.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [q])

  return (
    <main className="main-wrap">
      <h2 className="movies-section-title">Kết quả tìm kiếm: &quot;{q || '—'}&quot;</h2>
      {loading && <p className="status-msg">Đang tải...</p>}
      {error && <p className="status-msg error">{error}</p>}
      <div className="movies-grid">
        {movies.map((m) => (
          <article key={m.id} className="movie-card">
            <Link to={`/movie/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="movie-poster-wrap">
                {m.poster_url ? (
                  <img src={m.poster_url} alt={m.title} loading="lazy" />
                ) : (
                  <div className="poster-placeholder">
                    <i className="fa-solid fa-film" />
                    <span>Chưa có poster</span>
                  </div>
                )}
                <div className="movie-overlay">
                  <span className="btn-book">Đặt vé</span>
                </div>
              </div>
              <h3 className="movie-title">{m.title}</h3>
              <p className="movie-meta">
                {m.genre || '—'} · {m.duration ? `${m.duration} phút` : '—'}
              </p>
            </Link>
          </article>
        ))}
      </div>
      {!loading && !movies.length && <p className="muted">Không tìm thấy phim.</p>}
    </main>
  )
}
