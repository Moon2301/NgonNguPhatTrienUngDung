import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useUi } from '../context/useUi.js'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const from = loc.state?.from?.pathname || '/'
  const ui = useUi()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!String(username || '').trim()) return setErr('Vui lòng nhập tên đăng nhập.')
    if (!String(password || '').trim()) return setErr('Vui lòng nhập mật khẩu.')
    setLoading(true)
    try {
      await login(username, password)
      ui.toast.success('Đăng nhập thành công.')
      navigate(from, { replace: true })
    } catch (er) {
      setErr(er.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="card-pele" style={{ width: '100%', maxWidth: 400, padding: '40px 30px', borderRadius: 32, boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ width: 64, height: 64, background: '#e50914', borderRadius: 16, display: 'grid', placeItems: 'center', margin: '0 auto 20px', fontSize: 28, color: '#fff' }}>
                <i className="fa-solid fa-film"></i>
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 900 }}>Chào mừng!</h1>
            <p className="muted">Đăng nhập để đặt vé và nhận ưu đãi từ PELE.</p>
        </div>

        <form className="form-pele" onSubmit={onSubmit} noValidate>
          {err && <div style={{ background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b', padding: '12px', borderRadius: 12, marginBottom: 20, fontSize: 13, border: '1px solid rgba(255, 107, 107, 0.2)' }}><i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }}></i>{err}</div>}
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 11, textTransform: 'uppercase', color: '#555', letterSpacing: 1 }}>Tên đăng nhập</label>
            <input 
              value={username} onChange={(e) => setUsername(e.target.value)} 
              autoComplete="username" 
              placeholder="username hoặc email"
              style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.03)' }}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 11, textTransform: 'uppercase', color: '#555', letterSpacing: 1 }}>Mật khẩu</label>
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} 
              autoComplete="current-password" 
              placeholder="••••••••"
              style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.03)' }}
            />
          </div>

          <button type="submit" className="btn-primary-pele" disabled={loading} style={{ width: '100%', height: 52, fontSize: 16 }}>
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Đăng nhập'}
          </button>
          
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <p className="muted small">
              Chưa có tài khoản? <Link to="/register" style={{ color: '#e50914', fontWeight: 800, textDecoration: 'none' }}>Đăng ký ngay</Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}
