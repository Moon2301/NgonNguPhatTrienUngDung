import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'

export default function PeleDatingPage() {
  const [matches, setMatches] = useState([])
  const [targetId, setTargetId] = useState('')
  const [msg, setMsg] = useState('')

  function load() {
    fetch(`${API_BASE}/api/dating/matches`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setMatches(d.matches || []))
  }

  useEffect(() => {
    load()
  }, [])

  async function sendLike() {
    setMsg('')
    const id = Number(String(targetId).trim())
    if (!Number.isFinite(id) || id < 1) {
      setMsg('Nhập user ID hợp lệ.')
      return
    }
    try {
      await apiPost(`/api/dating/like/${id}`, {})
      setMsg('Đã gửi!')
      load()
    } catch (er) {
      setMsg(er.message)
    }
  }

  return (
    <main className="page-shell">
      <h1>PELE Dating</h1>
      <p className="muted">Danh sách match & chat (demo API).</p>

      <div className="card-pele" style={{ marginBottom: 16 }}>
        <label>Gửi like tới user ID (số)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="User ID"
            style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 8, border: '1px solid #444', background: '#1a1a1f', color: '#fff' }}
          />
          <button type="button" className="btn-primary-pele" onClick={sendLike}>
            Gửi like
          </button>
        </div>
        {msg && <p className="small muted">{msg}</p>}
      </div>

      <h2 style={{ fontSize: '1.1rem' }}>Match của bạn</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {matches.map((m) => (
          <li key={m.id} className="card-pele" style={{ marginBottom: 8 }}>
            <Link to={`/pele-dating/chat/${m.id}`}>Match #{m.id} — Chat</Link>
          </li>
        ))}
      </ul>
      {!matches.length && <p className="muted">Chưa có match.</p>}
    </main>
  )
}
