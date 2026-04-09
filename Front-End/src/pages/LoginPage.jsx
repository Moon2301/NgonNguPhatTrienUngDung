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
    <main className="page-shell" style={{ maxWidth: 440 }}>
      <h1>Đăng nhập</h1>
      <form className="form-pele card-pele" onSubmit={onSubmit} noValidate>
        {err && <p style={{ color: '#ff6b6b' }}>{err}</p>}
        <label>Tên đăng nhập</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        <label>Mật khẩu</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button type="submit" className="btn-primary-pele" disabled={loading}>
          {loading ? '...' : 'Đăng nhập'}
        </button>
        <p className="muted small" style={{ marginTop: 12 }}>
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
      </form>
    </main>
  )
}
