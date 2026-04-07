import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'

export default function GroupRoomPage() {
  const { roomCode } = useParams()
  const [data, setData] = useState(null)
  const [invite, setInvite] = useState({ name: '', email: '', phone: '' })
  const [seats, setSeats] = useState('')
  const [memberId, setMemberId] = useState('')
  const [err, setErr] = useState('')

  function load() {
    fetch(`${API_BASE}/api/group-bookings/${roomCode}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        const m = d.members?.[0]
        if (m?.id) setMemberId(String(m.id))
      })
  }

  useEffect(() => {
    load()
  }, [roomCode])

  async function inviteMember(e) {
    e.preventDefault()
    setErr('')
    try {
      await apiPost(`/api/group-bookings/${roomCode}/invite`, invite)
      setInvite({ name: '', email: '', phone: '' })
      load()
    } catch (er) {
      setErr(er.message)
    }
  }

  async function saveSeats(e) {
    e.preventDefault()
    try {
      await apiPost(`/api/group-bookings/${roomCode}/seats`, {
        memberId: Number(memberId),
        seats,
      })
      load()
    } catch (er) {
      alert(er.message)
    }
  }

  async function paySingle() {
    const name = prompt('Tên thanh toán?', 'Khách group')
    if (!name) return
    try {
      await fetch(`${API_BASE}/api/group-bookings/${roomCode}/pay-single`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name }),
      }).then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Lỗi')
        return d
      })
      alert('Thanh toán thành công (demo)')
      load()
    } catch (er) {
      alert(er.message)
    }
  }

  if (!data) return <main className="page-shell"><p>Đang tải phòng...</p></main>

  return (
    <main className="page-shell">
      <Link to="/group" className="back-link">
        ← Tạo phòng mới
      </Link>
      <h1>Phòng {roomCode}</h1>
      <p className="muted">Trạng thái: {data.statusData?.status} · Ghế: {data.group?.all_seats || '—'}</p>
      {err && <p style={{ color: '#ff6b6b' }}>{err}</p>}

      <h2 style={{ fontSize: '1rem' }}>Thành viên</h2>
      <ul>
        {data.members?.map((m) => (
          <li key={m.id}>
            {m.name} ({m.email}) {m.is_creator ? '· Chủ phòng' : ''}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: '1rem' }}>Mời thêm</h2>
      <form className="form-pele card-pele" onSubmit={inviteMember}>
        <input placeholder="Tên" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} required />
        <input placeholder="Email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} required />
        <input placeholder="SĐT" value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} />
        <button type="submit" className="btn-primary-pele">
          Mời
        </button>
      </form>

      <h2 style={{ fontSize: '1rem' }}>Ghế (thành viên)</h2>
      <form className="form-pele card-pele" onSubmit={saveSeats}>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {data.members?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input placeholder="A1,A2" value={seats} onChange={(e) => setSeats(e.target.value)} required />
        <button type="submit" className="btn-ghost">
          Lưu ghế
        </button>
      </form>

      <button type="button" className="btn-primary-pele" style={{ marginTop: 16 }} onClick={paySingle}>
        Thanh toán một lần (demo)
      </button>
    </main>
  )
}
