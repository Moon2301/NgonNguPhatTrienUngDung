import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE } from '../api'
import { useAuth } from '../context/useAuth.js'
import { useUi } from '../context/useUi.js'

export default function CheckoutPage() {
    const loc = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const ui = useUi()
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

    const { showtimeId, seats, totalAmount, seatSocketId } = state
    const products = Array.isArray(state?.products) ? state.products : []
    const productsAmount = Number(state?.productsAmount || 0)

    useEffect(() => {
        if (!user) return
        if (!customerName) setCustomerName(user.fullName || user.username || '')
        if (!customerEmail) setCustomerEmail(user.email || '')
        if (!customerPhone) setCustomerPhone(user.phone || '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

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
                ui.toast.success('Đã áp dụng khuyến mãi.')
            } else ui.toast.warn(d.message || 'Không áp dụng được.')
        } catch {
            ui.toast.error('Lỗi áp mã.')
        }
    }

    async function confirm(e) {
        e.preventDefault()
        if (!String(customerName || '').trim()) return ui.toast.warn('Vui lòng nhập họ tên.')
        if (!String(customerEmail || '').trim()) return ui.toast.warn('Vui lòng nhập email.')
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/api/bookings/confirm`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    showtimeId,
                    seats: seats.join(','),
                    seatSocketId: seatSocketId || undefined,
                    customerName,
                    customerEmail,
                    customerPhone: customerPhone || undefined,
                    products,
                    promoCode: promoCode.trim() || undefined,
                    paymentMethod: 'VNPAY',
                    returnUrl: `${window.location.origin}/payment/vnpay-return`,
                }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || 'Lỗi')
            if (d.paymentUrl) {
                window.location.href = d.paymentUrl
                return
            }
            navigate('/booking/success', { state: { bookingId: d.bookingId }, replace: true })
        } catch (er) {
            ui.toast.error(er.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="page-shell" style={{ maxWidth: 520, margin: '0 auto' }}>
            <div style={{ marginBottom: 24, textAlign: 'left' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: '#e50914', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <i className="fa-solid fa-chevron-left"></i> Quay lại
                </button>
            </div>

            <h1 style={{ marginTop: 0 }}>Thanh toán</h1>
            <p className="muted" style={{ fontSize: 13 }}>Ghế: {seats.join(', ')}</p>

            <div className="card-pele" style={{ padding: 16, background: 'rgba(255,255,255,0.02)', marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Chi tiết thanh toán</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                    <span>Giá vé ({seats.length} ghế)</span>
                    <span>{(totalAmount - productsAmount).toLocaleString()}đ</span>
                </div>
                {productsAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                        <span>Dịch vụ kèm theo</span>
                        <span>{productsAmount.toLocaleString()}đ</span>
                    </div>
                )}
                <div style={{ borderTop: '1px solid #333', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <span>Tạm tính</span>
                    <span>{totalAmount.toLocaleString()}đ</span>
                </div>
                {discountText && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', color: '#4caf50' }}>
                        <span>Khuyến mãi</span>
                        <span>-{discountText}</span>
                    </div>
                )}
            </div>

            <div style={{ textAlign: 'right', marginBottom: 32 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Tổng số tiền cần thanh toán</p>
                <p style={{ margin: 0, fontWeight: 900, fontSize: '1.8rem', color: '#e50914' }}>{finalAmount.toLocaleString('vi-VN')}đ</p>
            </div>

            <div className="card-pele" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                <input
                    placeholder="Mã khuyến mãi"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 12, border: '1px solid #444', background: '#1a1a1f', color: '#fff' }}
                />
                <button type="button" className="btn-ghost" onClick={applyPromo} style={{ borderRadius: 12 }}>
                    Áp dụng
                </button>
            </div>

            <form className="form-pele card-pele" onSubmit={confirm} style={{ padding: 24 }}>
                <label>Họ tên</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                <label>Email</label>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
                <label>Số điện thoại</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />

                <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8 }}>Phương thức thanh toán</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e50914', background: 'rgba(229, 9, 20, 0.1)', cursor: 'default' }}>
                            <i className="fa-solid fa-credit-card" style={{ marginRight: 8 }}></i>
                            Thanh toán VNPAY
                        </div>
                    </div>
                </div>

                <button type="submit" className="btn-primary-pele" disabled={loading} style={{ height: 52, fontSize: '1rem', marginTop: 10 }}>
                    {loading ? 'Đang xử lý...' : 'Xác nhận đặt vé'}
                </button>
            </form>
        </main>
    )
}
