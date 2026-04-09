import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

function rowLabel(index) {
  if (index >= 0 && index < 26) return String.fromCharCode(65 + index)
  return `R${index + 1}`
}

function fmtTime(v) {
  if (v == null) return '—'
  const s = String(v)
  return s.length >= 16 ? s.slice(0, 16) : s
}

export default function AdminSeatPage() {
  const [showtimes, setShowtimes] = useState([])
  const [sid, setSid] = useState('')
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/showtimes`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setShowtimes(d.showtimes || []))
      .catch((e) => setErr(e.message))
  }, [])

  useEffect(() => {
    if (!sid) {
      setData(null)
      return
    }
    setErr('')
    fetch(`${API_BASE}/api/admin/seatmap/${sid}`, { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Lỗi')
        return d
      })
      .then(setData)
      .catch((e) => setErr(e.message))
  }, [sid])

  const booked = useMemo(() => new Set(data?.bookedSeats || []), [data])
  const held = useMemo(() => new Set(data?.heldSeats || []), [data])

  const rowCount = data?.rows && Number(data.rows) > 0 ? Number(data.rows) : 10
  const colCount = data?.cols && Number(data.cols) > 0 ? Number(data.cols) : 10
  const rowLabels = useMemo(() => Array.from({ length: rowCount }, (_, i) => rowLabel(i)), [rowCount])
  const colNums = useMemo(() => Array.from({ length: colCount }, (_, i) => i + 1), [colCount])

  const sortedSt = useMemo(() => [...showtimes].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))), [showtimes])

  return (
    <main className="page-shell">
      <Link to="/admin" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        ← Dashboard
      </Link>
      <h1>Sơ đồ ghế theo suất</h1>
      {err && <p className="form-error-msg">{err}</p>}

      <div className="form-pele card-pele" style={{ maxWidth: 720 }}>
        <label>Chọn suất chiếu</label>
        <select value={sid} onChange={(e) => setSid(e.target.value)}>
          <option value="">--</option>
          {sortedSt.map((s) => (
            <option key={s.id} value={s.id}>
              #{s.id} · {fmtTime(s.start_time)} · {s.movieTitle || 'Phim'} · {s.roomName || 'Rạp'}
            </option>
          ))}
        </select>
      </div>

      {data && (
        <>
          <p className="muted" style={{ marginTop: 12 }}>
            Giữ chỗ thanh toán: ~{data.holdMinutes ?? 5} phút (sau đó ghế tự trả).
          </p>
          <div className="seat-map card-pele seat-map-shell" style={{ marginTop: 8 }}>
            <div className="seat-map-screen">MÀN HÌNH · {data.showtime?.roomName || ''}</div>
            <div className="seat-map-scale">
              <table className="seat-table">
                <tbody>
                  {rowLabels.map((row) => (
                    <tr key={row}>
                      <td className="seat-row-label">{row}</td>
                      {colNums.map((col) => {
                        const id = `${row}${col}`
                        const isBooked = booked.has(id)
                        const isHeld = held.has(id)
                        let cls = 'seat-cell-btn seat-free'
                        if (isBooked) cls = 'seat-cell-btn seat-booked'
                        else if (isHeld) cls = 'seat-cell-btn seat-held'
                        return (
                          <td key={id}>
                            <button type="button" className={cls} disabled title={id}>
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
            <div className="seat-legend">
              <span>
                <i className="leg-free" /> Trống
              </span>
              <span>
                <i className="leg-held" /> Đang giữ
              </span>
              <span>
                <i className="leg-booked" /> Đã đặt
              </span>
            </div>
          </div>

          <h3 style={{ marginTop: 24 }}>Giao dịch liên quan (không huỷ / lỗi)</h3>
          <table className="table-pele">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Ghế</th>
                <th>TT</th>
                <th>Đặt lúc</th>
                <th>Khách</th>
                <th>Tiền</th>
              </tr>
            </thead>
            <tbody>
              {(data.bookings || []).map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.seat_numbers}</td>
                  <td>{b.status}</td>
                  <td>{b.booking_time ? new Date(b.booking_time).toLocaleString('vi-VN') : '—'}</td>
                  <td>{b.customer_name || '—'}</td>
                  <td>{Number(b.total_amount || 0).toLocaleString('vi-VN')}đ</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(data.bookings || []).length && <p className="muted">Chưa có booking active cho suất này.</p>}
        </>
      )}
    </main>
  )
}
