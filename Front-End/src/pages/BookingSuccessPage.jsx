import { Link, useLocation } from 'react-router-dom'

export default function BookingSuccessPage() {
  const loc = useLocation()
  void loc

  return (
    <main className="page-shell" style={{ textAlign: 'center', paddingTop: 48 }}>
      <i className="fa-solid fa-circle-check" style={{ fontSize: 64, color: '#5ce08a' }} />
      <h1>Đặt vé thành công</h1>
      <Link to="/my-tickets" className="btn-primary-pele" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
        Xem vé của tôi
      </Link>
      <div style={{ marginTop: 16 }}>
        <Link to="/">Về trang chủ</Link>
      </div>
    </main>
  )
}
