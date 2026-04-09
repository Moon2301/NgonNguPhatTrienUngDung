import { Link, useLocation } from 'react-router-dom'

export default function SuccessPage() {
  const { state } = useLocation()
  const bookingId = state?.bookingId

  return (
    <main className="page-shell" style={{ textAlign: 'center', paddingTop: '10vh' }}>
      <div className="card-pele" style={{ maxWidth: 400, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ fontSize: '4rem', color: '#4caf50', marginBottom: 20 }}>
          <i className="fa-solid fa-circle-check"></i>
        </div>
        <h1 style={{ marginBottom: 10 }}>Đặt vé thành công!</h1>
        <p className="muted" style={{ marginBottom: 30 }}>
          Cảm ơn bạn đã lựa chọn PELE Cinema. Mã đặt vé của bạn là:
          <br />
          <strong style={{ color: '#fff', fontSize: '1.2rem' }}>#{bookingId || 'N/A'}</strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/" className="btn-primary-pele">
            Quay lại trang chủ
          </Link>
          <Link to="/me" className="btn-ghost">
            Xem lịch sử đặt vé
          </Link>
        </div>
      </div>
    </main>
  )
}
