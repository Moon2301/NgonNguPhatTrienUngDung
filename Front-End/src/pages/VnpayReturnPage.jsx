import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'
import { useAuth } from '../context/useAuth.js'
import { useUi } from '../context/useUi.js'

export default function VnpayReturnPage() {
  const loc = useLocation()
  const navigate = useNavigate()
  const ui = useUi()
  const { refresh } = useAuth()

  useEffect(() => {
    const qs = loc.search || ''
    fetch(`${API_BASE}/api/payments/vnpay/return${qs}`, { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'Xác minh thanh toán thất bại.')
        return d
      })
      .then((d) => {
        if (d.success) {
          if (d.purpose === 'TOPUP') {
            ui.toast.success('Nạp ví thành công.')
            const sp = new URLSearchParams(loc.search || '')
            const next = sp.get('next')
            const buyPassId = sp.get('buyPassId')

            Promise.resolve(refresh())
              .catch(() => {})
              .finally(async () => {
                if (buyPassId) {
                  try {
                    const res = await fetch(`${API_BASE}/api/ticket-passes/${encodeURIComponent(buyPassId)}/buy`, {
                      method: 'POST',
                      credentials: 'include',
                    })
                    const x = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(x.error || 'Mua pass thất bại.')
                    ui.toast.success('Mua pass thành công.')
                    await Promise.resolve(refresh()).catch(() => {})
                    navigate('/my-tickets', { replace: true })
                    return
                  } catch (e) {
                    ui.toast.error(e.message)
                    navigate(next || '/ticket-market', { replace: true })
                    return
                  }
                }
                navigate(next || '/', { replace: true })
              })
            return
          }
          ui.toast.success('Thanh toán thành công.')
          navigate('/booking/success', { state: { bookingId: d.bookingId }, replace: true })
        } else {
          if (d.responseCode === 'PROMO_LIMIT') {
            ui.toast.error('Thanh toán thành công, nhưng mã khuyến mãi đã hết lượt nên hệ thống hủy đơn.')
          } else if (d.responseCode) {
            ui.toast.error(`Thanh toán thất bại (${String(d.responseCode)}).`)
          } else {
            ui.toast.error('Thanh toán thất bại.')
          }
        }
      })
      .catch((e) => {
        ui.toast.error(e.message || 'Xác minh thanh toán thất bại.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="page-shell" style={{ textAlign: 'center', paddingTop: 48 }}>
      <h1>Đang xử lý thanh toán...</h1>
      <p className="muted">Vui lòng đợi trong giây lát.</p>
      <div style={{ marginTop: 16 }}>
        <Link to="/">Về trang chủ</Link>
      </div>
    </main>
  )
}

