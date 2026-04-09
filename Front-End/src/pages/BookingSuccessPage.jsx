import { Link, useLocation } from 'react-router-dom'

export default function BookingSuccessPage() {
  const { state } = useLocation()
  const bookingId = state?.bookingId

  return (
    <main className="page-shell" style={{ textAlign: 'center', paddingTop: '10vh' }}>
      <div className="card-pele" style={{ maxWidth: 420, margin: '0 auto', padding: '50px 30px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', borderRadius: 32 }}>
        <div style={{ fontSize: '5rem', color: '#4caf50', marginBottom: 24, filter: 'drop-shadow(0 0 20px rgba(76, 175, 80, 0.3))' }}>
          <i className="fa-solid fa-circle-check"></i>
        </div>
        <h1 style={{ marginBottom: 10, fontWeight: 900 }}>Đặt vé thành công!</h1>
        <p className="muted" style={{ marginBottom: 30, fontSize: 15, lineHeight: 1.5 }}>
          Cảm ơn bạn đã lựa chọn PELE Cinema. Mã đặt vé của bạn là:
          <br />
          <strong style={{ color: '#fff', fontSize: '1.4rem', letterSpacing: 1 }}>#{bookingId || 'N/A'}</strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Link to="/my-tickets" className="btn-primary-pele" style={{ padding: '14px', borderRadius: 16, fontSize: 16 }}>
            Xem vé của tôi
          </Link>
          <Link to="/" className="btn-ghost" style={{ padding: '14px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    </main>
  )
}
