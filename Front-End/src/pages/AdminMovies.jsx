import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'

export default function AdminMovies() {
  const [movies, setMovies] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    director: '',
    cast: '',
    duration: 120,
    releaseDate: '',
    posterUrl: '',
    genre: '',
    trailerUrl: '',
  })

  function load() {
    fetch(`${API_BASE}/api/admin/movies`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setMovies(d.movies || []))
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e) {
    e.preventDefault()
    try {
      await apiPost('/api/admin/movies', {
        ...form,
        releaseDate: form.releaseDate || null,
      })
      load()
      alert('Đã lưu')
    } catch (er) {
      alert(er.message)
    }
  }

  async function del(id) {
    if (!confirm('Xóa?')) return
    await fetch(`${API_BASE}/api/admin/movies/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  return (
    <main className="page-shell">
      <Link to="/admin" className="back-link">
        ← Dashboard
      </Link>
      <h1>Quản lý phim</h1>
      <form className="form-pele card-pele" onSubmit={save} style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Thêm phim</h3>
        <label>Tên</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <label>Mô tả</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        <label>Đạo diễn / Diễn viên / Thể loại</label>
        <input placeholder="Đạo diễn" value={form.director} onChange={(e) => setForm({ ...form, director: e.target.value })} />
        <input placeholder="Diễn viên" value={form.cast} onChange={(e) => setForm({ ...form, cast: e.target.value })} />
        <input placeholder="Thể loại" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
        <label>Thời lượng (phút)</label>
        <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
        <label>Ngày khởi chiếu (yyyy-mm-dd)</label>
        <input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
        <label>Poster URL / Trailer URL</label>
        <input value={form.posterUrl} onChange={(e) => setForm({ ...form, posterUrl: e.target.value })} />
        <input value={form.trailerUrl} onChange={(e) => setForm({ ...form, trailerUrl: e.target.value })} />
        <button type="submit" className="btn-primary-pele">
          Lưu phim
        </button>
      </form>

      <table className="table-pele">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tên</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {movies.map((m) => (
            <tr key={m.id}>
              <td>{m.id}</td>
              <td>{m.title}</td>
              <td>
                <button type="button" className="btn-ghost" onClick={() => del(m.id)}>
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
