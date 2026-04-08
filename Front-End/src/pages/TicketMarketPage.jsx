import { useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function TicketMarketPage() {
  const [passes, setPasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(null)
  const { user, refresh } = useAuth()

  useEffect(() => {
    fetch(`${API_BASE}/api/ticket-passes`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setPasses(data.passes || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleBuy = async (pass) => {
    if (!window.confirm(`Bạn có chắc muốn mua vé phim "${pass.movieTitle}" với giá ${pass.price.toLocaleString()}đ?`)) return
    
    setBuying(pass.id)
    try {
      const res = await fetch(`${API_BASE}/api/ticket-passes/${pass.id}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Mua vé thất bại')
      
      alert('Mua vé thành công! Vé đã được chuyển vào "Vé của tôi"')
      setPasses(passes.filter(p => p.id !== pass.id))
      refresh() // Update wallet balance
    } catch (err) {
      alert(err.message)
    } finally {
      setBuying(null)
    }
  }

  if (loading) return <div className="container-pele" style={{ textAlign: 'center', padding: 100 }}><div className="loader-pele"></div></div>

  return (
    <div className="container-pele anim-fade-in" style={{ padding: '40px 20px' }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Chợ Vé Chuyển Nhượng</h1>
        <p className="muted">Săn vé giá rẻ hoặc vé từ các suất chiếu đã cháy vé từ cộng đồng người dùng PELE.</p>
      </div>

      {passes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '100px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 32 }}>
           <i className="fa-solid fa-ticket-simple" style={{ fontSize: 48, color: '#333', marginBottom: 20 }}></i>
           <p className="muted">Hiện tại chưa có vé nào được rao bán. Hãy quay lại sau nhé!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
          {passes.map(pass => (
            <div key={pass.id} className="market-card" style={{ 
              background: '#111', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
              transition: 'transform 0.3s ease, border-color 0.3s ease'
            }}>
              <div style={{ height: 180, position: 'relative' }}>
                <img src={pass.posterUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} alt="" />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #111, transparent)' }}></div>
                <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
                   <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#e50914', fontWeight: 900, letterSpacing: 1, marginBottom: 4 }}>Pass Ticket</div>
                   <h3 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 800 }}>{pass.movieTitle}</h3>
                </div>
              </div>

              <div style={{ padding: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                   <div>
                     <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', margin: '0 0 4px' }}>Thời gian</p>
                     <p style={{ margin: 0, color: '#eee', fontSize: 13, fontWeight: 600 }}>{new Date(pass.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(pass.start_time).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</p>
                   </div>
                   <div>
                     <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', margin: '0 0 4px' }}>Vị trí ghế</p>
                     <p style={{ margin: 0, color: '#e50914', fontSize: 13, fontWeight: 800 }}>{pass.seat_number}</p>
                   </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                   <div>
                     <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', margin: '0 0 2px' }}>Giá pass</p>
                     <p style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 900 }}>{pass.price.toLocaleString()}đ</p>
                   </div>
                   <button 
                     className="btn-primary-pele" 
                     disabled={buying === pass.id}
                     onClick={() => handleBuy(pass)}
                     style={{ padding: '10px 24px', borderRadius: 12 }}
                   >
                     {buying === pass.id ? 'Đang giao dịch...' : 'Mua ngay'}
                   </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .market-card:hover {
          transform: translateY(-8px);
          border-color: rgba(229, 9, 20, 0.4);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  )
}
