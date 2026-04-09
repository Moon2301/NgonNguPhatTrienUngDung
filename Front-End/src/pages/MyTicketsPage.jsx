import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'
import { useUi } from '../context/useUi.js'

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
        fetch(`${API_BASE}/api/ticket-passes?filter=my`, { credentials: 'include' }) // Đã chỉnh sửa endpoint cho khớp NNLTUD
      ]);

      if (!resB.ok || !resP.ok) throw new Error('Không thể tải dữ liệu.');

      const dataB = await resB.json();
      const dataP = await resP.json();

      setTickets(dataB.bookings || []);
      setMyPasses(dataP.passes || []);
      setLoading(false);
    } catch (e) {
      setErr(e.message);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCancelPass = async (id) => {
    const ok = await ui.confirm({
      title: 'Hủy rao bán',
      message: 'Bạn có chắc muốn ngừng rao bán ghế này?',
      confirmText: 'Dừng bán',
      tone: 'danger'
    })
    if (!ok) return

    try {
      const res = await fetch(`${API_BASE}/api/ticket-passes/${id}/cancel`, {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        fetchData()
        ui.toast.success('Đã hủy rao bán thành công')
      } else {
        const d = await res.json().catch(() => ({}))
        ui.toast.error(d.error || 'Lỗi khi hủy rao bán')
      }
    } catch (err) {
      ui.toast.error('Lỗi khi hủy rao bán')
    }
  }

  const filteredTickets = useMemo(() => {
    if (activeTab === 'upcoming') {
      return tickets.filter(t => t.ticketStatus === 'UPCOMING' || t.ticketStatus === 'LIVE')
    }
    return tickets.filter(t => t.ticketStatus === 'PAST')
  }, [tickets, activeTab])

  if (loading) return <main className="page-shell"><p>Đang tải vé của bạn...</p></main>
  if (err) return <main className="page-shell"><p className="status-msg error">{err}</p></main>

  return (
    <main className="page-shell my-tickets-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      <header className="hide-on-print" style={{ marginBottom: 40, textAlign: 'left' }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, color: '#fff' }}>Vé của tôi</h1>
        <p style={{ color: '#888', marginTop: 8, fontSize: 15 }}>Quản lý các suất chiếu và lịch sử xem phim của bạn.</p>
      </header>

      {/* TABS */}
      <div className="hide-on-print" style={{ display: 'flex', gap: 32, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 40 }}>
        <TabButton
          active={activeTab === 'upcoming'}
          onClick={() => setActiveTab('upcoming')}
          label="Vé sắp xem"
          count={tickets.filter(t => t.ticketStatus === 'UPCOMING' || t.ticketStatus === 'LIVE').length}
        />
        <TabButton
          active={activeTab === 'past'}
          onClick={() => setActiveTab('past')}
          label="Lịch sử"
          count={tickets.filter(t => t.ticketStatus === 'PAST').length}
        />
        <TabButton
          active={activeTab === 'listing'}
          onClick={() => setActiveTab('listing')}
          label="Vé rao bán"
          count={myPasses.filter(p => p.status === 'AVAILABLE' || p.status === 'SOLD' || p.status === 'LOCKED').length}
        />
      </div>

      {activeTab === 'listing' ? (
        <div className="listing-tab-content anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
           {/* Section: Đang rao bán / Đang giữ chỗ */}
           <div>
              <h4 style={{ color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                 <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3498db' }}></span>
                 Đang rao bán ({myPasses.filter(p => p.status === 'AVAILABLE' || p.status === 'LOCKED').length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {myPasses.filter(p => p.status === 'AVAILABLE' || p.status === 'LOCKED').length === 0 ? (
                  <p className="muted" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, textAlign: 'center' }}>Không có vé nào đang rao bán.</p>
                ) : (
                  myPasses.filter(p => p.status === 'AVAILABLE' || p.status === 'LOCKED').map(pass => (
                    <div key={pass.id} className="pele-card" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center', background: 'rgba(30,30,35,0.6)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                       <img src={pass.posterUrl} style={{ width: 50, height: 70, borderRadius: 8, objectFit: 'cover' }} alt="" />
                       <div style={{ flex: 1, minWidth: 0 }}>
                          <h5 style={{ margin: '0 0 4px', color: '#fff', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pass.movieTitle}</h5>
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' }}>
                             <span style={{ color: '#e50914', fontWeight: 800 }}>Ghế: {pass.seat_number}</span>
                             <span className="muted">Giá: <strong style={{ color: '#fff' }}>{pass.price?.toLocaleString()}đ</strong></span>
                             {pass.status === 'LOCKED' && <span style={{ color: '#f1c40f' }}> (Đang được giữ chỗ)</span>}
                          </div>
                       </div>
                       <button
                          className="btn-danger"
                          onClick={() => handleCancelPass(pass.id)}
                          style={{ padding: '6px 12px', fontSize: 10, flexShrink: 0 }}
                       >
                         Hủy
                       </button>
                    </div>
                  ))
                )}
              </div>
           </div>

           {/* Section: Đã bán */}
           <div>
              <h4 style={{ color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                 <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ecc71' }}></span>
                 Đã bán ({myPasses.filter(p => p.status === 'SOLD').length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {myPasses.filter(p => p.status === 'SOLD').length === 0 ? (
                  <p className="muted" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, textAlign: 'center' }}>Lịch sử bán vé trống.</p>
                ) : (
                  myPasses.filter(p => p.status === 'SOLD').map(pass => (
                    <div key={pass.id} className="pele-card" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center', background: 'rgba(0,0,0,0.2)', opacity: 0.8, borderRadius: 16 }}>
                       <img src={pass.posterUrl} style={{ width: 40, height: 56, borderRadius: 6, objectFit: 'cover', filter: 'grayscale(1)' }} alt="" />
                       <div style={{ flex: 1, minWidth: 0 }}>
                          <h5 style={{ margin: '0 0 4px', color: '#888', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pass.movieTitle}</h5>
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' }}>
                             <span style={{ color: '#555', fontWeight: 800 }}>Ghế: {pass.seat_number}</span>
                             <span className="muted">Thu về: <strong style={{ color: '#2ecc71' }}>+{pass.price?.toLocaleString()}đ</strong></span>
                          </div>
                       </div>
                       <div style={{ color: '#2ecc71', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                          <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i> Thành công
                       </div>
                    </div>
                  ))
                )}
              </div>
           </div>
        </div>
      ) : (
        filteredTickets.length === 0 ? (
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
        ) : (
          <div className="hide-on-print" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {filteredTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} onClick={() => setSelectedTicket(t)} />
            ))}
          </div>
        )
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          ui={ui}
        />
      )}
    </main>
  )
}

function TicketCountdown({ startTime }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const target = new Date(startTime).getTime()

    const update = () => {
      const now = Date.now()
      const diff = target - now
      if (diff <= 0) {
        setTimeLeft('Suất chiếu đã bắt đầu')
        return
      }

      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`Bắt đầu sau: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  return (
    <span style={{ fontSize: 13, color: '#e50914', fontWeight: 800 }}>
       <i className="fa-regular fa-clock" style={{ marginRight: 6 }}></i> {timeLeft}
    </span>
  )
}

function TabButton({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', padding: '0 0 16px', cursor: 'pointer',
        color: active ? '#e50914' : '#666',
        fontSize: 16, fontWeight: 800,
        borderBottom: active ? '3px solid #e50914' : '3px solid transparent',
        transition: 'all 0.3s ease',
        display: 'flex', alignItems: 'center', gap: 10
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: active ? '#e50914' : '#333', color: '#fff',
          fontSize: 10, padding: '2px 8px', borderRadius: 10
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

function TicketCard({ ticket, onClick }) {
  const date = new Date(ticket.start_time)
  const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  // Link to public ticket view page
  const ticketViewUrl = `${window.location.origin}/ticket/view/${ticket.id}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticketViewUrl)}`

  const statusLabel = ticket.checkin_status === 'USED' 
    ? { text: 'Đã sử dụng', color: '#888' }
    : {
        'UPCOMING': { text: 'Sắp chiếu', color: '#3498db' },
        'LIVE': { text: 'Đang chiếu', color: '#e50914', pulse: true },
        'PAST': { text: 'Đã xem', color: '#888' }
      }[ticket.ticketStatus] || { text: 'Đã mua', color: '#4caf50' }

  return (
    <div
      onClick={onClick}
      className="ticket-pass-hover transition-all"
      style={{
        display: 'flex', background: 'rgba(30, 30, 35, 0.4)', backdropFilter: 'blur(20px)',
        borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
        position: 'relative', overflow: 'hidden'
      }}
    >
      <div style={{ flex: 1, padding: '16px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 60, height: 84, borderRadius: 8, overflow: 'hidden', flexShrink: 0, boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}>
          <img src={ticket.posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <h3 style={{ margin: '0', fontSize: 'clamp(14px, 4vw, 18px)', fontWeight: 900, color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ticket.movieTitle}</h3>
            <span style={{
              fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1,
              color: statusLabel.color, padding: '2px 8px', background: `${statusLabel.color}15`,
              borderRadius: 20, border: `1px solid ${statusLabel.color}20`,
              display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
            }}>
              {statusLabel.pulse && <span className="pulse-dot" style={{ width: 4, height: 4 }}></span>}
              {statusLabel.text}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            <div style={{ color: '#eee', fontSize: 11 }}>
              Phòng: <strong>{ticket.roomName}</strong> • Ghế: <strong style={{ color: '#e50914' }}>{ticket.seat_numbers}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
               <div style={{ color: '#666', fontSize: 11 }}>
                 {dateStr} • {timeStr}
               </div>
               {ticket.ticketStatus === 'UPCOMING' && ticket.checkin_status !== 'USED' && (
                 <TicketCountdown startTime={ticket.start_time} />
               )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ width: 1, borderLeft: '2px dashed rgba(255,255,255,0.05)', height: '100%', margin: '0 8px' }}></div>
      <div style={{ width: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
         <img src={qrUrl} alt="QR Code" style={{ width: 32, height: 32, filter: 'invert(1) brightness(2)' }} />
      </div>
    </div>
  )
}

function TicketDetailModal({ ticket, onClose, ui }) {
  const [sending, setSending] = useState(false)
  const [showResaleForm, setShowResaleForm] = useState(false)
  const [selectedSeats, setSelectedSeats] = useState([])
  const [resalePricePerSeat, setResalePricePerSeat] = useState(ticket.originalPricePerSeat || 0)
  const [listing, setListing] = useState(false)
  const date = new Date(ticket.start_time)
  const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const ticketViewUrl = `${window.location.origin}/ticket/view/${ticket.id}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketViewUrl)}`

  const originalPrice = ticket.originalPricePerSeat || 0

  const handleResend = async () => {
    setSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${ticket.id}/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        ui.toast.success(data.message)
      } else {
        throw new Error(data.error || 'Gửi email thất bại')
      }
    } catch (e) {
      ui.toast.error(e.message)
    } finally {
      setSending(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleResaleListing = async (e) => {
    e.preventDefault()
    if (selectedSeats.length === 0) return ui.toast.warn('Vui lòng chọn ít nhất một ghế muốn bán')
    
    const priceNum = Number(resalePricePerSeat)
    if (isNaN(priceNum) || priceNum < 1000) return ui.toast.warn('Vui lòng nhập giá bán hợp lệ (tối thiểu 1,000đ)')
    if (priceNum > originalPrice) {
       return ui.toast.warn(`Giá bán (${priceNum.toLocaleString()}đ) không được vượt quá giá mua gốc (${originalPrice.toLocaleString()}đ).`)
    }

    setListing(true)
    try {
      const res = await fetch(`${API_BASE}/api/ticket-passes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookingId: ticket.id,
          seats: selectedSeats,
          passPrice: priceNum
        })
      })
      const data = await res.json()
      if (res.ok) {
        ui.toast.success(`Đã đăng bán ${selectedSeats.length} ghế thành công!`)
        setShowResaleForm(false)
      } else {
        ui.toast.error(data.error)
      }
    } catch (err) {
      ui.toast.error('Lỗi khi đăng bán')
    } finally {
      setListing(false)
    }
  }

  const toggleSeat = (s) => {
    setSelectedSeats(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  return (
    <div
      className="ticket-modal-overlay"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)',
        zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '20px 10px', overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <div className="ticket-modal-inner" style={{
        width: '100%', maxWidth: 450, background: '#111', borderRadius: '40px',
        position: 'relative', boxShadow: '0 50px 100px rgba(0,0,0,0.8)',
        animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        margin: '40px 0 100px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)'
      }} onClick={e => e.stopPropagation()}>

        {/* Header Movie Poster */}
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

        {/* Content */}
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
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Số ghế</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee', fontSize: 14 }}>{ticket.seat_numbers}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Mã vé</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee', fontSize: 14 }}>#{ticket.id}</p>
            </div>
          </div>

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
                       {ticket.seat_numbers.split(',').map(s => {
                         const s_trim = s.trim();
                         const isListed = ticket.listedSeats?.includes(s_trim);
                         return (
                           <button
                             key={s} type="button"
                             disabled={isListed}
                             onClick={() => toggleSeat(s_trim)}
                             style={{
                                padding: '8px 16px', borderRadius: 8, border: '1px solid #333',
                                background: isListed ? '#333' : (selectedSeats.includes(s_trim) ? '#e50914' : 'transparent'),
                                color: isListed ? '#555' : '#fff',
                                cursor: isListed ? 'not-allowed' : 'pointer',
                                position: 'relative'
                             }}
                           >
                             {s_trim}
                             {isListed && <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#444', color: '#fff', fontSize: 7, padding: '2px 4px', borderRadius: 4, whiteSpace: 'nowrap' }}>Đã rao</span>}
                           </button>
                         )
                       })}
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                     <label style={{ display: 'block', fontSize: 10, color: '#555', textTransform: 'uppercase', marginBottom: 8 }}>Giá bán mỗi ghế (VNĐ)</label>
                     <input
                       type="number"
                       value={resalePricePerSeat}
                       onChange={e => setResalePricePerSeat(e.target.value)}
                       style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: '#000', border: '1px solid #333', color: '#fff', outline: 'none' }}
                       placeholder="Nhập giá bán..."
                     />
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="submit" disabled={listing}
                      style={{ flex: 1, padding: '14px', borderRadius: 12, background: '#e50914', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s' }}
                    >
                      {listing ? 'Đang xử lý...' : 'Xác nhận'}
                    </button>
                    <button
                      type="button" onClick={() => setShowResaleForm(false)}
                      style={{ flex: 1, padding: '14px', borderRadius: 12, background: '#333', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Hủy
                    </button>
                  </div>
               </form>
            </div>
          ) : (
            <>
              <div style={{ borderTop: '2px dashed #222', margin: '0 0 32px', position: 'relative' }}>
                <div className="hide-on-print" style={{ position: 'absolute', top: -11, left: -50, width: 22, height: 22, background: '#000', borderRadius: '50%' }}></div>
                <div className="hide-on-print" style={{ position: 'absolute', top: -11, right: -50, width: 22, height: 22, background: '#000', borderRadius: '50%' }}></div>
              </div>

              {/* QR CODE BIG */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', marginBottom: 20 }}>
                  <img src={qrUrl} style={{ width: 140, height: 140 }} alt="QR Code" />
                </div>
                <p style={{ fontSize: 12, color: '#555', maxWidth: 200, margin: '0 auto' }}>Đưa mã này cho nhân viên tại rạp để soát vé</p>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="hide-on-print" style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handlePrint}
                style={{ flex: 1, padding: '14px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', color: '#eee', border: '1px solid #222', cursor: 'pointer', fontWeight: 700 }}
              >
                <i className="fa-solid fa-print" style={{ marginRight: 8 }}></i> In vé
              </button>
              <button
                onClick={handleResend}
                disabled={sending}
                style={{ flex: 1, padding: '14px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', color: '#eee', border: '1px solid #222', cursor: 'pointer', fontWeight: 700 }}
              >
                <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-envelope'}`} style={{ marginRight: 8 }}></i> Email
              </button>
            </div>
            <button
              className="btn-primary-pele"
              onClick={() => setShowResaleForm(!showResaleForm)}
              style={{ padding: '14px', borderRadius: 16, fontSize: 14, fontWeight: 700, background: '#fff', color: '#000' }}
            >
              <i className="fa-solid fa-tag" style={{ marginRight: 8 }}></i> Rao bán lại vé này
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
