export function requireAuth(req, res, next) {
  if (req.session?.user) return next()
  return res.status(401).json({ error: 'Bạn cần đăng nhập.' })
}

export function requireAdmin(req, res, next) {
  const u = req.session?.user
  if (!u) return res.status(401).json({ error: 'Bạn cần đăng nhập.' })
  if (u.role !== 'ADMIN') return res.status(403).json({ error: 'Bạn không có quyền.' })
  return next()
}

