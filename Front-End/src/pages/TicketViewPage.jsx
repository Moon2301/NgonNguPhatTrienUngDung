import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function TicketViewPage() {
  const { bookingId } = useParams()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/bookings/public/${bookingId}`)
      .then(res => {
        if (!res.ok) throw new Error('Không tìm thấy thông tin vé hoặc vé đã hết hạn.')
        return res.json()
      })
      .then(data => {
        setTicket(data)
        setLoading(false)
      })
      .catch(e => {
        setErr(e.message)
        setLoading(false)
      })
  }, [bookingId])

  if (loading) return <div className="public-view-shell"><div className="loader-pele"></div><p>Đang tải thông tin vé...</p></div>
  if (err) return <div className="public-view-shell"><i className="fa-solid fa-circle-exclamation text-error" style={{ fontSize: 48, marginBottom: 20 }}></i><h2 className="text-error">{err}</h2><Link to="/" className="btn-primary-pele" style={{ textDecoration: 'none', marginTop: 24 }}>Quay lại trang chủ</Link></div>

  const date = new Date(ticket.start_time)
  const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="public-view-shell" style={{ background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="ticket-modal-inner" style={{ 
        width: '100%', maxWidth: 400, background: '#111', borderRadius: 40, 
        overflow: 'hidden', position: 'relative', boxShadow: '0 50px 100px rgba(0,0,0,0.8)'
      }}>
        
        {/* Verification Badge */}
        <div style={{ position: 'absolute', top: 30, right: 30, zIndex: 10, background: '#e50914', color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
           <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i> Đã xác thực
        </div>

        {/* Header Movie Poster */}
        <div style={{ height: 260, position: 'relative' }}>
          <img src={ticket.posterUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} alt="" />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(to top, #111, transparent)' }}></div>
          
          <div style={{ position: 'absolute', bottom: 20, left: 40, right: 40 }}>
            <h2 style={{ fontSize: 26, margin: 0, fontWeight: 900, color: '#fff' }}>{ticket.movieTitle}</h2>
            <p className="muted" style={{ margin: '8px 0 0' }}>{ticket.roomName} • {ticket.duration} phút</p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '30px 40px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Ngày chiếu</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee', fontSize: 14 }}>{dateStr}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Giờ chiếu</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#e50914', fontSize: 22 }}>{timeStr}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Số ghế</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee', fontSize: 18 }}>{ticket.seat_numbers}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Mã vé</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee' }}>#{ticket.id}</p>
            </div>
          </div>

          <div style={{ borderTop: '2px dashed #222', margin: '0 0 40px', position: 'relative' }}>
             <div style={{ position: 'absolute', top: -11, left: -50, width: 22, height: 22, background: '#000', borderRadius: '50%' }}></div>
             <div style={{ position: 'absolute', top: -11, right: -50, width: 22, height: 22, background: '#000', borderRadius: '50%' }}></div>
          </div>

          {/* User Info */}
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <p style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Người đặt vé:</p>
            <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: 18 }}>{ticket.customer_name}</p>
          </div>

          <div style={{ textAlign: 'center' }}>
             <img 
               src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`VERIFIED-BY-PELE-${ticket.id}`)}`} 
               style={{ width: 120, height: 120, padding: 10, background: '#fff', borderRadius: 16 }} 
               alt="Verify" 
             />
             <p style={{ fontSize: 11, color: '#333', marginTop: 16 }}>Vé điện tử hợp lệ</p>
          </div>

          <div style={{ marginTop: 40, textAlign: 'center' }}>
             <Link to="/" style={{ color: '#e50914', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
               <i className="fa-solid fa-house" style={{ marginRight: 6 }}></i> Về trang chủ PELE Cinema
             </Link>
          </div>
        </div>
      </div>

      <style>{`
        .public-view-shell {
          text-align: center;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .loader-pele {
          width: 48px;
          height: 48px;
          border: 3px solid #e50914;
          border-bottom-color: transparent;
          border-radius: 50%;
          display: inline-block;
          animation: rotation 1s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes rotation {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
