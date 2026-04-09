import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import { useUi } from '../context/useUi.js'

function formatMoneyDots(n) {
  const num = Number(n || 0)
  return Number.isFinite(num) ? num.toLocaleString('vi-VN') : '0'
}

function normalizeMoneyInput(raw) {
  // Giữ lại chữ số, tự thêm dấu chấm ngăn cách nghìn theo vi-VN
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return ''
  const n = Number(digits)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('vi-VN')
}

function parseMoneyInput(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return NaN
  const n = Number(digits)
  return Number.isFinite(n) ? n : NaN
}

export default function TicketPostPage() {
  const navigate = useNavigate()
  const ui = useUi()
  const [bookings, setBookings] = useState([])
  const [bookingId, setBookingId] = useState('')
  const [seatPick, setSeatPick] = useState(new Set())
  const [passPrice, setPassPrice] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        const [bRes, pRes] = await Promise.all([
          fetch(`${API_BASE}/api/bookings/me`, { credentials: 'include' }).then((r) => r.json()),
          fetch(`${API_BASE}/api/ticket-passes/me/list`, { credentials: 'include' }).then((r) => r.json()),
        ])
        if (cancelled) return
        const rows = bRes.bookings || []
        const passes = pRes.passes || []
        // Không chặn theo booking nữa (giờ pass theo từng ghế). Lọc vẫn để lại toàn bộ vé SUCCESS.
        setBookings(rows)
      } catch (e) {
        if (!cancelled) ui.toast.error(e.message || 'Không tải được danh sách vé.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const selected = bookingId ? bookings.find((b) => String(b.id) === String(bookingId)) : null
  const bookingSeats = selected?.seat_numbers ? String(selected.seat_numbers).split(',').map((s) => s.trim()).filter(Boolean) : []
  const originalPrice = selected?.total_amount != null ? Number(selected.total_amount) : null
  const originalPerSeat = bookingSeats.length ? Math.round(originalPrice / bookingSeats.length) : null

  useEffect(() => {
    setSeatPick(new Set())
  }, [bookingId])

  function toggleSeat(s) {
    setSeatPick((prev) => {
      const n = new Set(prev)
      if (n.has(s)) n.delete(s)
      else n.add(s)
      return n
    })
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!bookingId) return setErr('Vui lòng chọn vé.')
    if (!seatPick.size) return setErr('Vui lòng chọn ít nhất 1 ghế để đăng bán.')
    const price = parseMoneyInput(passPrice)
    if (passPrice === '' || !Number.isFinite(price) || price < 0) return setErr('Giá pass không hợp lệ.')
    try {
      await apiPost('/api/ticket-passes', {
        bookingId: Number(bookingId),
        seats: Array.from(seatPick),
        passPrice: Number(price),
      })
      ui.toast.success('Đã đăng bán pass.')
      navigate('/ticket-market')
    } catch (er) {
      setErr(er.message)
    }
  }

  return (
    <main className="page-shell" style={{ maxWidth: 980 }}>
      <Link to="/ticket-market" className="back-link">
        ← Chợ vé
      </Link>
      <h1>Đăng bán pass</h1>
      <form className="form-pele card-pele" onSubmit={submit} noValidate style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
        {err && <p className="form-error-msg">{err}</p>}

        <label>Chọn vé</label>
        <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} disabled={loading}>
          <option value="">{loading ? 'Đang tải...' : '--'}</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.movieTitle} — {b.seat_numbers} — {formatMoneyDots(b.total_amount)}đ
            </option>
          ))}
        </select>
        {!loading && !bookings.length && <p className="muted">Bạn chưa có vé nào còn sử dụng được để đăng bán.</p>}

        {selected && (
          <div className="card-pele" style={{ padding: 14, marginTop: 6 }}>
            <div className="muted small" style={{ marginBottom: 8, fontWeight: 700 }}>
              Chọn ghế muốn đăng bán (mỗi ghế = 1 pass)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {bookingSeats.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={seatPick.has(s) ? 'btn-primary-pele' : 'btn-ghost'}
                  onClick={() => toggleSeat(s)}
                  style={{ padding: '8px 14px' }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="muted small" style={{ marginTop: 10 }}>
              Đã chọn: <strong style={{ color: '#fff' }}>{seatPick.size}</strong> ghế
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <label style={{ marginBottom: 4 }}>Giá pass (VNĐ)</label>
          {originalPrice != null && (
            <small className="muted" style={{ marginBottom: 12 }}>
              Giá gốc: <strong style={{ color: '#fff' }}>{formatMoneyDots(originalPrice)}đ</strong>
              {originalPerSeat != null && (
                <>
                  {' '}
                  · /ghế: <strong style={{ color: '#fff' }}>{formatMoneyDots(originalPerSeat)}đ</strong>
                </>
              )}
            </small>
          )}
        </div>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ví dụ: 120.000"
          value={passPrice}
          onChange={(e) => setPassPrice(normalizeMoneyInput(e.target.value))}
        />

        <button type="submit" className="btn-primary-pele" disabled={loading}>
          Đăng
        </button>
      </form>
    </main>
  )
}
