import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="page-shell" style={{ textAlign: 'center', paddingTop: 80 }}>
      <h1>404</h1>
      <p className="muted">Không tìm thấy trang.</p>
      <Link to="/">Về trang chủ</Link>
    </main>
  )
}
