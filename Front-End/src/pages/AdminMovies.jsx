import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import { useUi } from '../context/useUi.js'

const emptyForm = {
  id: undefined,
  title: '',
  description: '',
  director: '',
  cast: '',
  duration: 120,
  releaseDate: '',
  posterUrl: '',
  genre: '',
  trailerUrl: '',
}

function movieToForm(m) {
  let releaseDate = ''
  if (m.release_date) {
    const d = m.release_date instanceof Date ? m.release_date : new Date(m.release_date)
    if (!Number.isNaN(d.getTime())) releaseDate = d.toISOString().slice(0, 10)
  }
  return {
    id: m.id,
    title: m.title || '',
    description: m.description || '',
    director: m.director || '',
    cast: m.cast || '',
    duration: Number(m.duration) || 120,
    releaseDate,
    posterUrl: m.poster_url || '',
    genre: m.genre || '',
    trailerUrl: m.trailer_url || '',
  }
}

export default function AdminMovies() {
  const [movies, setMovies] = useState([])
  const ui = useUi()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const genreSuggestions = useMemo(() => {
    const set = new Set()
    for (const m of movies || []) {
      const g = String(m.genre || '').trim()
      if (g) set.add(g)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [movies])

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
    if (!String(form.title || '').trim()) return ui.toast.warn('Vui lòng nhập tên phim.')
    try {
      const body = {
        ...form,
        releaseDate: form.releaseDate || null,
      }
      if (!form.id) delete body.id
      await apiPost('/api/admin/movies', body)
      load()
      ui.toast.success(form.id ? 'Đã cập nhật phim.' : 'Đã lưu phim.')
      closePanel()
    } catch (er) {
      ui.toast.error(er.message)
    }
  }

  async function del(id) {
    const ok = await ui.confirm({ title: 'Xóa phim', message: `Xóa phim #${id}?`, confirmText: 'Xóa', cancelText: 'Hủy' })
    if (!ok) return
    await fetch(`${API_BASE}/api/admin/movies/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
    if (form.id === id) {
      setForm({ ...emptyForm })
      setShowCreate(false)
    }
    ui.toast.success('Đã xóa phim.')
  }

  function closePanel() {
    setShowCreate(false)
    setForm({ ...emptyForm })
  }

  function openNew() {
    setForm({ ...emptyForm })
    setShowCreate(true)
  }

  function startEdit(m) {
    setForm(movieToForm(m))
    setShowCreate(true)
  }

  return (
    <main className="page-shell">
      <Link to="/admin" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        ← Dashboard
      </Link>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <h1 style={{ margin: 0 }}>Quản lý phim</h1>
        <button type="button" className="btn-primary-pele" onClick={() => (showCreate ? closePanel() : openNew())}>
          {showCreate ? 'Đóng' : 'Thêm phim'}
        </button>
      </div>

      {showCreate && (
        <form className="form-pele card-pele" onSubmit={save} style={{ marginBottom: 24 }} noValidate>
          <h3 style={{ marginTop: 0 }}>{form.id ? `Sửa phim #${form.id}` : 'Thêm phim'}</h3>
          <label>Tên</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label>Mô tả</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          <label>Đạo diễn / Diễn viên / Thể loại</label>
          <input placeholder="Đạo diễn" value={form.director} onChange={(e) => setForm({ ...form, director: e.target.value })} />
          <input placeholder="Diễn viên" value={form.cast} onChange={(e) => setForm({ ...form, cast: e.target.value })} />
          <input
            placeholder="Thể loại"
            value={form.genre}
            onChange={(e) => setForm({ ...form, genre: e.target.value })}
            list="genreList"
          />
          <datalist id="genreList">
            {genreSuggestions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <label>Thời lượng (phút)</label>
          <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
          <label>Ngày khởi chiếu (yyyy-mm-dd)</label>
          <input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
          <label>Poster URL / Trailer URL</label>
          <input value={form.posterUrl} onChange={(e) => setForm({ ...form, posterUrl: e.target.value })} />
          <input value={form.trailerUrl} onChange={(e) => setForm({ ...form, trailerUrl: e.target.value })} />
          <button type="submit" className="btn-primary-pele">
            {form.id ? 'Cập nhật' : 'Lưu phim'}
          </button>
        </form>
      )}

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
              <td style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="btn-ghost" style={{ marginRight: 8 }} onClick={() => startEdit(m)}>
                  Sửa
                </button>
                <button type="button" className="btn-danger" onClick={() => del(m.id)}>
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
