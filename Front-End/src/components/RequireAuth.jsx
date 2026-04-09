import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="page-shell muted">Đang kiểm tra đăng nhập...</div>
  if (!user) {
    const from = encodeURIComponent(loc.pathname + (loc.search || ''))
    return <Navigate to={`/error?code=401&from=${from}`} replace />
  }
  return children
}

export function RequireAdmin({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="page-shell muted">Đang kiểm tra...</div>
  if (!user) {
    const from = encodeURIComponent(loc.pathname + (loc.search || ''))
    return <Navigate to={`/error?code=401&from=${from}`} replace />
  }
  if (user.role !== 'ADMIN') {
    const from = encodeURIComponent(loc.pathname + (loc.search || ''))
    return <Navigate to={`/error?code=403&from=${from}`} replace />
  }
  return children
}
