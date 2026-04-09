import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'
import { useUi } from '../context/useUi.js'

function getValidSeats(ticket) {
  const all = (ticket.seat_numbers || '').split(',').map(s => s.trim()).filter(Boolean)
  const listed = ticket.listedSeats || []
  const sold = ticket.soldSeats || []
  return all.filter(s => !listed.includes(s) && !sold.includes(s))
}

function qrImageUrl(payload) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`
}

function useSeatQR(bookingId, seat) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchQR = useCallback(async () => {
    if (!bookingId || !seat) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/qr?bookingId=${bookingId}&seat=${encodeURIComponent(seat)}`, { credentials: 'include' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Lỗi tạo QR'); return }
      setData(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [bookingId, seat])

  useEffect(() => { fetchQR() }, [fetchQR])
  return { data, loading, error }
}

export default function MyTicketsPage() {
  const ui = useUi()
  const [tickets, setTickets] = useState([])
  const [myPasses, setMyPasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [activeTab, setActiveTab] = useState('upcoming')
  const [selectedTicket, setSelectedTicket] = useState(null)

  const fetchData = async () => {
    try {
      const [resB, resP] = await Promise.all([
        fetch(`${API_BASE}/api/bookings/me`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/ticket-passes?filter=my`, { credentials: 'include' }),
      ])
      if (!resB.ok || !resP.ok) throw new Error('Không thể tải dữ liệu.')
      const dataB = await resB.json()
      const dataP = await resP.json()
      setTickets(dataB.bookings || [])
      setMyPasses(dataP.passes || [])
      setLoading(false)
    } catch (e) {
      setErr(e.message)
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleCancelPass = async (id) => {
    const ok = await ui.confirm({ title: 'Hủy rao bán', message: 'Bạn có chắc muốn ngừng rao bán ghế này?', confirmText: 'Dừng bán', tone: 'danger' })
    if (!ok) return
    try {
      const res = await fetch(`${API_BASE}/api/ticket-passes/${id}/cancel`, { method: 'POST', credentials: 'include' })
      if (res.ok) { fetchData(); ui.toast.success('Đã hủy rao bán thành công') }
      else { const d = await res.json().catch(() => ({})); ui.toast.error(d.error || 'Lỗi khi hủy rao bán') }
    } catch { ui.toast.error('Lỗi khi hủy rao bán') }
  }

  const filteredTickets = useMemo(() => {
    if (activeTab === 'upcoming') return tickets.filter(t => t.ticketStatus === 'UPCOMING' || t.ticketStatus === 'LIVE')
    return tickets.filter(t => t.ticketStatus === 'PAST')
  }, [tickets, activeTab])

  const ticketsWithProducts = useMemo(() => tickets.filter(t => t.products && t.products.length > 0), [tickets])

  if (loading) return <main className="page-shell"><p>Đang tải vé của bạn...</p></main>
  if (err) return <main className="page-shell"><p className="status-msg error">{err}</p></main>

  return (
    <main className="page-shell my-tickets-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      <header className="hide-on-print" style={{ marginBottom: 40, textAlign: 'left' }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, color: '#fff' }}>Vé của tôi</h1>
        <p style={{ color: '#888', marginTop: 8, fontSize: 15 }}>Quản lý các suất chiếu và lịch sử xem phim của bạn.</p>
      </header>

      <div className="hide-on-print" style={{ display: 'flex', gap: 32, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 40, overflowX: 'auto' }}>
        <TabButton active={activeTab === 'upcoming'} onClick={() => setActiveTab('upcoming')} label="Vé sắp xem"
          count={tickets.filter(t => t.ticketStatus === 'UPCOMING' || t.ticketStatus === 'LIVE').length} />
        <TabButton active={activeTab === 'past'} onClick={() => setActiveTab('past')} label="Lịch sử"
          count={tickets.filter(t => t.ticketStatus === 'PAST').length} />
        <TabButton active={activeTab === 'services'} onClick={() => setActiveTab('services')} label="Dịch vụ đã đặt"
          count={ticketsWithProducts.length} />
        <TabButton active={activeTab === 'listing'} onClick={() => setActiveTab('listing')} label="Vé rao bán"
          count={myPasses.filter(p => p.status === 'AVAILABLE' || p.status === 'SOLD' || p.status === 'LOCKED').length} />
      </div>

      {activeTab === 'services' ? (
        <ServicesTab tickets={ticketsWithProducts} />
      ) : activeTab === 'listing' ? (
        <ListingTab myPasses={myPasses} onCancel={handleCancelPass} />
      ) : (
        filteredTickets.length === 0 ? (
          <EmptyState activeTab={activeTab} />
        ) : (
          <div className="hide-on-print" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {filteredTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} onClick={() => setSelectedTicket(t)} />
            ))}
          </div>
        )
      )}

      {selectedTicket && (
        <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} ui={ui} onRefresh={fetchData} />
      )}
    </main>
  )
}

/* ───── Services Tab ───── */

function ServicesTab({ tickets }) {
  if (tickets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.01)', borderRadius: 24, border: '1px dashed rgba(255,255,255,0.06)' }}>
        <i className="fa-solid fa-mug-hot" style={{ fontSize: 40, color: '#333', marginBottom: 16 }}></i>
        <h3 style={{ fontSize: 18, marginBottom: 8, color: '#666' }}>Chưa có dịch vụ nào</h3>
        <p className="muted" style={{ fontSize: 13 }}>Combo bắp nước bạn đặt kèm vé sẽ hiện ở đây.</p>
      </div>
    )
  }

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {tickets.map((t) => {
        const isUsed = t.checkin_status === 'USED' || t.ticketStatus === 'PAST'
        const date = t.start_time ? new Date(t.start_time) : null
        const dateStr = date ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''
        const timeStr = date ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''

        return (
          <div key={t.id} style={{ background: 'rgba(30,30,35,0.5)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={t.posterUrl} alt="" style={{ width: 36, height: 50, borderRadius: 6, objectFit: 'cover' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>{t.movieTitle}</h4>
                  <span className="muted" style={{ fontSize: 11 }}>Vé #{t.id} • {dateStr} {timeStr}</span>
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1,
                padding: '4px 10px', borderRadius: 20,
                color: isUsed ? '#888' : '#2ecc71',
                background: isUsed ? 'rgba(136,136,136,0.1)' : 'rgba(46,204,113,0.1)',
                border: `1px solid ${isUsed ? 'rgba(136,136,136,0.2)' : 'rgba(46,204,113,0.2)'}`,
              }}>
                {isUsed ? 'Đã nhận' : 'Chưa nhận'}
              </span>
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {t.products.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {p.image_url && <img src={p.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', background: '#222' }} />}
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#ddd', fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                    <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>x{p.qty}</span>
                  </div>
                  <span style={{ color: '#aaa', fontSize: 12, fontWeight: 700 }}>{(p.line_total || p.unit_price * p.qty).toLocaleString()}đ</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#888' }}>Tổng: <strong style={{ color: '#fff' }}>{(t.products_amount || t.products.reduce((s, p) => s + (p.line_total || 0), 0)).toLocaleString()}đ</strong></span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───── Listing Tab ───── */

function ListingTab({ myPasses, onCancel }) {
  const available = myPasses.filter(p => p.status === 'AVAILABLE' || p.status === 'LOCKED')
  const sold = myPasses.filter(p => p.status === 'SOLD')

  return (
    <div className="listing-tab-content anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      <div>
        <h4 style={{ color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3498db' }}></span>
          Đang rao bán ({available.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {available.length === 0 ? (
            <p className="muted" style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, textAlign: 'center' }}>Không có vé nào đang rao bán.</p>
          ) : available.map(pass => (
            <div key={pass.id} className="pele-card" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center', background: 'rgba(30,30,35,0.6)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
              <img src={pass.posterUrl} style={{ width: 50, height: 70, borderRadius: 8, objectFit: 'cover' }} alt="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h5 style={{ margin: '0 0 4px', color: '#fff', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pass.movieTitle}</h5>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' }}>
                  <span style={{ color: '#e50914', fontWeight: 800 }}>Ghế: {pass.seat_number}</span>
                  <span className="muted">Giá: <strong style={{ color: '#fff' }}>{pass.pass_price?.toLocaleString()}đ</strong></span>
                  {pass.status === 'LOCKED' && <span style={{ color: '#f1c40f' }}>(Đang được giữ chỗ)</span>}
                </div>
              </div>
              <button className="btn-danger" onClick={() => onCancel(pass.id)} style={{ padding: '6px 12px', fontSize: 10, flexShrink: 0 }}>Hủy</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ecc71' }}></span>
          Đã bán ({sold.length})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sold.length === 0 ? (
            <p className="muted" style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 16, textAlign: 'center' }}>Lịch sử bán vé trống.</p>
          ) : sold.map(pass => (
            <div key={pass.id} className="pele-card" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center', background: 'rgba(0,0,0,0.2)', opacity: 0.8, borderRadius: 16 }}>
              <img src={pass.posterUrl} style={{ width: 40, height: 56, borderRadius: 6, objectFit: 'cover', filter: 'grayscale(1)' }} alt="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h5 style={{ margin: '0 0 4px', color: '#888', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pass.movieTitle}</h5>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' }}>
                  <span style={{ color: '#555', fontWeight: 800 }}>Ghế: {pass.seat_number}</span>
                  <span className="muted">Thu về: <strong style={{ color: '#2ecc71' }}>+{pass.pass_price?.toLocaleString()}đ</strong></span>
                </div>
              </div>
              <div style={{ color: '#2ecc71', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i> Thành công
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ───── Empty State ───── */

function EmptyState({ activeTab }) {
  return (
    <div className="card-pele hide-on-print" style={{ textAlign: 'center', padding: '100px 40px', background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <i className="fa-solid fa-ticket-simple" style={{ fontSize: 32, color: '#333' }}></i>
      </div>
      <h3 style={{ fontSize: 20, marginBottom: 8 }}>Không có vé nào</h3>
      <p className="muted">Danh sách {activeTab === 'upcoming' ? 'vé sắp tới' : 'vé cũ'} của bạn đang trống.</p>
      {activeTab === 'upcoming' && (
        <Link to="/" className="btn-primary-pele" style={{ display: 'inline-block', marginTop: 32, textDecoration: 'none', padding: '14px 32px' }}>
          Khám phá phim mới
        </Link>
      )}
    </div>
  )
}

/* ───── Helpers ───── */

function TicketCountdown({ startTime }) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const target = new Date(startTime).getTime()
    const update = () => {
      const diff = target - Date.now()
      if (diff <= 0) { setTimeLeft('Suất chiếu đã bắt đầu'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`Bắt đầu sau: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [startTime])
  return <span style={{ fontSize: 13, color: '#e50914', fontWeight: 800 }}><i className="fa-regular fa-clock" style={{ marginRight: 6 }}></i> {timeLeft}</span>
}

function TabButton({ active, onClick, label, count }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', padding: '0 0 16px', cursor: 'pointer',
      color: active ? '#e50914' : '#666', fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap',
      borderBottom: active ? '3px solid #e50914' : '3px solid transparent', transition: 'all 0.3s ease',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {label}
      {count > 0 && <span style={{ background: active ? '#e50914' : '#333', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>{count}</span>}
    </button>
  )
}

/* ───── Ticket Card ───── */

function TicketCard({ ticket, onClick }) {
  const date = new Date(ticket.start_time)
  const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const validSeats = getValidSeats(ticket)
  const hasQR = validSeats.length > 0
  const firstSeatQR = useSeatQR(hasQR ? ticket.id : null, hasQR ? validSeats[0] : null)

  const statusLabel = ticket.checkin_status === 'USED'
    ? { text: 'Đã sử dụng', color: '#888' }
    : { 'UPCOMING': { text: 'Sắp chiếu', color: '#3498db' }, 'LIVE': { text: 'Đang chiếu', color: '#e50914', pulse: true }, 'PAST': { text: 'Đã xem', color: '#888' } }[ticket.ticketStatus] || { text: 'Đã mua', color: '#4caf50' }

  return (
    <div onClick={onClick} className="ticket-pass-hover transition-all" style={{
      display: 'flex', background: 'rgba(30, 30, 35, 0.4)', backdropFilter: 'blur(20px)',
      borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ flex: 1, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 60, height: 84, borderRadius: 8, overflow: 'hidden', flexShrink: 0, boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}>
          <img src={ticket.posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 'clamp(14px, 4vw, 18px)', fontWeight: 900, color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ticket.movieTitle}</h3>
            <span style={{
              fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1,
              color: statusLabel.color, padding: '2px 8px', background: `${statusLabel.color}15`,
              borderRadius: 20, border: `1px solid ${statusLabel.color}20`,
              display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}>
              {statusLabel.pulse && <span className="pulse-dot" style={{ width: 4, height: 4 }}></span>}
              {statusLabel.text}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            <div style={{ color: '#eee', fontSize: 11 }}>
              Phòng: <strong>{ticket.roomName}</strong> • Ghế: <strong style={{ color: '#e50914' }}>{ticket.seat_numbers}</strong>
              {(ticket.listedSeats?.length > 0 || ticket.soldSeats?.length > 0) && (
                <span style={{ color: '#f1c40f', fontSize: 10, marginLeft: 6 }}>
                  ({ticket.listedSeats?.length > 0 ? `${ticket.listedSeats.length} đang bán` : ''}{ticket.listedSeats?.length > 0 && ticket.soldSeats?.length > 0 ? ', ' : ''}{ticket.soldSeats?.length > 0 ? `${ticket.soldSeats.length} đã bán` : ''})
                </span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ color: '#666', fontSize: 11 }}>{dateStr} • {timeStr}</div>
              {ticket.ticketStatus === 'UPCOMING' && ticket.checkin_status !== 'USED' && <TicketCountdown startTime={ticket.start_time} />}
            </div>
          </div>
        </div>
      </div>
      <div style={{ width: 1, borderLeft: '2px dashed rgba(255,255,255,0.05)', height: '100%', margin: '0 8px' }}></div>
      <div style={{ width: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {hasQR && firstSeatQR.data ? (
          <img src={qrImageUrl(firstSeatQR.data.payload)} alt="QR" style={{ width: 32, height: 32, filter: 'invert(1) brightness(2)' }} />
        ) : hasQR && firstSeatQR.loading ? (
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 16, color: '#555' }}></i>
        ) : (
          <i className="fa-solid fa-ban" style={{ fontSize: 20, color: '#555' }} title="Tất cả ghế đã bán/đang rao bán"></i>
        )}
      </div>
    </div>
  )
}

/* ───── Ticket Detail Modal ───── */

function SeatQRCode({ bookingId, seat }) {
  const { data, loading, error } = useSeatQR(bookingId, seat)
  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: '#555' }}></i></div>
  if (error) return <p style={{ textAlign: 'center', color: '#e50914', fontSize: 12 }}>{error}</p>
  if (!data) return null
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', marginBottom: 12 }}>
        <img src={qrImageUrl(data.payload)} style={{ width: 140, height: 140 }} alt="QR" />
      </div>
      <p style={{ fontSize: 11, color: '#e50914', fontWeight: 800, margin: '0 0 4px' }}>Ghế {seat}</p>
      <p style={{ fontSize: 9, color: '#444', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: 260, margin: '0 auto' }}>{data.payload}</p>
    </div>
  )
}

function TicketDetailModal({ ticket, onClose, ui, onRefresh }) {
  const [sending, setSending] = useState(false)
  const [showResaleForm, setShowResaleForm] = useState(false)
  const [selectedSeats, setSelectedSeats] = useState([])
  const [resalePricePerSeat, setResalePricePerSeat] = useState(ticket.originalPricePerSeat || 0)
  const [listing, setListing] = useState(false)
  const [activeQRSeat, setActiveQRSeat] = useState(null)
  const date = new Date(ticket.start_time)
  const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const allSeats = (ticket.seat_numbers || '').split(',').map(s => s.trim()).filter(Boolean)
  const listedSeats = ticket.listedSeats || []
  const soldSeats = ticket.soldSeats || []
  const validSeats = allSeats.filter(s => !listedSeats.includes(s) && !soldSeats.includes(s))

  useEffect(() => { if (validSeats.length > 0 && !activeQRSeat) setActiveQRSeat(validSeats[0]) }, [])

  const originalPrice = ticket.originalPricePerSeat || 0

  const handleResend = async () => {
    setSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${ticket.id}/resend-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
      const data = await res.json()
      if (res.ok) ui.toast.success(data.message)
      else throw new Error(data.error || 'Gửi email thất bại')
    } catch (e) { ui.toast.error(e.message) }
    finally { setSending(false) }
  }

  const handleResaleListing = async (e) => {
    e.preventDefault()
    if (selectedSeats.length === 0) return ui.toast.warn('Vui lòng chọn ít nhất một ghế muốn bán')
    const priceNum = Number(resalePricePerSeat)
    if (isNaN(priceNum) || priceNum < 1000) return ui.toast.warn('Vui lòng nhập giá bán hợp lệ (tối thiểu 1,000đ)')
    if (priceNum > originalPrice) return ui.toast.warn(`Giá bán (${priceNum.toLocaleString()}đ) không được vượt quá giá mua gốc (${originalPrice.toLocaleString()}đ).`)

    setListing(true)
    try {
      const res = await fetch(`${API_BASE}/api/ticket-passes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ bookingId: ticket.id, seats: selectedSeats, passPrice: priceNum }),
      })
      const data = await res.json()
      if (res.ok) { ui.toast.success(`Đã đăng bán ${selectedSeats.length} ghế thành công!`); setShowResaleForm(false); onRefresh?.() }
      else ui.toast.error(data.error)
    } catch { ui.toast.error('Lỗi khi đăng bán') }
    finally { setListing(false) }
  }

  const toggleSeat = (s) => setSelectedSeats(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  return (
    <div className="ticket-modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)',
      zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px 10px', overflowY: 'auto',
    }} onClick={onClose}>
      <div className="ticket-modal-inner" style={{
        width: '100%', maxWidth: 450, background: '#111', borderRadius: 40,
        position: 'relative', boxShadow: '0 50px 100px rgba(0,0,0,0.8)',
        animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        margin: '40px 0 100px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ height: 260, position: 'relative' }}>
          <img src={ticket.posterUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} alt="" />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(to top, #111, transparent)' }}></div>
          <button onClick={onClose} className="hide-on-print" style={{ position: 'absolute', top: 30, right: 30, width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
          <div style={{ position: 'absolute', bottom: 20, left: 24, right: 24 }}>
            {ticket.ticketStatus === 'UPCOMING' && <div className="hide-on-print" style={{ marginBottom: 12 }}><TicketCountdown startTime={ticket.start_time} /></div>}
            <h2 style={{ fontSize: 'clamp(20px, 5vw, 28px)', margin: 0, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{ticket.movieTitle}</h2>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>{ticket.roomName} • {ticket.duration} phút</p>
          </div>
        </div>

        <div style={{ padding: '24px 24px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px', marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Ngày chiếu</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee', fontSize: 14 }}>{dateStr}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Giờ chiếu</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#e50914', fontSize: 18 }}>{timeStr}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Ghế</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {allSeats.map(s => {
                  const isSold = soldSeats.includes(s)
                  const isListed = listedSeats.includes(s)
                  return (
                    <span key={s} style={{
                      padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                      background: isSold ? 'rgba(136,136,136,0.15)' : isListed ? 'rgba(241,196,15,0.15)' : 'rgba(229,9,20,0.15)',
                      color: isSold ? '#666' : isListed ? '#f1c40f' : '#e50914',
                      border: `1px solid ${isSold ? '#333' : isListed ? 'rgba(241,196,15,0.3)' : 'rgba(229,9,20,0.3)'}`,
                      textDecoration: isSold ? 'line-through' : 'none',
                    }}>
                      {s}
                      {isSold && <span style={{ fontSize: 8, marginLeft: 4 }}>(đã bán)</span>}
                      {isListed && <span style={{ fontSize: 8, marginLeft: 4 }}>(đang bán)</span>}
                    </span>
                  )
                })}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Mã vé</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee', fontSize: 14 }}>#{ticket.id}</p>
            </div>
          </div>

          {/* Products / Services */}
          {ticket.products && ticket.products.length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 12px' }}>Dịch vụ đi kèm</p>
              {ticket.products.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < ticket.products.length - 1 ? 8 : 0 }}>
                  {p.image_url && <img src={p.image_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />}
                  <span style={{ flex: 1, color: '#ccc', fontSize: 12 }}>{p.name} <span className="muted">x{p.qty}</span></span>
                  <span style={{ color: '#aaa', fontSize: 11 }}>{(p.line_total || p.unit_price * p.qty).toLocaleString()}đ</span>
                </div>
              ))}
            </div>
          )}

          {showResaleForm ? (
            <div className="resale-form anim-fade-in" style={{ padding: 20, background: '#1a1a1a', borderRadius: 24, border: '1px solid #e50914' }}>
              <h4 style={{ color: '#fff', marginTop: 0, marginBottom: 16 }}>Rao bán vé này</h4>
              <div style={{ marginBottom: 20, padding: 12, background: 'rgba(229, 9, 20, 0.1)', borderRadius: 12, border: '1px solid rgba(229, 9, 20, 0.2)' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#ff4d4d' }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }}></i>
                  Lưu ý: Giá bán mỗi ghế (Tối đa {originalPrice.toLocaleString()}đ)
                </p>
              </div>
              <form onSubmit={handleResaleListing}>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 10, color: '#555', textTransform: 'uppercase', marginBottom: 8 }}>Chọn ghế muốn bán</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {allSeats.map(s => {
                      const isListed = listedSeats.includes(s)
                      const isSold = soldSeats.includes(s)
                      const disabled = isListed || isSold
                      return (
                        <button key={s} type="button" disabled={disabled} onClick={() => toggleSeat(s)} style={{
                          padding: '8px 16px', borderRadius: 8, border: '1px solid #333',
                          background: disabled ? '#333' : selectedSeats.includes(s) ? '#e50914' : 'transparent',
                          color: disabled ? '#555' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative',
                        }}>
                          {s}
                          {isListed && <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#444', color: '#fff', fontSize: 7, padding: '2px 4px', borderRadius: 4, whiteSpace: 'nowrap' }}>Đã rao</span>}
                          {isSold && <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#444', color: '#fff', fontSize: 7, padding: '2px 4px', borderRadius: 4, whiteSpace: 'nowrap' }}>Đã bán</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 10, color: '#555', textTransform: 'uppercase', marginBottom: 8 }}>Giá bán mỗi ghế (VNĐ)</label>
                  <input type="number" value={resalePricePerSeat} onChange={e => setResalePricePerSeat(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: '#000', border: '1px solid #333', color: '#fff', outline: 'none' }} placeholder="Nhập giá bán..." />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" disabled={listing} style={{ flex: 1, padding: 14, borderRadius: 12, background: '#e50914', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                    {listing ? 'Đang xử lý...' : 'Xác nhận'}
                  </button>
                  <button type="button" onClick={() => setShowResaleForm(false)} style={{ flex: 1, padding: 14, borderRadius: 12, background: '#333', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div style={{ borderTop: '2px dashed #222', margin: '0 0 32px', position: 'relative' }}>
                <div className="hide-on-print" style={{ position: 'absolute', top: -11, left: -50, width: 22, height: 22, background: '#000', borderRadius: '50%' }}></div>
                <div className="hide-on-print" style={{ position: 'absolute', top: -11, right: -50, width: 22, height: 22, background: '#000', borderRadius: '50%' }}></div>
              </div>

              {validSeats.length > 0 ? (
                <div>
                  {validSeats.length > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                      {validSeats.map(s => (
                        <button key={s} onClick={() => setActiveQRSeat(s)} style={{
                          padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 12,
                          background: activeQRSeat === s ? '#e50914' : 'rgba(255,255,255,0.06)',
                          color: activeQRSeat === s ? '#fff' : '#888', transition: 'all 0.2s',
                        }}>{s}</button>
                      ))}
                    </div>
                  )}
                  {activeQRSeat && <SeatQRCode bookingId={ticket.id} seat={activeQRSeat} />}
                  <p style={{ fontSize: 12, color: '#555', maxWidth: 240, margin: '12px auto 0', textAlign: 'center' }}>
                    Đưa mã này cho nhân viên tại rạp để soát vé
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <i className="fa-solid fa-tag" style={{ fontSize: 36, color: '#444', marginBottom: 12 }}></i>
                  <p style={{ color: '#666', fontSize: 13, margin: 0 }}>Tất cả ghế đã được rao bán hoặc đã bán.<br />QR không khả dụng.</p>
                </div>
              )}
            </>
          )}

          <div className="hide-on-print" style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {validSeats.length > 0 && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => window.print()} style={{ flex: 1, padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', color: '#eee', border: '1px solid #222', cursor: 'pointer', fontWeight: 700 }}>
                  <i className="fa-solid fa-print" style={{ marginRight: 8 }}></i> In vé
                </button>
                <button onClick={handleResend} disabled={sending} style={{ flex: 1, padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', color: '#eee', border: '1px solid #222', cursor: 'pointer', fontWeight: 700 }}>
                  <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-envelope'}`} style={{ marginRight: 8 }}></i> Email
                </button>
              </div>
            )}
            {validSeats.length > 0 && (
              <button className="btn-primary-pele" onClick={() => setShowResaleForm(!showResaleForm)}
                style={{ padding: 14, borderRadius: 16, fontSize: 14, fontWeight: 700, background: '#fff', color: '#000' }}>
                <i className="fa-solid fa-tag" style={{ marginRight: 8 }}></i> Rao bán lại vé này
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
