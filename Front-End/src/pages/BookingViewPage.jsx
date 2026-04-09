import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_BASE } from '../api'
import { useAuth } from '../context/useAuth'
import { useUi } from '../context/useUi'

export default function BookingViewPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const ui = useUi()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)

  const loadTicket = () => {
    setLoading(true)
    fetch(`${API_BASE}/api/bookings/${id}/view`)
      .then(res => {
        if (!res.ok) throw new Error('Không tìm thấy thông tin vé.')
        return res.json()
      })
      .then(data => {
        setTicket(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadTicket()
  }, [id])

  const handleCheckIn = async () => {
    if (checking) return
    const ok = await ui.confirm({
      title: 'Xác nhận soát vé',
      message: `Xác nhận cho khách hàng ${ticket.customer_name} vào phòng chiếu?`,
      confirmText: 'Xác nhận',
      cancelText: 'Bỏ qua'
    })
    if (!ok) return

    setChecking(true)
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok) {
        ui.toast.success(data.message)
        loadTicket() // Refresh data
      } else {
        ui.toast.error(data.error || 'Lỗi khi soát vé')
      }
    } catch (err) {
      ui.toast.error('Lỗi kết nối hệ thống')
    } finally {
      setChecking(false)
    }
  }

  if (loading) return (
    <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <p>Đang tải thông tin vé...</p>
    </main>
  )

  if (error || !ticket) return (
    <main style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 20 }}>
      <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 48, color: '#e50914', marginBottom: 20 }}></i>
      <h2 style={{ color: '#e50914', margin: '0 0 10px' }}>Lỗi truy xuất</h2>
      <p style={{ color: '#888' }}>{error || 'Vé không tồn tại hoặc đã bị hủy.'}</p>
      <Link to="/" style={{ color: '#fff', marginTop: 30, textDecoration: 'none', background: '#222', padding: '10px 24px', borderRadius: 12 }}>Quay lại trang chủ</Link>
    </main>
  )

  const date = new Date(ticket.start_time)
  const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const isUsed = ticket.checkin_status === 'USED'
  const canCheckIn = !isUsed && user?.role?.toUpperCase() === 'ADMIN'

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '40px 20px' }}>
      <div style={{ maxWidth: 450, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <h1 style={{ color: '#e50914', fontSize: 24, letterSpacing: 4, margin: 0 }}>PELE CINEMA</h1>
            <p style={{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 }}>Hệ thống soát vé thông minh</p>
        </div>

        <div style={{ background: '#111', borderRadius: 32, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', border: `1px solid ${isUsed ? '#e50914' : '#222'}` }}>
           {/* Poster Section */}
           <div style={{ height: 200, position: 'relative' }}>
              <img src={ticket.posterUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} alt="" />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(to top, #111, transparent)' }}></div>
              <div style={{ position: 'absolute', bottom: 20, left: 24, right: 24 }}>
                 <h2 style={{ fontSize: 22, margin: 0, fontWeight: 900 }}>{ticket.movieTitle}</h2>
                 <p style={{ color: '#e50914', margin: '4px 0 0', fontSize: 12, fontWeight: 700 }}>{ticket.roomName} • {ticket.duration} phút</p>
              </div>
           </div>

           {/* Info Section */}
           <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: 30 }}>
                 <div>
                    <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Ngày chiếu</p>
                    <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{dateStr}</p>
                 </div>
                 <div>
                    <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Giờ bắt đầu</p>
                    <p style={{ margin: '4px 0 0', color: '#e50914', fontWeight: 900, fontSize: 18 }}>{timeStr}</p>
                 </div>
                 <div>
                    <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Ghế ngồi</p>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: 16 }}>{ticket.seat_numbers}</p>
                 </div>
                 <div>
                    <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>Mã vé</p>
                    <p style={{ margin: '4px 0 0', fontWeight: 700 }}>#{ticket.id}</p>
                 </div>
              </div>

              {/* Status Badge */}
              <div style={{ textAlign: 'center', marginBottom: 30 }}>
                 <div style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 30px', borderRadius: 40,
                    background: isUsed ? 'rgba(229, 9, 20, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    border: `1px solid ${isUsed ? '#e50914' : '#22c55e'}`,
                    color: isUsed ? '#e50914' : '#22c55e',
                    fontWeight: 900, fontSize: 16, letterSpacing: 2
                 }}>
                   <i className={`fa-solid ${isUsed ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
                   {isUsed ? 'ĐÃ SỬ DỤNG' : 'HỢP LỆ'}
                 </div>
                 
                 {isUsed && (
                   <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.02)', fontSize: 12, color: '#666' }}>
                      <p style={{ margin: '0 0 4px' }}>Xác nhận bởi: <strong>{ticket.checked_in_by_name || 'Hệ thống'}</strong></p>
                      <p style={{ margin: 0 }}>Lúc: {new Date(ticket.checked_in_at).toLocaleString('vi-VN')}</p>
                   </div>
                 )}
              </div>

              <div style={{ background: '#0a0a0a', padding: 20, borderRadius: 16, textAlign: 'center', marginBottom: 30 }}>
                 <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>Khách hàng</p>
                 <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{ticket.customer_name}</p>
              </div>

              {/* Admin Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 {canCheckIn ? (
                    <button 
                      onClick={handleCheckIn}
                      disabled={checking}
                      className="btn-primary-pele"
                      style={{ padding: '18px', borderRadius: 16, fontSize: 16, fontWeight: 800 }}
                    >
                       <i className={`fa-solid ${checking ? 'fa-spinner fa-spin' : 'fa-check-double'}`} style={{ marginRight: 10 }}></i>
                       {checking ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN VÀO PHÒNG'}
                    </button>
                 ) : (
                    !isUsed && (
                       <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>
                             Vui lòng đưa màn hình này cho nhân viên để xác thực.
                          </p>
                          {(!user || user.role?.toUpperCase() !== 'ADMIN') && (
                             <Link 
                               to={`/login?redirect=/ticket/view/${id}`}
                               style={{ 
                                  display: 'inline-block', padding: '10px 20px', borderRadius: 12, 
                                  background: 'rgba(255,255,255,0.05)', color: '#eee', 
                                  textDecoration: 'none', fontSize: 13, border: '1px solid #333' 
                               }}
                             >
                                <i className="fa-solid fa-lock" style={{ marginRight: 8 }}></i>
                                Đăng nhập Admin để soát vé
                             </Link>
                          )}
                       </div>
                    )
                 )}
              </div>
           </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: 40 }}>
           <Link to="/" style={{ color: '#333', textDecoration: 'none', fontSize: 13 }}>&copy; 2026 PELE Cinema System</Link>
        </div>
      </div>
    </main>
  )
}
