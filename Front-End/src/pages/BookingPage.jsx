import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_BASE } from '../api'
import { useUi } from '../context/useUi.js'
import { io } from 'socket.io-client'

function rowLabel(index) {
  if (index >= 0 && index < 26) return String.fromCharCode(65 + index)
  return `R${index + 1}`
}

export default function BookingPage() {
  const { showtimeId } = useParams()
  const navigate = useNavigate()
  const ui = useUi()
  const [seatmap, setSeatmap] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [productQty, setProductQty] = useState({})
  const [err, setErr] = useState('')
  const [liveHeld, setLiveHeld] = useState([])
  const [mySockId, setMySockId] = useState('')
  const socketRef = useRef(null)
  const selectedRef = useRef(new Set())
  const lastSentRef = useRef(new Set())

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

  const booked = useMemo(() => new Set(seatmap?.bookedSeats || []), [seatmap])
  const held = useMemo(() => {
    const s = new Set(seatmap?.heldSeats || [])
    for (const x of liveHeld || []) s.add(x)
    return s
  }, [seatmap, liveHeld])

  const products = useMemo(() => (Array.isArray(seatmap?.products) ? seatmap.products : []), [seatmap])
  const productMap = useMemo(() => new Map(products.map((p) => [Number(p.id), p])), [products])
  const productsAmount = useMemo(() => {
    let sum = 0
    for (const [k, v] of Object.entries(productQty || {})) {
      const pid = Number(k)
      const qty = Number(v || 0)
      if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue
      const p = productMap.get(pid)
      if (!p) continue
      sum += Number(p.price || 0) * qty
    }
    return sum
  }, [productQty, productMap])

  const rowCount = seatmap?.rows && Number(seatmap.rows) > 0 ? Number(seatmap.rows) : 10
  const colCount = seatmap?.cols && Number(seatmap.cols) > 0 ? Number(seatmap.cols) : 10
  const rowLabels = useMemo(() => Array.from({ length: rowCount }, (_, i) => rowLabel(i)), [rowCount])
  const colNums = useMemo(() => Array.from({ length: colCount }, (_, i) => i + 1), [colCount])

  function toggle(seat) {
    if (booked.has(seat) || held.has(seat)) return
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(seat)) n.delete(seat)
      else n.add(seat)
      return n
    })
  }

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  // Realtime holds via Socket.IO
  useEffect(() => {
    const sid = Number(showtimeId)
    if (!Number.isFinite(sid) || sid <= 0) return

    const socket = io(API_BASE, { withCredentials: true, transports: ['websocket', 'polling'] })
    socketRef.current = socket
    setMySockId(socket.id || '')
    socket.emit('showtime:join', { showtimeId: sid })
    socket.on('showtime:holds', (payload) => {
      if (Number(payload?.showtimeId) !== sid) return
      const holds = payload.holds || []
      const heldSeats = holds
        .filter((h) => h && h.seat && String(h.socketId) !== String(socket.id))
        .map((h) => String(h.seat))
      setLiveHeld(heldSeats)
    })

    // Cleanup on leave: release any seats we're holding
    const onBeforeUnload = () => {
      const seats = Array.from(selectedRef.current || [])
      if (seats.length) socket.emit('seat:release', { showtimeId: sid, seats })
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      const seats = Array.from(selectedRef.current || [])
      if (seats.length) socket.emit('seat:release', { showtimeId: sid, seats })
      socket.close()
      socketRef.current = null
      setMySockId('')
      lastSentRef.current = new Set()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showtimeId])

  // When selection changes, tell server to hold/release those seats
  useEffect(() => {
    const sid = Number(showtimeId)
    if (!Number.isFinite(sid) || sid <= 0) return
    const sock = socketRef.current
    if (!sock) return
    const nextSel = new Set(selected || [])
    const prevSel = lastSentRef.current || new Set()

    const toHold = []
    const toRelease = []
    for (const s of nextSel) if (!prevSel.has(s)) toHold.push(s)
    for (const s of prevSel) if (!nextSel.has(s)) toRelease.push(s)

    if (toHold.length) sock.emit('seat:hold', { showtimeId: sid, seats: toHold })
    if (toRelease.length) sock.emit('seat:release', { showtimeId: sid, seats: toRelease })
    lastSentRef.current = nextSel
  }, [selected, showtimeId])

  function next() {
    const seats = Array.from(selected)
    if (!seats.length) {
      ui.toast.warn('Bạn cần chọn ít nhất một ghế.')
      return
    }
    const st = seatmap.showtime
    const price = Number(st.price || 0)
    const pickedProducts = Object.entries(productQty || {})
      .map(([id, qty]) => ({ id: Number(id), qty: Number(qty) }))
      .filter((x) => Number.isFinite(x.id) && x.id > 0 && Number.isFinite(x.qty) && x.qty > 0)
    navigate('/checkout', {
      state: {
        showtimeId: Number(showtimeId),
        seats,
        showtime: st,
        pricePerSeat: price,
        products: pickedProducts,
        productsAmount,
        totalAmount: seats.length * price + productsAmount,
        seatSocketId: mySockId || socketRef.current?.id || '',
      },
    })
  }

  if (err) return <main className="page-shell"><p className="muted">{err}</p></main>
  if (!seatmap) return <main className="page-shell"><p>Đang tải sơ đồ ghế...</p></main>

  const st = seatmap.showtime
  const holdMin = seatmap.holdMinutes ?? 5

  return (
    <main className="page-shell">
      <Link to={st.movie_id ? `/movie/${st.movie_id}` : '/'} className="back-link">
        ← Quay lại
      </Link>
      <h1>Chọn ghế</h1>
      <p className="muted">
        Giá vé: {Number(st.price || 0).toLocaleString('vi-VN')}đ / ghế · Đã chọn: {selected.size}
        {st.roomName ? ` · ${st.roomName}` : ''}
      </p>
      <p className="muted small" style={{ maxWidth: 720 }}>
        Ghế vàng: đang có người giữ chỗ thanh toán (tối đa ~{holdMin} phút), quá hạn hoặc huỷ sẽ trả chỗ. Xám đậm: đã
        bán.
      </p>

      <div className="seat-map card-pele seat-map-shell">
        <div className="seat-map-screen">MÀN HÌNH</div>
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
                    const isSel = selected.has(id)
                    const disabled = isBooked || isHeld
                    let cls = 'seat-cell-btn seat-free'
                    if (isBooked) cls = 'seat-cell-btn seat-booked'
                    else if (isHeld) cls = 'seat-cell-btn seat-held'
                    else if (isSel) cls = 'seat-cell-btn seat-selected'
                    return (
                      <td key={id}>
                        <button type="button" className={cls} onClick={() => toggle(id)} disabled={disabled} title={id}>
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
            <i className="leg-sel" /> Bạn chọn
          </span>
          <span>
            <i className="leg-held" /> Đang giữ (chưa xong thanh toán)
          </span>
          <span>
            <i className="leg-booked" /> Đã đặt
          </span>
        </div>
      </div>

      <div className="card-pele" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Dịch vụ kèm theo</h3>
        <p className="muted small" style={{ marginTop: -6 }}>
          Bạn có thể chọn bắp/nước/combo… (tính vào tổng thanh toán).
        </p>

        {!products.length ? (
          <p className="muted">Hiện chưa có dịch vụ.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {products.map((p) => {
              const pid = Number(p.id)
              const qty = Number(productQty?.[pid] || 0)
              const price = Number(p.price || 0)
              const img = p.image_url || p.imageUrl || null
              return (
                <div key={pid} className="card-pele" style={{ padding: 12, borderRadius: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        flex: '0 0 auto',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'rgba(255,255,255,0.45)',
                        fontWeight: 900,
                      }}
                    >
                      {img ? <img src={img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🍿'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div className="muted small">{price.toLocaleString('vi-VN')}đ</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        setProductQty((prev) => {
                          const next = { ...(prev || {}) }
                          const cur = Number(next[pid] || 0)
                          next[pid] = Math.max(0, cur - 1)
                          if (!next[pid]) delete next[pid]
                          return next
                        })
                      }
                      disabled={qty <= 0}
                    >
                      −
                    </button>
                    <div style={{ minWidth: 34, textAlign: 'center', fontWeight: 900 }}>{qty}</div>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        setProductQty((prev) => {
                          const next = { ...(prev || {}) }
                          const cur = Number(next[pid] || 0)
                          next[pid] = Math.min(99, cur + 1)
                          return next
                        })
                      }
                    >
                      +
                    </button>
                    <div style={{ marginLeft: 'auto', fontWeight: 900 }}>
                      {(qty * price).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, fontWeight: 900 }}>
          <span className="muted">Tạm tính dịch vụ:</span>
          <span>{productsAmount.toLocaleString('vi-VN')}đ</span>
        </div>
      </div>

      <button type="button" className="btn-primary-pele" style={{ marginTop: 16 }} onClick={next}>
        Tiếp tục thanh toán
      </button>
    </main>
  )
}
