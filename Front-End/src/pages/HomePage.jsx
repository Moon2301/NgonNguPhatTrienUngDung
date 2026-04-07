import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'
import '../App.css'

export default function HomePage() {
  const [movies, setMovies] = useState([])
  const [promotions, setPromotions] = useState([])
  const [keyword, setKeyword] = useState('')
  const [genre, setGenre] = useState('')
  const [genreList, setGenreList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    fetch(`${API_BASE}/api/movies`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (ignore || !d.movies) return
        const set = new Set()
        d.movies.forEach((m) => {
          if (m.genre && String(m.genre).trim()) set.add(String(m.genre).trim())
        })
        setGenreList(Array.from(set).sort())
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (keyword.trim()) p.set('keyword', keyword.trim())
    else if (genre.trim()) p.set('genre', genre.trim())
    return p.toString()
  }, [keyword, genre])

  useEffect(() => {
    let ignore = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/movies${qs ? `?${qs}` : ''}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Lỗi tải phim')
        if (!ignore) setMovies(data.movies || [])
      } catch (e) {
        if (!ignore) setError(e.message || 'Lỗi')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [qs])

  useEffect(() => {
    let ignore = false
    fetch(`${API_BASE}/api/promotions`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!ignore) setPromotions(d.promotions || [])
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  function pickGenre(g) {
    setGenre(g)
    if (g) setKeyword('')
  }

  return (
    <>
      <section className="hero-section">
        <div className="hero-inner">
          <h1 className="hero-title">Trải nghiệm điện ảnh đỉnh cao</h1>
          <p className="hero-sub">Đặt vé nhanh — chọn ghế tiện lợi. PELE Cinema.</p>
        </div>
      </section>

      <main className="main-wrap">
        {promotions.length > 0 && (
          <div className="promo-panel">
            <h2>
              <i className="fa-solid fa-tags" />
              Khuyến mãi đang hoạt động
            </h2>
            <div className="promo-chips">
              {promotions.slice(0, 8).map((p) => (
                <span key={p.id} className="promo-chip">
                  <code>{p.code}</code> — {p.title}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="filters-row">
          <div className="section-label">Thể loại</div>
          <div className="category-scroll">
            <button
              type="button"
              className={`btn-genre ${!genre && !keyword.trim() ? 'active' : ''}`}
              onClick={() => pickGenre('')}
            >
              Tất cả
            </button>
            {genreList.map((g) => (
              <button
                key={g}
                type="button"
                className={`btn-genre ${genre === g ? 'active' : ''}`}
                onClick={() => pickGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="section-label">Tìm phim</div>
          <div className="search-row">
            <input
              className="search-input"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                if (e.target.value.trim()) setGenre('')
              }}
              placeholder="Tìm phim theo tên..."
            />
            <button type="button" className="btn-clear" onClick={() => setKeyword('')}>
              Xóa
            </button>
          </div>
        </div>

        {loading && (
          <div className="status-msg">
            <i className="fa-solid fa-spinner fa-spin" /> Đang tải...
          </div>
        )}
        {error && (
          <div className="status-msg error">
            <i className="fa-solid fa-circle-exclamation" /> {error}
          </div>
        )}

        <h2 className="movies-section-title">Phim đang chiếu</h2>

        {!loading && !error && movies.length === 0 && (
          <div className="empty-state">
            <div>
              <i className="fa-solid fa-clapperboard" />
            </div>
            <p>Chưa có phim. Chạy backend và seed.</p>
          </div>
        )}

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
      </main>
    </>
  )
}

