import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import { useAuth } from '../context/useAuth.js'
import { useUi } from '../context/useUi.js'
import { toYoutubeEmbedUrl } from '../utils/youtube'
import '../App.css'

export default function MovieDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const ui = useUi()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [comments, setComments] = useState([])
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(5)
  const [err, setErr] = useState('')
  const [activeDate, setActiveDate] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/movies/${id}`, { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Lỗi')
        return d
      })
      .then(setData)
      .catch((e) => setErr(e.message))
  }, [id])

  useEffect(() => {
    fetch(`${API_BASE}/api/comments/movie/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setComments(d.comments || []))
  }, [id])

  async function sendComment(e) {
    e.preventDefault()
    if (!user) return
    if (!String(content || '').trim()) return ui.toast.warn('Vui lòng nhập nội dung bình luận.')
    try {
      await apiPost('/api/comments', { movieId: Number(id), content, rating })
      setContent('')
      const r = await fetch(`${API_BASE}/api/comments/movie/${id}`, { credentials: 'include' })
      const d = await r.json()
      setComments(d.comments || [])
      ui.toast.success('Đã gửi bình luận.')
    } catch (er) {
      ui.toast.error(er.message)
    }
  }

  if (err || !data) return <main className="page-shell"><p>{err || 'Đang tải...'}</p></main>

  const { movie, showtimes } = data
  const embed = toYoutubeEmbedUrl(movie.trailer_url)

  const groups = (() => {
    const map = new Map()
    for (const s of showtimes || []) {
      const d = s.start_time ? new Date(s.start_time) : null
      if (!d) continue
      const key = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return Array.from(map.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  })()

  const dateKeys = groups.map(([k]) => k)
  const selectedDate = activeDate && dateKeys.includes(activeDate) ? activeDate : dateKeys[0] || ''
  const selectedShowtimes = selectedDate ? groups.find(([k]) => k === selectedDate)?.[1] || [] : []

  return (
    <div className="movie-detail-root anim-fade-in">
      {/* Background Backdrop */}
      <div className="movie-backdrop" style={{ backgroundImage: `url(${movie.poster_url})` }}></div>
      <div className="movie-backdrop-overlay"></div>

      <main className="page-shell movie-detail-container" style={{ position: 'relative', zIndex: 5, paddingTop: 40 }}>
        <div style={{ marginBottom: 32 }}>
            <Link to="/" className="back-link" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-chevron-left"></i> Trang chủ
            </Link>
        </div>

        <div className="movie-header-flex" style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 60 }}>
            <div className="movie-poster-main" style={{ width: 300, borderRadius: 24, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.8)', flexShrink: 0 }}>
                <img src={movie.poster_url} style={{ width: '100%', height: 'auto', display: 'block' }} alt={movie.title} />
            </div>
            <div style={{ flex: 1, minWidth: 300 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#e50914', background: 'rgba(229,9,20,0.15)', padding: '4px 12px', borderRadius: 8 }}>Đang chiếu</span>
                    <span style={{ fontSize: 12, color: '#ccc' }}>{movie.duration} phút</span>
                    <span style={{ fontSize: 12, color: '#ccc' }}>· {movie.genre}</span>
                </div>
                <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', margin: '0 0 16px', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{movie.title}</h1>
                <p style={{ fontSize: 16, color: '#aaa', lineHeight: 1.8, marginBottom: 32, maxWidth: 600 }}>{movie.description}</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 400 }}>
                    <div>
                        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', marginBottom: 4 }}>Đạo diễn</div>
                        <div style={{ color: '#fff', fontWeight: 700 }}>{movie.director || 'Chưa cập nhật'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', marginBottom: 4 }}>Ngôn ngữ</div>
                        <div style={{ color: '#fff', fontWeight: 700 }}>Tiếng Việt</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Showtime Section */}
        <section className="detail-section" style={{ marginBottom: 80 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h2 style={{ fontSize: 24, margin: 0 }}>Lịch chiếu phim</h2>
                <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, #333, transparent)', marginLeft: 30 }}></div>
            </div>

            {!showtimes?.length ? (
                <div className="card-pele" style={{ padding: 40, textAlign: 'center' }}>
                    <p className="muted">Hiện tại chưa có suất chiếu cho phim này.</p>
                </div>
            ) : (
                <div className="card-pele" style={{ padding: 30, borderRadius: 32 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
                        {dateKeys.map((d) => (
                        <button
                            key={d}
                            type="button"
                            className={`btn-genre ${selectedDate === d ? 'active' : ''}`}
                            onClick={() => setActiveDate(d)}
                        >
                            {d}
                        </button>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                        {selectedShowtimes.map((s) => {
                            const time = s.start_time ? new Date(s.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'
                            return (
                            <button
                                key={s.id}
                                type="button"
                                className="btn-primary-pele"
                                onClick={() => navigate(`/booking/${s.id}`)}
                                style={{
                                    padding: '16px',
                                    borderRadius: 16,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <span style={{ fontSize: 20, fontWeight: 900 }}>{time}</span>
                                <span className="small" style={{ opacity: 0.8, fontSize: 11 }}>
                                    {s.roomName} • {Number(s.price).toLocaleString()}đ
                                </span>
                            </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </section>

        {/* Trailer Section */}
        {embed && (
            <section className="detail-section" style={{ marginBottom: 80 }}>
                <h2 style={{ fontSize: 24, marginBottom: 32 }}>Trailer phim</h2>
                <div className="card-pele" style={{ padding: 0, overflow: 'hidden', borderRadius: 32, boxShadow: '0 30px 60px rgba(0,0,0,0.5)', aspectRatio: '16/9' }}>
                    <iframe title="trailer" src={embed} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
                </div>
            </section>
        )}

        {/* Comments Section */}
        <section className="detail-section" style={{ paddingBottom: 100 }}>
            <h2 style={{ fontSize: 24, marginBottom: 32 }}>Cộng đồng đánh giá ({comments.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                <div className="card-pele" style={{ padding: 30, borderRadius: 32, height: 'fit-content' }}>
                    <h4 style={{ marginTop: 0, marginBottom: 20 }}>Bình luận của bạn</h4>
                    {user ? (
                        <form className="form-pele" onSubmit={sendComment} noValidate>
                            <label>Bạn thấy phim thế nào?</label>
                            <textarea 
                                value={content} 
                                onChange={(e) => setContent(e.target.value)} 
                                rows={4} 
                                placeholder="Chia sẻ suy nghĩ của bạn..."
                                style={{ borderRadius: 16, background: 'rgba(0,0,0,0.3)' }}
                            />
                            <div style={{ marginTop: 16 }}>
                                <label>Đánh giá: <strong style={{ color: '#f39c12' }}>{rating} ★</strong></label>
                                <input 
                                    type="range" min={1} max={5} 
                                    value={rating} 
                                    onChange={(e) => setRating(Number(e.target.value))} 
                                    style={{ width: '100%', marginTop: 8 }}
                                />
                            </div>
                            <button type="submit" className="btn-primary-pele" style={{ width: '100%', marginTop: 20 }}>
                                Đăng bình luận
                            </button>
                        </form>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                           <p className="muted small">Vui lòng <Link to="/login" style={{ color: '#e50914' }}>đăng nhập</Link> để tham gia thảo luận.</p>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {comments.length === 0 ? (
                        <p className="muted" style={{ padding: '0 20px' }}>Chưa có bình luận nào. Hãy là người đầu tiên!</p>
                    ) : (
                        comments.map((c) => (
                            <div key={c.id} className="card-pele" style={{ padding: 20, borderRadius: 20, background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e50914', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>{(c.fullName || c.username || '?').charAt(0)}</div>
                                        <div style={{ fontWeight: 800 }}>{c.fullName || c.username}</div>
                                    </div>
                                    <div style={{ color: '#f39c12', fontSize: 13, fontWeight: 800 }}>{c.rating} <i className="fa-solid fa-star"></i></div>
                                </div>
                                <p style={{ margin: 0, fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{c.content}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
      </main>

      <style>{`
        .movie-detail-root {
            position: relative;
            min-height: 100vh;
            background: #080808;
            color: #fff;
        }
        .movie-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 80vh;
            background-size: cover;
            background-position: center;
            filter: blur(80px) saturate(1.5);
            opacity: 0.3;
            z-index: 1;
        }
        .movie-backdrop-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(to bottom, transparent, #080808);
            z-index: 2;
        }
      `}</style>
    </div>
  )
}
