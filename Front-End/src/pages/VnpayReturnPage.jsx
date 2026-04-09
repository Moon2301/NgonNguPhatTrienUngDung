import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'

export default function VnpayReturnPage() {
  const loc = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Đang xác minh thanh toán...')

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
            setStatus('Nạp ví thành công.')
            navigate('/', { replace: true })
            return
          }
          setStatus('Thanh toán thành công.')
          navigate('/booking/success', { state: { bookingId: d.bookingId }, replace: true })
        } else {
          setStatus(`Thanh toán thất bại (mã: ${d.responseCode || 'N/A'}).`)
        }
      })
      .catch((e) => {
        setStatus(e.message || 'Xác minh thanh toán thất bại.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="page-shell" style={{ maxWidth: 560 }}>
      <h1>Kết quả thanh toán</h1>
      <p className="muted">{status}</p>
      <div style={{ marginTop: 12 }}>
        <Link to="/" className="btn-ghost" style={{ textDecoration: 'none' }}>
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}

