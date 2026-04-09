import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_BASE } from '../api'
import { useAuth } from '../context/useAuth.js'
import { useUi } from '../context/useUi.js'

function fmtDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('vi-VN')
}

function statusLabel(s) {
  const v = String(s || '').toUpperCase()
  if (v === 'AVAILABLE') return 'Còn bán'
  if (v === 'LOCKED') return 'Đang được giữ'
  if (v === 'SOLD') return 'Đã bán'
  if (v === 'CANCELLED') return 'Đã hủy'
  return v || '—'
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const ui = useUi()
  const [pass, setPass] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/ticket-passes/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
          setPass(d.pass)
          setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  async function buy() {
    if (!user) {
      navigate('/login')
      return
    }
    const res = await fetch(`${API_BASE}/api/ticket-passes/${id}/buy`, { method: 'POST', credentials: 'include' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Không đủ ví → hỏi nạp VNPay
      if (d?.code === 'WALLET_NOT_ENOUGH') {
        const need = Number(d.need || 0)
        const ok = await ui.confirm({
          title: 'Ví không đủ tiền',
          message: `Bạn cần nạp thêm ${need.toLocaleString('vi-VN')}đ để mua pass này. Nạp VNPay ngay?`,
          confirmText: 'Tiền hành nạp',
          cancelText: 'Hủy',
        })
        if (!ok) return
        const r2 = await fetch(`${API_BASE}/api/payments/vnpay/topup/create`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.max(1000, need),
            orderInfo: `Nạp ví để mua pass`,
            returnUrl: `${window.location.origin}/payment/vnpay-return?buyPassId=${encodeURIComponent(String(id))}&next=${encodeURIComponent(
              `/ticket/${id}`,
            )}`,
          }),
        })
        const x = await r2.json().catch(() => ({}))
        if (!r2.ok) return ui.toast.error(x.error || 'Không tạo được thanh toán nạp ví.')
        if (x.url) window.location.href = x.url
        return
      }
      if (d?.code === 'PASS_NOT_AVAILABLE') {
        ui.toast.error(`Vé không khả dụng (${statusLabel(d.status)}).`)
      } else ui.toast.error(d.error || 'Lỗi hệ thống.')
      return
    }
    else {
      ui.toast.success('Mua vé thành công!')
      refresh()
      navigate('/my-tickets')
    }
  }

  if (loading) return <main className="page-shell"><p>Đang tải thông tin pass...</p></main>
  if (!pass) return <main className="page-shell"><p>Không tìm thấy vé này.</p><Link to="/ticket-market">Quay lại chợ vé</Link></main>

  return (
    <main className="page-shell" style={{ maxWidth: 450, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
          <Link to="/ticket-market" style={{ color: '#e50914', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            <i className="fa-solid fa-chevron-left" style={{ marginRight: 8 }}></i> Quay lại chợ vé
          </Link>
      </div>

      <div className="ticket-modal-inner" style={{ 
        background: '#111', borderRadius: 40, border: '1px solid rgba(255,255,255,0.05)', 
        overflow: 'hidden', position: 'relative', boxShadow: '0 50px 100px rgba(0,0,0,0.8)'
      }}>
        
        {/* Header Movie Poster */}
        <div style={{ height: 260, position: 'relative' }}>
          <img src={pass.posterUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} alt="" />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(to top, #111, transparent)' }}></div>
          
          <div style={{ position: 'absolute', bottom: 20, left: 30, right: 30 }}>
            <h2 style={{ fontSize: 24, margin: 0, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{pass.movieTitle}</h2>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>{pass.roomName} • Pass vé</p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px', marginBottom: 30 }}>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Ngày chiếu</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee', fontSize: 14 }}>{new Date(pass.start_time).toLocaleDateString('vi-VN')}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Giờ chiếu</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#e50914', fontSize: 20 }}>{new Date(pass.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Ghế</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#eee', fontSize: 18 }}>{pass.seat_number}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Giá pass</p>
              <p style={{ margin: 0, fontWeight: 800, color: '#fff', fontSize: 18 }}>{Number(pass.pass_price).toLocaleString()}đ</p>
            </div>
          </div>

          <div style={{ borderTop: '2px dashed #222', margin: '0 0 30px', position: 'relative' }}>
             <div style={{ position: 'absolute', top: -11, left: -42, width: 22, height: 22, background: '#000', borderRadius: '50%' }}></div>
             <div style={{ position: 'absolute', top: -11, right: -42, width: 22, height: 22, background: '#000', borderRadius: '50%' }}></div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Người rao bán</div>
            <div style={{ fontWeight: 700, color: '#fff' }}>{pass.seller_name || 'Người dùng PELE'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pass.status === 'AVAILABLE' ? (
                <button type="button" className="btn-primary-pele" style={{ padding: '16px', borderRadius: 16, fontSize: 16 }} onClick={buy}>
                  Xác nhận mua pass
                </button>
              ) : (
                <button disabled className="btn-ghost" style={{ padding: '16px', borderRadius: 16, opacity: 0.5 }}>
                  {statusLabel(pass.status)}
                </button>
              )}
          </div>
        </div>
      </div>
    </main>
  )
}
