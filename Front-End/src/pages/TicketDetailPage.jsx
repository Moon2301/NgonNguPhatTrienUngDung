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

  useEffect(() => {
    fetch(`${API_BASE}/api/ticket-passes/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPass(d.pass))
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
          message: `Bạn cần nạp thêm ${need.toLocaleString('vi-VN')}đ để mua pass. Nạp VNPay ngay?`,
          confirmText: 'Nạp ngay',
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
      } else ui.toast.error(d.error || 'Lỗi.')
      return
    }
    else {
      ui.toast.success('Mua vé thành công.')
      refresh()
      navigate('/my-tickets')
    }
  }

  if (!pass) return <main className="page-shell"><p>Đang tải...</p></main>

  return (
    <main className="page-shell">
      <Link to="/ticket-market" className="back-link">
        ← Chợ vé
      </Link>
      <h1>Pass vé</h1>
      <div className="card-pele" style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ marginTop: 0 }}>
            <strong>{pass.movieTitle}</strong>
          </p>
          <p>Ghế: {pass.seat_number || '—'}</p>
          <p>Suất chiếu: {fmtDateTime(pass.start_time)}</p>
          <p>Giá pass: {Number(pass.pass_price).toLocaleString('vi-VN')}đ</p>
          <p>Trạng thái: {statusLabel(pass.status)}</p>
        </div>
        <div
          style={{
            width: 160,
            borderRadius: 14,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.06)',
            flex: '0 0 auto',
          }}
        >
          {pass.posterUrl ? (
            <img src={pass.posterUrl} alt={pass.movieTitle || 'poster'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.45)', fontWeight: 900 }}>
              POSTER
            </div>
          )}
        </div>
      </div>
      {pass.status === 'AVAILABLE' && (
        <button type="button" className="btn-primary-pele" onClick={buy}>
          Mua
        </button>
      )}
    </main>
  )
}
