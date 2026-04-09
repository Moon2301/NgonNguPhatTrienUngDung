import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import PeleSelect from '../components/PeleSelect'
import { useUi } from '../context/useUi.js'

export default function GroupPage() {
  const navigate = useNavigate()
  const ui = useUi()
  const [showtimes, setShowtimes] = useState([])
  const [showtimeId, setShowtimeId] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [creatorEmail, setCreatorEmail] = useState('')
  const [creatorPhone, setCreatorPhone] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/group-bookings/showtimes`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setShowtimes(d.showtimes || [])
        if (d.showtimes?.[0]) setShowtimeId(String(d.showtimes[0].id))
      })
  }, [])

  async function createRoom(e) {
    e.preventDefault()
    setErr('')
    if (!showtimeId) return setErr('Vui lòng chọn suất chiếu.')
    if (!String(creatorName || '').trim()) return setErr('Vui lòng nhập tên người tạo.')
    try {
      const res = await apiPost('/api/group-bookings', {
        showtimeId: Number(showtimeId),
        creatorName,
        creatorEmail: creatorEmail || undefined,
        creatorPhone: creatorPhone || undefined,
      })
      ui.toast.success('Đã tạo phòng.')
      navigate(`/group/${res.roomCode}`)
    } catch (er) {
      setErr(er.message)
    }
  }

  return (
    <main className="page-shell" style={{ maxWidth: 520 }}>
      <h1>Đặt vé nhóm</h1>
      <p className="muted">Tạo phòng, mời bạn bè, chọn ghế và thanh toán.</p>
      <form className="form-pele card-pele" onSubmit={createRoom} noValidate>
        {err && <p style={{ color: '#ff6b6b' }}>{err}</p>}
        <PeleSelect
          label="Suất chiếu"
          value={showtimeId}
          onChange={(v) => setShowtimeId(v)}
          required
          options={showtimes.map((s) => ({
            value: s.id,
            label: `${s.movieTitle || '—'} — ${s.start_time ? String(s.start_time).slice(0, 16) : ''} — ${Number(s.price || 0).toLocaleString('vi-VN')}đ`,
          }))}
        />
        {/* noValidate để không bật popup validate của trình duyệt */}
        <input type="hidden" value={showtimeId} />
        <label>Tên người tạo</label>
        <input value={creatorName} onChange={(e) => setCreatorName(e.target.value)} />
        <label>Email</label>
        <input type="email" value={creatorEmail} onChange={(e) => setCreatorEmail(e.target.value)} />
        <label>Điện thoại</label>
        <input value={creatorPhone} onChange={(e) => setCreatorPhone(e.target.value)} />
        <button type="submit" className="btn-primary-pele">
          Tạo phòng
        </button>
      </form>
    </main>
  )
}
