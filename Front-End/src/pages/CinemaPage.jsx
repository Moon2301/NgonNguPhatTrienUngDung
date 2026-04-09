import { useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { useAuth } from '../context/useAuth.js'
import '../App.css'

export default function CinemaPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [cinemas, setCinemas] = useState([])
  const [rooms, setRooms] = useState({})
  const [movies, setMovies] = useState([])
  const [showtimes, setShowtimes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('cinema')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')

  const [formCinema, setFormCinema] = useState({ name: '', address: '', city: '', phone: '' })
  const [editCinemaId, setEditCinemaId] = useState(null)

  const [formRoom, setFormRoom] = useState({ cinemaId: '', name: '', totalRows: 10, totalCols: 10 })
  const [editRoomId, setEditRoomId] = useState(null)

  const [formShowtime, setFormShowtime] = useState({ cinemaId: '', movieId: '', roomId: '', date: '', hour: 19, minute: 0, price: 80000 })
  const [editShowtimeId, setEditShowtimeId] = useState(null)

  const [showtimeComments, setShowtimeComments] = useState({})
  const [commentText, setCommentText] = useState({})
  const [openComments, setOpenComments] = useState({})

  function showMsg(text, type = 'error') {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 3000)
  }

  async function fetcher(url) {
    const r = await fetch(url, { credentials: 'include' })
    const d = await r.json()
    if (!r.ok) throw new Error(d?.error || 'Lỗi')
    return d
  }

  useEffect(() => {
    Promise.all([
      fetcher(`${API_BASE}/api/cinemas`),
      fetcher(`${API_BASE}/api/movies`),
      fetcher(`${API_BASE}/api/showtimes`),
    ])
      .then(([cd, md, sd]) => {
        setCinemas(cd.cinemas || [])
        setMovies(md.movies || [])
        setShowtimes(sd.showtimes || [])
      })
      .catch(() => showMsg('Không tải được dữ liệu.'))
      .finally(() => setLoading(false))
  }, [])

  async function loadRooms(cinemaId) {
    if (rooms[cinemaId]) return
    try {
      const d = await fetcher(`${API_BASE}/api/cinemas/${cinemaId}/rooms`)
      setRooms((prev) => ({ ...prev, [cinemaId]: d.rooms || [] }))
    } catch {}
  }

  function fmt(d) {
    if (!d) return ''
    const date = new Date(d)
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
  }

  function fmtTime(h, m) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function fmtDate(d) {
    if (!d) return ''
    const date = new Date(d)
    return date.toISOString().slice(0, 10)
  }

  function fmtPrice(p) {
    return `${Number(p).toLocaleString('vi-VN')}đ`
  }

  function fmtCinema(id) {
    return cinemas.find((c) => c.id === id)?.name || `Rạp #${id}`
  }

  function fmtMovie(id) {
    return movies.find((m) => m.id === id)?.title || `Phim #${id}`
  }

  function fmtRoom(id) {
    for (const arr of Object.values(rooms)) {
      const r = arr.find((x) => x.id === id)
      if (r) return r.name
    }
    return `Phòng #${id}`
  }

  async function saveCinema(e) {
    e.preventDefault()
    const url = editCinemaId
      ? `${API_BASE}/api/cinemas/${editCinemaId}`
      : `${API_BASE}/api/cinemas`
    const method = editCinemaId ? 'PUT' : 'POST'
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formCinema),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setCinemas((prev) =>
        editCinemaId ? prev.map((c) => (c.id === editCinemaId ? d.cinema : c)) : [...prev, d.cinema],
      )
      setFormCinema({ name: '', address: '', city: '', phone: '' })
      setEditCinemaId(null)
      showMsg(editCinemaId ? 'Đã cập nhật rạp.' : 'Đã thêm rạp.', 'success')
    } catch (e) {
      showMsg(e.message)
    }
  }

  async function deleteCinema(id) {
    if (!confirm('Xóa rạp này?')) return
    try {
      const r = await fetch(`${API_BASE}/api/cinemas/${id}`, { method: 'DELETE', credentials: 'include' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setCinemas((prev) => prev.filter((c) => c.id !== id))
      showMsg('Đã xóa rạp.', 'success')
    } catch (e) {
      showMsg(e.message)
    }
  }

  function editCinema(c) {
    setFormCinema({ name: c.name, address: c.address, city: c.city, phone: c.phone || '' })
    setEditCinemaId(c.id)
  }

  async function saveRoom(e) {
    e.preventDefault()
    const payload = { ...formRoom, cinemaId: Number(formRoom.cinemaId), totalRows: Number(formRoom.totalRows), totalCols: Number(formRoom.totalCols) }
    const url = editRoomId ? `${API_BASE}/api/rooms/${editRoomId}` : `${API_BASE}/api/rooms`
    const method = editRoomId ? 'PUT' : 'POST'
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      const cid = Number(payload.cinemaId)
      setRooms((prev) => ({
        ...prev,
        [cid]: editRoomId
          ? (prev[cid] || []).map((x) => (x.id === editRoomId ? d.room : x))
          : [...(prev[cid] || []), d.room],
      }))
      setFormRoom({ cinemaId: '', name: '', totalRows: 10, totalCols: 10 })
      setEditRoomId(null)
      showMsg(editRoomId ? 'Đã cập nhật phòng.' : 'Đã thêm phòng.', 'success')
    } catch (e) {
      showMsg(e.message)
    }
  }

  async function deleteRoom(id, cinemaId) {
    if (!confirm('Xóa phòng này?')) return
    try {
      const r = await fetch(`${API_BASE}/api/rooms/${id}`, { method: 'DELETE', credentials: 'include' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setRooms((prev) => ({ ...prev, [cinemaId]: (prev[cinemaId] || []).filter((x) => x.id !== id) }))
      showMsg('Đã xóa phòng.', 'success')
    } catch (e) {
      showMsg(e.message)
    }
  }

  async function saveShowtime(e) {
    e.preventDefault()
    const payload = { ...formShowtime, cinemaId: Number(formShowtime.cinemaId), movieId: Number(formShowtime.movieId), roomId: Number(formShowtime.roomId), price: Number(formShowtime.price) }
    const url = editShowtimeId ? `${API_BASE}/api/showtimes/${editShowtimeId}` : `${API_BASE}/api/showtimes`
    const method = editShowtimeId ? 'PUT' : 'POST'
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setShowtimes((prev) => editShowtimeId ? prev.map((x) => (x.id === editShowtimeId ? d.showtime : x)) : [...prev, d.showtime])
      setFormShowtime({ cinemaId: '', movieId: '', roomId: '', date: '', hour: 19, minute: 0, price: 80000 })
      setEditShowtimeId(null)
      showMsg(editShowtimeId ? 'Đã cập nhật suất chiếu.' : 'Đã thêm suất chiếu.', 'success')
    } catch (e) {
      showMsg(e.message)
    }
  }

  async function deleteShowtime(id) {
    if (!confirm('Xóa suất chiếu này?')) return
    try {
      const r = await fetch(`${API_BASE}/api/showtimes/${id}`, { method: 'DELETE', credentials: 'include' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setShowtimes((prev) => prev.filter((x) => x.id !== id))
      showMsg('Đã xóa suất chiếu.', 'success')
    } catch (e) {
      showMsg(e.message)
    }
  }

  async function loadComments(showtimeId) {
    if (openComments[showtimeId]) {
      setOpenComments((prev) => ({ ...prev, [showtimeId]: false }))
      return
    }
    if (!showtimeComments[showtimeId]) {
      try {
        const d = await fetcher(`${API_BASE}/api/showtimes/${showtimeId}/comments`)
        setShowtimeComments((prev) => ({ ...prev, [showtimeId]: d.comments || [] }))
      } catch {}
    }
    setOpenComments((prev) => ({ ...prev, [showtimeId]: true }))
  }

  async function postComment(showtimeId) {
    const content = (commentText[showtimeId] || '').trim()
    if (!content) return
    try {
      const r = await fetch(`${API_BASE}/api/showtimes/${showtimeId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setShowtimeComments((prev) => ({ ...prev, [showtimeId]: [d.comment, ...(prev[showtimeId] || [])] }))
      setCommentText((prev) => ({ ...prev, [showtimeId]: '' }))
    } catch (e) {
      showMsg(e.message)
    }
  }

  async function deleteComment(id, showtimeId) {
    if (!confirm('Xóa bình luận này?')) return
    try {
      const r = await fetch(`${API_BASE}/api/comments/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'Xóa thất bại.')
      }
      setShowtimeComments((prev) => ({ ...prev, [showtimeId]: (prev[showtimeId] || []).filter((c) => c.id !== id) }))
    } catch (e) {
      showMsg(e.message)
    }
  }

  if (loading) {
    return (
      <div className="main-wrap">
        <div className="status-msg"><i className="fa-solid fa-spinner fa-spin" /> Đang tải...</div>
      </div>
    )
  }

  return (
    <div className="main-wrap">
      <h2 style={{ color: '#fff', marginBottom: 20 }}>Rạp & Suất chiếu</h2>

      {msg && (
        <div className={`status-msg ${msgType === 'success' ? '' : 'error'}`}>
          {msgType === 'success' ? <i className="fa-solid fa-check" /> : <i className="fa-solid fa-circle-exclamation" />} {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['cinema', 'room', 'showtime'].map((t) => (
          <button key={t} type="button" className={`btn-genre ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'cinema' ? '🏛️ Rạp' : t === 'room' ? '🚪 Phòng' : '🎬 Suất chiếu'}
          </button>
        ))}
      </div>

      {/* ── TAB RẠP ── */}
      {tab === 'cinema' && (
        <>
          {isAdmin && (
            <div className="card-pele" style={{ marginBottom: 24 }}>
              <h3 style={{ color: '#fff', marginTop: 0 }}>{editCinemaId ? 'Sửa rạp' : 'Thêm rạp mới'}</h3>
              <form className="form-pele" onSubmit={saveCinema} style={{ gridTemplateColumns: '1fr 1fr' }}>
                <input placeholder="Tên rạp *" value={formCinema.name} onChange={(e) => setFormCinema((p) => ({ ...p, name: e.target.value }))} required />
                <input placeholder="Thành phố *" value={formCinema.city} onChange={(e) => setFormCinema((p) => ({ ...p, city: e.target.value }))} required />
                <input placeholder="Địa chỉ *" value={formCinema.address} onChange={(e) => setFormCinema((p) => ({ ...p, address: e.target.value }))} required style={{ gridColumn: '1 / -1' }} />
                <input placeholder="Số điện thoại" value={formCinema.phone} onChange={(e) => setFormCinema((p) => ({ ...p, phone: e.target.value }))} style={{ gridColumn: '1 / -1' }} />
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn-primary-pele">{editCinemaId ? 'Lưu' : 'Thêm'}</button>
                  {editCinemaId && (
                    <button type="button" className="btn-clear" onClick={() => { setEditCinemaId(null); setFormCinema({ name: '', address: '', city: '', phone: '' }) }}>Hủy</button>
                  )}
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {cinemas.map((c) => (
              <div key={c.id} className="card-pele">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ color: '#fff', margin: '0 0 4px' }}>{c.name}</h4>
                    <p className="small muted" style={{ margin: 0 }}>{c.city}</p>
                    <p className="small muted" style={{ margin: '4px 0 0' }}>{c.address}</p>
                    {c.phone && <p className="small muted" style={{ margin: '4px 0 0' }}>📞 {c.phone}</p>}
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn-clear small" onClick={() => editCinema(c)}>Sửa</button>
                      <button type="button" className="btn-clear small" style={{ color: '#ff6b6b' }} onClick={() => deleteCinema(c.id)}>Xóa</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB PHÒNG ── */}
      {tab === 'room' && (
        <>
          {isAdmin && (
            <div className="card-pele" style={{ marginBottom: 24 }}>
              <h3 style={{ color: '#fff', marginTop: 0 }}>{editRoomId ? 'Sửa phòng' : 'Thêm phòng mới'}</h3>
              <form className="form-pele" onSubmit={saveRoom} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <select value={formRoom.cinemaId} onChange={(e) => setFormRoom((p) => ({ ...p, cinemaId: e.target.value }))} required style={{ padding: 12, borderRadius: 12, border: '1px solid #3a3d4a', background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                  <option value="">Chọn rạp *</option>
                  {cinemas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input placeholder="Tên phòng *" value={formRoom.name} onChange={(e) => setFormRoom((p) => ({ ...p, name: e.target.value }))} required />
                <input type="number" placeholder="Số hàng *" min={1} max={30} value={formRoom.totalRows} onChange={(e) => setFormRoom((p) => ({ ...p, totalRows: e.target.value }))} required />
                <input type="number" placeholder="Số cột *" min={1} max={30} value={formRoom.totalCols} onChange={(e) => setFormRoom((p) => ({ ...p, totalCols: e.target.value }))} required />
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn-primary-pele">{editRoomId ? 'Lưu' : 'Thêm'}</button>
                  {editRoomId && <button type="button" className="btn-clear" onClick={() => { setEditRoomId(null); setFormRoom({ cinemaId: '', name: '', totalRows: 10, totalCols: 10 }) }}>Hủy</button>}
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {cinemas.map((c) => {
              loadRooms(c.id)
              const cr = rooms[c.id] || []
              return (
                <div key={c.id} className="card-pele">
                  <h4 style={{ color: 'var(--primary)', margin: '0 0 10px' }}>{c.name}</h4>
                  {cr.length === 0 ? (
                    <p className="small muted">Chưa có phòng.</p>
                  ) : cr.map((r) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <span style={{ color: '#fff' }}>{r.name}</span>
                        <span className="small muted"> ({r.totalRows}×{r.totalCols} ghế)</span>
                      </div>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" className="btn-clear small" onClick={() => { setFormRoom({ cinemaId: c.id, name: r.name, totalRows: r.totalRows, totalCols: r.totalCols }); setEditRoomId(r.id) }}>Sửa</button>
                          <button type="button" className="btn-clear small" style={{ color: '#ff6b6b' }} onClick={() => deleteRoom(r.id, c.id)}>Xóa</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── TAB SUẤT CHIẾU ── */}
      {tab === 'showtime' && (
        <>
          {isAdmin && (
            <div className="card-pele" style={{ marginBottom: 24 }}>
              <h3 style={{ color: '#fff', marginTop: 0 }}>{editShowtimeId ? 'Sửa suất chiếu' : 'Thêm suất chiếu mới'}</h3>
              <form className="form-pele" onSubmit={saveShowtime} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <select value={formShowtime.cinemaId} onChange={(e) => setFormShowtime((p) => ({ ...p, cinemaId: e.target.value, roomId: '' }))} required style={{ padding: 12, borderRadius: 12, border: '1px solid #3a3d4a', background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                  <option value="">Rạp *</option>
                  {cinemas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={formShowtime.movieId} onChange={(e) => setFormShowtime((p) => ({ ...p, movieId: e.target.value }))} required style={{ padding: 12, borderRadius: 12, border: '1px solid #3a3d4a', background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                  <option value="">Phim *</option>
                  {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                <select value={formShowtime.roomId} onChange={(e) => setFormShowtime((p) => ({ ...p, roomId: e.target.value }))} required disabled={!formShowtime.cinemaId} style={{ padding: 12, borderRadius: 12, border: '1px solid #3a3d4a', background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                  <option value="">Phòng *</option>
                  {(rooms[Number(formShowtime.cinemaId)] || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input type="date" value={formShowtime.date} onChange={(e) => setFormShowtime((p) => ({ ...p, date: e.target.value }))} required style={{ padding: 12, borderRadius: 12, border: '1px solid #3a3d4a', background: 'rgba(255,255,255,0.06)', color: '#fff' }} />
                <input type="number" placeholder="Giờ (0-23)" min={0} max={23} value={formShowtime.hour} onChange={(e) => setFormShowtime((p) => ({ ...p, hour: Number(e.target.value) }))} required />
                <input type="number" placeholder="Phút (0-59)" min={0} max={59} value={formShowtime.minute} onChange={(e) => setFormShowtime((p) => ({ ...p, minute: Number(e.target.value) }))} required />
                <input type="number" placeholder="Giá vé (VNĐ)" min={0} value={formShowtime.price} onChange={(e) => setFormShowtime((p) => ({ ...p, price: Number(e.target.value) }))} required style={{ gridColumn: '1 / -1' }} />
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn-primary-pele">{editShowtimeId ? 'Lưu' : 'Thêm'}</button>
                  {editShowtimeId && <button type="button" className="btn-clear" onClick={() => { setEditShowtimeId(null); setFormShowtime({ cinemaId: '', movieId: '', roomId: '', date: '', hour: 19, minute: 0, price: 80000 }) }}>Hủy</button>}
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {showtimes.length === 0 && <div className="empty-state"><i className="fa-solid fa-film" /><p>Chưa có suất chiếu nào.</p></div>}
            {showtimes.map((s) => (
              <div key={s.id} className="card-pele">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h4 style={{ color: '#fff', margin: '0 0 6px' }}>{fmtMovie(s.movieId)}</h4>
                    <p className="small muted" style={{ margin: 0 }}>🏛️ {fmtCinema(s.cinemaId)} · 🚪 {fmtRoom(s.roomId)}</p>
                    <p className="small muted" style={{ margin: '4px 0 0' }}>📅 {fmt(s.date)} · ⏰ {fmtTime(s.hour, s.minute)} · 💰 {fmtPrice(s.price)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-genre small" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => loadComments(s.id)}>
                          💬 {openComments[s.id] ? 'Đóng' : 'Bình luận'}
                        </button>
                    {isAdmin && (
                      <>
                        <button type="button" className="btn-clear small" onClick={() => {
                          setFormShowtime({ cinemaId: s.cinemaId, movieId: s.movieId, roomId: s.roomId, date: fmtDate(s.date), hour: s.hour, minute: s.minute, price: s.price })
                          setEditShowtimeId(s.id)
                        }}>Sửa</button>
                        <button type="button" className="btn-clear small" style={{ color: '#ff6b6b' }} onClick={() => deleteShowtime(s.id)}>Xóa</button>
                      </>
                    )}
                  </div>
                </div>

                {openComments[s.id] && showtimeComments[s.id] !== undefined && (
                  <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    {(showtimeComments[s.id] || []).map((c) => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div>
                          <strong style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>{c.username}</strong>
                          <span className="small muted" style={{ marginLeft: 8 }}>{fmt(c.createdAt)}</span>
                          <p style={{ color: '#fff', margin: '4px 0 0', fontSize: '0.9rem' }}>{c.content}</p>
                        </div>
                        {(user?.id === c.userId || isAdmin) && (
                          <button type="button" className="btn-clear small" style={{ color: '#ff6b6b', padding: '2px 6px' }} onClick={() => deleteComment(c.id, s.id)}>×</button>
                        )}
                      </div>
                    ))}
                    {user ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <input
                          placeholder="Viết bình luận..."
                          value={commentText[s.id] || ''}
                          onChange={(e) => setCommentText((p) => ({ ...p, [s.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); postComment(s.id) } }}
                          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #3a3d4a', background: 'rgba(255,255,255,0.06)', color: '#fff', fontFamily: 'inherit' }}
                        />
                        <button type="button" className="btn-primary-pele" style={{ marginTop: 0, padding: '10px 16px' }} onClick={() => postComment(s.id)}>Gửi</button>
                      </div>
                    ) : (
                      <p className="small muted" style={{ marginTop: 10 }}>Đăng nhập để bình luận.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
