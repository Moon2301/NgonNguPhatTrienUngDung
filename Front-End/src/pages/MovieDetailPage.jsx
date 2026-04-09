import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import { useAuth } from '../context/useAuth.js'
import { toYoutubeEmbedUrl } from '../utils/youtube'
import '../App.css'

export default function MovieDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [comments, setComments] = useState([])
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(5)
  const [err, setErr] = useState('')

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
    try {
      await apiPost('/api/comments', { movieId: Number(id), content, rating })
      setContent('')
      const r = await fetch(`${API_BASE}/api/comments/movie/${id}`, { credentials: 'include' })
      const d = await r.json()
      setComments(d.comments || [])
    } catch (er) {
      alert(er.message)
    }
  }

  if (err || !data) return <main className="page-shell"><p>{err || 'Đang tải...'}</p></main>

  const { movie, showtimes } = data
  const embed = toYoutubeEmbedUrl(movie.trailer_url)

  return (
    <main className="page-shell">
      <Link to="/" className="back-link">← Trang chủ</Link>
      <h1>{movie.title}</h1>
      <p className="muted">
        {movie.genre} · {movie.duration} phút · {movie.director}
      </p>
      {embed && (
        <div className="card-pele" style={{ padding: 0, overflow: 'hidden', aspectRatio: '16/9', maxWidth: 800 }}>
          <iframe title="trailer" src={embed} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen />
        </div>
      )}
      <p style={{ lineHeight: 1.7, color: '#c5c6c7' }}>{movie.description}</p>

      <h2 style={{ fontSize: '1.2rem', marginTop: 28 }}>Suất chiếu</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {(showtimes || []).map((s) => (
          <li key={s.id} style={{ marginBottom: 8 }}>
            <Link to={`/booking/${s.id}`}>
              {s.start_time ? String(s.start_time).replace('T', ' ').slice(0, 16) : '—'} — {s.roomName || 'Phòng'}{' '}
              · {Number(s.price).toLocaleString('vi-VN')}đ
            </Link>
          </li>
        ))}
      </ul>
      {!showtimes?.length && <p className="muted">Chưa có suất.</p>}

      <h2 style={{ fontSize: '1.2rem', marginTop: 28 }}>Bình luận</h2>
      {user ? (
        <form className="form-pele card-pele" onSubmit={sendComment}>
          <label>Nội dung</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} required />
          <label>Đánh giá (1-5)</label>
          <input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
          <button type="submit" className="btn-primary-pele">
            Gửi
          </button>
        </form>
      ) : (
        <p className="muted">
          <Link to="/login">Đăng nhập</Link> để bình luận.
        </p>
      )}
      <div style={{ marginTop: 16 }}>
        {comments.map((c) => (
          <div key={c.id} className="card-pele" style={{ marginBottom: 8 }}>
            <strong>{c.fullName || c.username}</strong> · {c.rating}★
            <p style={{ margin: '8px 0 0' }}>{c.content}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
