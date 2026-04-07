import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'

export default function AdminShowtimes() {
  const [showtimes, setShowtimes] = useState([])
  const [movies, setMovies] = useState([])
  const [rooms] = useState([
    { id: 1, name: 'Phòng 01' },
    { id: 2, name: 'Phòng 02' },
  ])
  const [movieId, setMovieId] = useState('')
  const [roomId, setRoomId] = useState('1')
  const [startTime, setStartTime] = useState('')
  const [price, setPrice] = useState(80000)

  function load() {
    fetch(`${API_BASE}/api/admin/showtimes`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setShowtimes(d.showtimes || []))
    fetch(`${API_BASE}/api/admin/movies`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setMovies(d.movies || [])
        if (d.movies?.[0]) setMovieId(String(d.movies[0].id))
      })
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e) {
    e.preventDefault()
    try {
      await apiPost('/api/admin/showtimes', {
        movieId: Number(movieId),
        roomId: Number(roomId),
        startTime,
        price: Number(price),
      })
      load()
      alert('Đã thêm suất')
    } catch (er) {
      alert(er.message)
    }
  }

  async function del(id) {
    if (!confirm('Xóa suất?')) return
    await fetch(`${API_BASE}/api/admin/showtimes/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  return (
    <main className="page-shell">
      <Link to="/admin" className="back-link">
        ← Dashboard
      </Link>
      <h1>Quản lý suất chiếu</h1>
      <form className="form-pele card-pele" onSubmit={save}>
        <label>Phim</label>
        <select value={movieId} onChange={(e) => setMovieId(e.target.value)}>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <label>Phòng</label>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <label>Bắt đầu (datetime local)</label>
        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        <label>Giá vé</label>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button type="submit" className="btn-primary-pele">
          Thêm suất
        </button>
      </form>

      <table className="table-pele">
        <thead>
          <tr>
            <th>ID</th>
            <th>Phim</th>
            <th>Giờ</th>
            <th>Giá</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {showtimes.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.movieTitle}</td>
              <td>{s.start_time ? String(s.start_time).slice(0, 16) : ''}</td>
              <td>{Number(s.price).toLocaleString('vi-VN')}</td>
              <td>
                <button type="button" className="btn-ghost" onClick={() => del(s.id)}>
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
