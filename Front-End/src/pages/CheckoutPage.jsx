import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'

export default function CheckoutPage() {
  const loc = useLocation()
  const navigate = useNavigate()
  const state = loc.state
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [finalAmount, setFinalAmount] = useState(state?.totalAmount ?? 0)
  const [discountText, setDiscountText] = useState('')
  const [loading, setLoading] = useState(false)

  if (!state?.showtimeId || !state?.seats?.length) {
    return (
      <main className="page-shell">
        <p>Thiếu thông tin đặt vé.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    )
  }

  const { showtimeId, seats, totalAmount } = state

  async function applyPromo() {
    try {
      const res = await fetch(`${API_BASE}/api/bookings/apply-promo`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode,
          originalAmount: totalAmount,
          showtimeId,
        }),
      })
      const d = await res.json()
      if (d.success) {
        setFinalAmount(d.newTotal)
        setDiscountText(d.discountText || '')
      } else alert(d.message || 'Không áp dụng được')
    } catch {
      alert('Lỗi áp mã')
    }
  }

  async function confirm(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/bookings/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showtimeId,
          seats: seats.join(','),
          customerName,
          customerEmail,
          customerPhone: customerPhone || undefined,
          finalAmount,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Lỗi')
      navigate('/booking/success', { state: { bookingId: d.bookingId }, replace: true })
    } catch (er) {
      alert(er.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-shell" style={{ maxWidth: 520 }}>
      <h1>Thanh toán</h1>
      <p className="muted">Ghế: {seats.join(', ')}</p>
      <p>
        Tạm tính: {totalAmount.toLocaleString('vi-VN')}đ
        {discountText && ` · ${discountText}`}
      </p>
      <p style={{ fontWeight: 800 }}>Thành tiền: {finalAmount.toLocaleString('vi-VN')}đ</p>

      <div className="card-pele" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Mã khuyến mãi"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 8, border: '1px solid #444', background: '#1a1a1f', color: '#fff' }}
        />
        <button type="button" className="btn-ghost" onClick={applyPromo}>
          Áp dụng
        </button>
      </div>

      <form className="form-pele card-pele" onSubmit={confirm} style={{ marginTop: 16 }}>
        <label>Họ tên</label>
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <label>Email</label>
        <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
        <label>Số điện thoại</label>
        <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        <button type="submit" className="btn-primary-pele" disabled={loading}>
          {loading ? '...' : 'Xác nhận đặt vé'}
        </button>
      </form>
    </main>
  )
}
