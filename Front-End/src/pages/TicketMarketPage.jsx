import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function TicketMarketPage() {
  const [passes, setPasses] = useState([])
  const [kw, setKw] = useState('')
  const [loading, setLoading] = useState(true)

  function load() {
    const q = kw.trim() ? `?keyword=${encodeURIComponent(kw.trim())}` : ''
    fetch(`${API_BASE}/api/ticket-passes${q}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
          setPasses(d.passes || [])
          setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="page-shell" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Chợ Vé Chuyển Nhượng</h1>
        <p className="muted">Săn vé giá tốt hoặc tìm suất chiếu đã cháy vé từ cộng đồng người dùng PELE.</p>
      </header>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <input
              className="search-input"
              style={{ width: '100%', paddingLeft: 44 }}
              placeholder="Tìm phim, số ghế..."
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#555' }}></i>
        </div>
        <button type="button" className="btn-primary-pele" onClick={load} style={{ padding: '0 24px' }}>
          Tìm kiếm
        </button>
        <Link to="/ticket/post" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 12 }}>
          <i className="fa-solid fa-plus"></i> Đăng bán
        </Link>
      </div>

      {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}><p className="muted">Đang tìm vé...</p></div>
      ) : passes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '100px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 32, border: '1px dashed rgba(255,255,255,0.1)' }}>
           <i className="fa-solid fa-ticket-simple" style={{ fontSize: 48, color: '#333', marginBottom: 20 }}></i>
           <p className="muted">Hiện tại chưa có vé nào được rao bán phù hợp.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
          {passes.map(pass => (
            <Link key={pass.id} to={`/ticket/${pass.id}`} className="market-card-link" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="market-card" style={{ 
                  background: '#111', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.3s ease', height: '100%', display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ height: 160, position: 'relative' }}>
                    <img src={pass.posterUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} alt="" />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #111, transparent)' }}></div>
                    <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
                       <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#e50914', fontWeight: 900, letterSpacing: 1, marginBottom: 4 }}>Pass Ticket</div>
                       <h3 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pass.movieTitle}</h3>
                    </div>
                  </div>

                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                       <div>
                         <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', margin: '0 0 4px', letterSpacing: 1 }}>Thời gian</p>
                         <p style={{ margin: 0, color: '#eee', fontSize: 13, fontWeight: 600 }}>{new Date(pass.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(pass.start_time).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</p>
                       </div>
                       <div>
                         <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', margin: '0 0 4px', letterSpacing: 1 }}>Vị trí ghế</p>
                         <p style={{ margin: 0, color: '#e50914', fontSize: 13, fontWeight: 800 }}>{pass.seat_number}</p>
                       </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
                       <div>
                         <p style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', margin: '0 0 2px', letterSpacing: 1 }}>Giá pass</p>
                         <p style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 900 }}>{Number(pass.pass_price).toLocaleString()}đ</p>
                       </div>
                       <button 
                         className="btn-primary-pele" 
                         style={{ padding: '8px 20px', borderRadius: 12, fontSize: 13 }}
                       >
                         Chi tiết
                       </button>
                    </div>
                  </div>
                </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .market-card-link:hover .market-card {
          transform: translateY(-8px);
          border-color: rgba(229, 9, 20, 0.4);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
      `}</style>
    </main>
  )
}
