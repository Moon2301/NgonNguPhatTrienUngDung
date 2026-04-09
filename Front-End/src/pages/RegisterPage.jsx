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
      ui.toast.success('Đăng ký thành công.')
      navigate('/')
    } catch (er) {
      setErr(er.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-shell" style={{ maxWidth: 480 }}>
      <h1>Đăng ký</h1>
      <p className="muted small" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Ràng buộc: tên đăng nhập 3–50 ký tự; mật khẩu 4–100 ký tự; email đúng định dạng; họ tên bắt buộc; số điện
        thoại tùy chọn (nếu nhập thì 3–30 ký tự).
      </p>
      <form className="form-pele card-pele" onSubmit={onSubmit} noValidate>
        {err && (
          <p className="form-error-msg" role="alert">
            {err}
          </p>
        )}
        <label>Tên đăng nhập</label>
        <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <label>Mật khẩu</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Họ tên</label>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <label>Số điện thoại</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button type="submit" className="btn-primary-pele" disabled={loading}>
          {loading ? '...' : 'Tạo tài khoản'}
        </button>
        <p className="muted small">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </form>
    </main>
  )
}
