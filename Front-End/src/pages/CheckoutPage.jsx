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

    const { showtimeId, seats, totalAmount, products } = state

    async function applyPromo() {
        try {
            const res = await fetch(`${API_BASE}/api/bookings/apply-promo`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: promoCode,
                    amount: totalAmount,
                    showtimeId,
                }),
            })
            const d = await res.json()
            if (res.ok) {
                const discount = Number(d.discountValue || 0)
                setFinalAmount(Math.max(0, totalAmount - discount))
                setDiscountText(`Giảm ${discount.toLocaleString()}đ`)
            } else alert(d.error || 'Không áp dụng được')
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
                    seats, // Array
                    customerName,
                    customerEmail,
                    customerPhone: customerPhone || undefined,
                    promoCode: discountText ? promoCode : undefined,
                    products: products || [],
                    paymentMethod: 'CASH', // Mocking CASH for now
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
                {discountText && <span style={{ color: '#4caf50', marginLeft: 8 }}>({discountText})</span>}
            </p>
            <p style={{ fontWeight: 800, fontSize: '1.2rem' }}>Thành tiền: {finalAmount.toLocaleString('vi-VN')}đ</p>

            <div className="card-pele" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
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

            <form className="form-pele card-pele" onSubmit={confirm}>
                <label>Họ tên</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                <label>Email</label>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
                <label>Số điện thoại</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                
                <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>Phương thức thanh toán</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e50914', background: 'rgba(229, 9, 20, 0.1)', cursor: 'default' }}>
                            <i className="fa-solid fa-money-bill-1-wave" style={{ marginRight: 8 }}></i>
                            Tiền mặt (tại quầy)
                        </div>
                        <div style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #444', opacity: 0.5, cursor: 'not-allowed' }}>
                            <i className="fa-solid fa-credit-card" style={{ marginRight: 8 }}></i>
                            VNPAY (Sắp có)
                        </div>
                    </div>
                </div>

                <button type="submit" className="btn-primary-pele" disabled={loading} style={{ height: 50, fontSize: '1rem' }}>
                    {loading ? 'Đang xử lý...' : 'Xác nhận đặt vé'}
                </button>
            </form>
        </main>
    )
}

