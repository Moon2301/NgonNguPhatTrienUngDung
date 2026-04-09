import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'

export default function DatingChatPage() {
  const { matchId } = useParams()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')

  function load() {
    fetch(`${API_BASE}/api/dating/matches/${matchId}/messages`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [matchId])

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await apiPost(`/api/dating/matches/${matchId}/messages`, { content: text })
      setText('')
      load()
    } catch (er) {
      alert(er.message)
    }
  }

  return (
    <main className="page-shell" style={{ maxWidth: 560 }}>
      <Link to="/pele-dating" className="back-link">
        ← Dating
      </Link>
      <h1>Chat #{matchId}</h1>
      <div className="card-pele" style={{ minHeight: 280, maxHeight: 400, overflowY: 'auto' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 8, opacity: 0.95 }}>
            <span className="small muted">{m.sender_id}</span>: {m.content}
          </div>
        ))}
      </div>
      <form onSubmit={send} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #444', background: '#1a1a1f', color: '#fff' }}
          placeholder="Nhắn tin..."
        />
        <button type="submit" className="btn-primary-pele">
          Gửi
        </button>
      </form>
    </main>
  )
}
