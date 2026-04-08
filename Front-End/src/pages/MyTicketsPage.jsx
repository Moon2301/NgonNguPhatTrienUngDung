import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [activeTab, setActiveTab] = useState('upcoming') 
  const [selectedTicket, setSelectedTicket] = useState(null)

  const fetchTickets = () => {
    fetch(`${API_BASE}/api/bookings/me`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Không thể tải lịch sử đặt vé.')
        return res.json()
      })
      .then((data) => {
        setTickets(data.bookings || [])
        setLoading(false)
      })
      .catch((e) => {
        setErr(e.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const filteredTickets = useMemo(() => {
    if (activeTab === 'upcoming') {
      return tickets.filter(t => t.ticketStatus === 'UPCOMING' || t.ticketStatus === 'LIVE')
    }
    return tickets.filter(t => t.ticketStatus === 'PAST')
  }, [tickets, activeTab])

  if (loading) return <main className="page-shell"><p>Đang tải vé của bạn...</p></main>
  if (err) return <main className="page-shell"><p className="text-error">{err}</p></main>

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
      </div>

      {filteredTickets.length === 0 ? (
        <div className="card-pele hide-on-print" style={{ textAlign: 'center', padding: '100px 40px', background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <i className="fa-solid fa-ticket-simple" style={{ fontSize: 32, color: '#333' }}></i>
          </div>
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>Không có vé nào</h3>
          <p className="muted">Danh sách {activeTab === 'upcoming' ? 'vé sắp tới' : 'vé cũ'} của bạn đang trống.</p>
          {activeTab === 'upcoming' && (
            <Link to="/" className="btn-primary" style={{ display: 'inline-block', marginTop: 32, textDecoration: 'none', padding: '14px 32px' }}>
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
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal 
          ticket={selectedTicket} 
          onClose={() => setSelectedTicket(null)} 
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

  const statusLabel = {
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
        position: 'relative'
      }}
    >
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', gap: 24, alignItems: 'center' }}>
        <div style={{ width: 80, height: 110, borderRadius: 12, overflow: 'hidden', flexShrink: 0, boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}>
          <img src={ticket.posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color: '#fff' }}>{ticket.movieTitle}</h3>
            <span style={{ 
              fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1,
              color: statusLabel.color, padding: '4px 12px', background: `${statusLabel.color}15`,
              borderRadius: 20, border: `1px solid ${statusLabel.color}20`,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              {statusLabel.pulse && <span className="pulse-dot"></span>}
              {statusLabel.text}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ color: '#eee', fontSize: 13 }}>
              Phòng: <strong>{ticket.roomName}</strong> • Ghế: <strong style={{ color: '#e50914' }}>{ticket.seat_numbers}</strong>
              <div style={{ marginTop: 6, color: '#666' }}>
                {dateStr} • {timeStr}
              </div>
            </div>
            {ticket.ticketStatus === 'UPCOMING' && (
              <TicketCountdown startTime={ticket.start_time} />
            )}
          </div>
        </div>
      </div>
      <div style={{ width: 1, borderLeft: '2px dashed rgba(255,255,255,0.05)', height: '100%' }}></div>
      <div style={{ width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <img src={qrUrl} alt="QR Code" style={{ width: 50, height: 50, filter: 'invert(1) brightness(2)' }} />
      </div>
    </div>
  )
}

function TicketDetailModal({ ticket, onClose }) {
  const [sending, setSending] = useState(false)
  const date = new Date(ticket.start_time)
  const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const ticketViewUrl = `${window.location.origin}/ticket/view/${ticket.id}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketViewUrl)}`

  const handleResend = async () => {
    setSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${ticket.id}/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message)
      } else {
        throw new Error(data.error || 'Gửi email thất bại')
      }
    } catch (e) {
      alert(e.message)
    } finally {
      setSending(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div 
      className="ticket-modal-overlay"
      style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(15px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }} 
      onClick={onClose}
    >
      <div className="ticket-modal-inner" style={{ 
        width: '100%', maxWidth: 450, background: '#111', borderRadius: 40, 
        overflow: 'hidden', position: 'relative', boxShadow: '0 50px 100px rgba(0,0,0,0.8)',
        animation: 'modalSlideUp 0.5s ease'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header Movie Poster */}
        <div style={{ height: 260, position: 'relative' }}>
          <img src={ticket.posterUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} alt="" />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(to top, #111, transparent)' }}></div>
          <button onClick={onClose} className="hide-on-print" style={{ position: 'absolute', top: 30, right: 30, width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', cursor: 'pointer' }}>
             <i className="fa-solid fa-xmark"></i>
          </button>
          
          <div style={{ position: 'absolute', bottom: 20, left: 40, right: 40 }}>
            {ticket.ticketStatus === 'UPCOMING' && <div className="hide-on-print" style={{ marginBottom: 12 }}><TicketCountdown startTime={ticket.start_time} /></div>}
            <h2 style={{ fontSize: 28, margin: 0, fontWeight: 900, color: '#fff' }}>{ticket.movieTitle}</h2>
            <p className="muted" style={{ margin: '8px 0 0' }}>{ticket.roomName} • {ticket.duration} phút</p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '30px 40px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40 }}>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Ngày chiếu</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee' }}>{dateStr}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Giờ chiếu</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#e50914', fontSize: 22 }}>{timeStr}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Số ghế</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee' }}>{ticket.seat_numbers}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Mã vé</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee' }}>#{ticket.id}</p>
            </div>
          </div>

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

          {/* Action Buttons */}
          <div className="hide-on-print" style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={handlePrint}
                style={{ flex: 1, padding: '16px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', color: '#eee', border: '1px solid #222', cursor: 'pointer', fontWeight: 700 }}
              >
                <i className="fa-solid fa-file-pdf" style={{ marginRight: 8 }}></i> Tải PDF
              </button>
              <button 
                onClick={handleResend}
                disabled={sending}
                style={{ flex: 1, padding: '16px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', color: '#eee', border: '1px solid #222', cursor: 'pointer', fontWeight: 700 }}
              >
                <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-envelope'}`} style={{ marginRight: 8 }}></i> {sending ? 'Đang gửi...' : 'Gửi lại email'}
              </button>
            </div>
            <Link to={`/booking/${ticket.showtime_id}`} style={{ padding: '16px', borderRadius: 16, background: '#e50914', color: '#fff', textAlign: 'center', textDecoration: 'none', fontWeight: 800 }}>
              <i className="fa-solid fa-rotate-right" style={{ marginRight: 8 }}></i> Đặt lại suất chiếu này
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
