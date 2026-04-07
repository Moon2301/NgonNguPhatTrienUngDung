import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'
import '../App.css'

export default function UpcomingPage() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/movies/upcoming`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setMovies(d.movies || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="main-wrap">
      <h2 className="movies-section-title">Phim sắp chiếu</h2>
      {loading && <p className="status-msg">Đang tải...</p>}
      <div className="movies-grid">
        {movies.map((m) => (
          <article key={m.id} className="movie-card">
            <Link to={`/movie/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="movie-poster-wrap">
                {m.poster_url ? (
                  <img src={m.poster_url} alt={m.title} />
                ) : (
                  <div className="poster-placeholder">
                    <i className="fa-solid fa-film" />
                    <span>Chưa có poster</span>
                  </div>
                )}
                <div className="movie-overlay">
                  <span className="btn-book">Chi tiết</span>
                </div>
              </div>
              <h3 className="movie-title">{m.title}</h3>
              <p className="movie-meta">
                KC: {m.release_date ? String(m.release_date).slice(0, 10) : '—'}
              </p>
            </Link>
          </article>
        ))}
      </div>
      {!loading && movies.length === 0 && <p className="muted">Chưa có phim sắp chiếu.</p>}
    </main>
  )
}
