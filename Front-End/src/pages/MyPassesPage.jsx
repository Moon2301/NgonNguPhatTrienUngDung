import { useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { Link } from 'react-router-dom'

export default function MyPassesPage() {
  const [myPasses, setMyPasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/ticket-passes/me`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        setMyPasses(data.passes || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCancel = async (id) => {
    if (!window.confirm('Bạn có chắc muốn ngừng rao bán vé này?')) return
    try {
      const res = await fetch(`${API_BASE}/api/ticket-passes/${id}/cancel`, { 
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        setMyPasses(myPasses.map(p => p.id === id ? { ...p, status: 'CANCELLED' } : p))
      }
    } catch (err) {
       alert('Lỗi khi hủy rao bán')
    }
  }

  if (loading) return <div className="container-pele" style={{ textAlign: 'center', padding: 100 }}><div className="loader-pele"></div></div>

  return (
    <div className="container-pele anim-fade-in" style={{ padding: '40px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Quản Lý Rao Bán</h1>
          <p className="muted">Theo dõi các vé bạn đang rao bán trên thị trường.</p>
        </div>
        <Link to="/market" className="btn-primary-pele" style={{ textDecoration: 'none', padding: '12px 24px', borderRadius: 12 }}>
           <i className="fa-solid fa-shop" style={{ marginRight: 8 }}></i> Ghé Chợ Vé
        </Link>
      </div>

      <div className="pele-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
              <th style={{ padding: '20px 24px', color: '#555', fontSize: 12, textTransform: 'uppercase' }}>Phim & Suất chiếu</th>
              <th style={{ padding: '20px 24px', color: '#555', fontSize: 12, textTransform: 'uppercase' }}>Ghế</th>
              <th style={{ padding: '20px 24px', color: '#555', fontSize: 12, textTransform: 'uppercase' }}>Giá Pass</th>
              <th style={{ padding: '20px 24px', color: '#555', fontSize: 12, textTransform: 'uppercase' }}>Trạng thái</th>
              <th style={{ padding: '20px 24px', color: '#555', fontSize: 12, textTransform: 'uppercase' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {myPasses.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: 60, textAlign: 'center', color: '#444' }}>Bạn chưa có yêu cầu rao bán nào.</td></tr>
            ) : (
              myPasses.map(pass => (
                <tr key={pass.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <img src={pass.posterUrl} style={{ width: 40, height: 60, borderRadius: 8, objectFit: 'cover' }} alt="" />
                      <div>
                        <p style={{ margin: 0, color: '#fff', fontWeight: 700 }}>{pass.movieTitle}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#555' }}>
                          {new Date(pass.start_time).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '20px 24px', color: '#e50914', fontWeight: 800 }}>{pass.seat_number}</td>
                  <td style={{ padding: '20px 24px', color: '#fff', fontWeight: 700 }}>{pass.price.toLocaleString()}đ</td>
                  <td style={{ padding: '20px 24px' }}>
                    <span style={{ 
                      padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: pass.status === 'AVAILABLE' ? '#1b5e20' : pass.status === 'SOLD' ? '#e50914' : '#333',
                      color: '#fff'
                    }}>
                      {pass.status === 'AVAILABLE' ? 'ĐANG RAO' : pass.status === 'SOLD' ? 'ĐÃ BÁN' : 'ĐÃ HỦY'}
                    </span>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    {pass.status === 'AVAILABLE' && (
                      <button 
                        onClick={() => handleCancel(pass.id)}
                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseOver={(e) => e.target.style.color = '#e50914'}
                        onMouseOut={(e) => e.target.style.color = '#555'}
                      >
                        Hủy rao bán
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
