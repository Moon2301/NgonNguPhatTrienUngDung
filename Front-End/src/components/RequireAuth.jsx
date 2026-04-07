import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="page-shell muted">Đang kiểm tra đăng nhập...</div>
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />
  return children
}

export function RequireAdmin({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="page-shell muted">Đang kiểm tra...</div>
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />
  return children
}
