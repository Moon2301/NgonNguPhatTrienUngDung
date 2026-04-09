import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_BASE } from '../api'
import { useAuth } from '../context/useAuth.js'

export default function TicketDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pass, setPass] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/ticket-passes/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPass(d.pass))
  }, [id])

  async function buy() {
    if (!user) {
      navigate('/login')
      return
    }
    const res = await fetch(`${API_BASE}/api/ticket-passes/${id}/buy`, { method: 'POST', credentials: 'include' })
    const d = await res.json()
    if (!res.ok) alert(d.error || 'Lỗi')
    else navigate('/my-tickets')
  }

  if (!pass) return <main className="page-shell"><p>Đang tải...</p></main>

  return (
    <main className="page-shell">
      <Link to="/ticket-market" className="back-link">
        ← Chợ vé
      </Link>
      <h1>Pass vé #{pass.id}</h1>
      <div className="card-pele">
        <p>
          <strong>{pass.movieTitle}</strong>
        </p>
        <p>Ghế: {pass.seat_numbers}</p>
        <p>Giá pass: {Number(pass.pass_price).toLocaleString('vi-VN')}đ</p>
        <p>Trạng thái: {pass.status}</p>
      </div>
      {pass.status === 'AVAILABLE' && (
        <button type="button" className="btn-primary-pele" onClick={buy}>
          Mua
        </button>
      )}
    </main>
  )
}
