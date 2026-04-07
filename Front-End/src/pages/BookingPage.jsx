import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_BASE } from '../api'

const ROWS = 'ABCDEFGHIJ'.split('')
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function BookingPage() {
  const { showtimeId } = useParams()
  const navigate = useNavigate()
  const [seatmap, setSeatmap] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/bookings/showtimes/${showtimeId}/seatmap`, { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Lỗi')
        return d
      })
      .then(setSeatmap)
      .catch((e) => setErr(e.message))
  }, [showtimeId])

  const occupied = useMemo(() => new Set(seatmap?.occupiedSeats || []), [seatmap])

  function toggle(seat) {
    if (occupied.has(seat)) return
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(seat)) n.delete(seat)
      else n.add(seat)
      return n
    })
  }

  function next() {
    const seats = Array.from(selected)
    if (!seats.length) {
      alert('Chọn ít nhất một ghế')
      return
    }
    const st = seatmap.showtime
    const price = Number(st.price || 0)
    navigate('/checkout', {
      state: {
        showtimeId: Number(showtimeId),
        seats,
        showtime: st,
        pricePerSeat: price,
        totalAmount: seats.length * price,
      },
    })
  }

  if (err) return <main className="page-shell"><p className="muted">{err}</p></main>
  if (!seatmap) return <main className="page-shell"><p>Đang tải sơ đồ ghế...</p></main>

  const st = seatmap.showtime

  return (
    <main className="page-shell">
      <Link to={st.movie_id ? `/movie/${st.movie_id}` : '/'} className="back-link">
        ← Quay lại
      </Link>
      <h1>Chọn ghế</h1>
      <p className="muted">
        Giá vé: {Number(st.price || 0).toLocaleString('vi-VN')}đ / ghế · Đã chọn: {selected.size}
      </p>
      <div className="seat-map card-pele" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 4, margin: '0 auto' }}>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row}>
                <td style={{ color: '#888', fontWeight: 700 }}>{row}</td>
                {COLS.map((col) => {
                  const id = `${row}${col}`
                  const occ = occupied.has(id)
                  const sel = selected.has(id)
                  return (
                    <td key={id}>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        disabled={occ}
                        style={{
                          width: 28,
                          height: 28,
                          fontSize: 10,
                          borderRadius: 6,
                          border: '1px solid #444',
                          background: occ ? '#333' : sel ? '#e50914' : 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          cursor: occ ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {col}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Màn hình · Ghế đã bán: tối màu</p>
      <button type="button" className="btn-primary-pele" style={{ marginTop: 16 }} onClick={next}>
        Tiếp tục thanh toán
      </button>
    </main>
  )
}
