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
      const raw = s.start_time ? String(s.start_time) : ''
      const key = raw ? raw.replace('T', ' ').slice(0, 10) : 'Khác'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')))
      map.set(k, arr)
    }
    return Array.from(map.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  })()

  const dateKeys = groups.map(([k]) => k)
  const selectedDate = activeDate && dateKeys.includes(activeDate) ? activeDate : dateKeys[0] || ''
  const selectedShowtimes = selectedDate ? groups.find(([k]) => k === selectedDate)?.[1] || [] : []

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
      {!showtimes?.length ? (
        <p className="muted">Chưa có suất.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {dateKeys.map((d) => (
              <button
                key={d}
                type="button"
                className="btn-ghost"
                onClick={() => setActiveDate(d)}
                style={{
                  borderRadius: 999,
                  padding: '8px 12px',
                  border: selectedDate === d ? '1px solid rgba(229,9,20,0.8)' : undefined,
                  background: selectedDate === d ? 'rgba(229,9,20,0.18)' : undefined,
                  color: selectedDate === d ? '#fff' : undefined,
                }}
              >
                {d === 'Khác' ? 'Khác' : d}
              </button>
            ))}
          </div>

          <div className="card-pele" style={{ padding: 14 }}>
            <div className="muted small" style={{ marginBottom: 10 }}>
              Chọn giờ chiếu để đặt vé
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {selectedShowtimes.map((s) => {
                const time = s.start_time ? String(s.start_time).replace('T', ' ').slice(11, 16) : '—'
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="btn-primary-pele"
                    onClick={() => navigate(`/booking/${s.id}`)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      minWidth: 120,
                    }}
                    aria-label={`Đặt vé suất ${time}`}
                  >
                    <span style={{ fontWeight: 900 }}>{time}</span>
                    <span className="small" style={{ opacity: 0.9 }}>
                      {s.roomName || 'Phòng'} · {Number(s.price).toLocaleString('vi-VN')}đ
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      <h2 style={{ fontSize: '1.2rem', marginTop: 28 }}>Bình luận</h2>
      {user ? (
        <form className="form-pele card-pele" onSubmit={sendComment} noValidate>
          <label>Nội dung</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
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
