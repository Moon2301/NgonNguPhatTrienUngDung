import { Link, useLocation } from 'react-router-dom'

function pickMessage(code) {
  if (code === '401') return 'Bạn cần đăng nhập để truy cập trang này.'
  if (code === '403') return 'Bạn không có quyền truy cập trang này.'
  if (code === '404') return 'Không tìm thấy trang.'
  return 'Có lỗi xảy ra.'
}

export default function ErrorPage() {
  const loc = useLocation()
  const sp = new URLSearchParams(loc.search)
  const code = String(sp.get('code') || '').trim() || '400'
  const from = sp.get('from') ? decodeURIComponent(sp.get('from')) : ''
  const msg = sp.get('message') ? String(sp.get('message')) : pickMessage(code)

  return (
    <main className="page-shell" style={{ textAlign: 'center', paddingTop: 80 }}>
      <h1>{code}</h1>
      <p className="muted">{msg}</p>
      {from && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Trang yêu cầu: <code>{from}</code>
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        {code === '401' && (
          <Link className="btn-primary-pele" style={{ textDecoration: 'none' }} to={`/login`}>
            Đi tới đăng nhập
          </Link>
        )}
        <Link className="btn-ghost" style={{ textDecoration: 'none' }} to="/">
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}

