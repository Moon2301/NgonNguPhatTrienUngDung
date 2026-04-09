import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { useUi } from '../context/useUi.js'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const ui = useUi()
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    fullName: '',
    phone: '',
  })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!String(form.username || '').trim()) return setErr('Vui lòng nhập tên đăng nhập.')
    if (!String(form.password || '').trim()) return setErr('Vui lòng nhập mật khẩu.')
    if (!String(form.email || '').trim()) return setErr('Vui lòng nhập email.')
    if (!String(form.fullName || '').trim()) return setErr('Vui lòng nhập họ tên.')
    setLoading(true)
    try {
      await register(form)
      ui.toast.success('Đăng ký tài khoản thành công!')
      navigate('/')
    } catch (er) {
      setErr(er.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '40px 20px' }}>
      <div className="card-pele" style={{ width: '100%', maxWidth: 480, padding: '40px 30px', borderRadius: 32, boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900 }}>Tạo tài khoản</h1>
            <p className="muted small">Tham gia cộng đồng PELE Cinema để nhận nhiều ưu đãi hấp dẫn.</p>
        </div>

        <form className="form-pele" onSubmit={onSubmit} noValidate>
          {err && <div style={{ background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b', padding: '12px', borderRadius: 12, marginBottom: 20, fontSize: 13, border: '1px solid rgba(255, 107, 107, 0.2)' }}><i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }}></i>{err}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 10, textTransform: 'uppercase', color: '#555', letterSpacing: 1 }}>Tên đăng nhập</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="abc_xyz" style={{ borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 10, textTransform: 'uppercase', color: '#555', letterSpacing: 1 }}>Mật khẩu</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={{ borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
              </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 10, textTransform: 'uppercase', color: '#555', letterSpacing: 1 }}>Họ và tên</label>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nguyễn Văn A" style={{ borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 10, textTransform: 'uppercase', color: '#555', letterSpacing: 1 }}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="example@gmail.com" style={{ borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 10, textTransform: 'uppercase', color: '#555', letterSpacing: 1 }}>Số điện thoại</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxx" style={{ borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
          </div>

          <button type="submit" className="btn-primary-pele" disabled={loading} style={{ width: '100%', height: 52, fontSize: 16 }}>
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Đăng ký tài khoản'}
          </button>
          
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <p className="muted small">
              Đã có tài khoản? <Link to="/login" style={{ color: '#e50914', fontWeight: 800, textDecoration: 'none' }}>Đăng nhập</Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}
