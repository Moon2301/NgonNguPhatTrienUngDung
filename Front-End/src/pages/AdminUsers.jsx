import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import { useUi } from '../context/useUi.js'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const ui = useUi()

  function load() {
    fetch(`${API_BASE}/api/admin/users`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
  }

  useEffect(() => {
    load()
  }, [])

  async function setRole(id, role) {
    try {
      await apiPost(`/api/admin/users/${id}`, { role })
      load()
      ui.toast.success('Đã cập nhật quyền.')
    } catch (e) {
      ui.toast.error(e.message)
    }
  }

  async function toggleBlock(u) {
    try {
      await apiPost(`/api/admin/users/${u.id}`, { isBlocked: !u.is_blocked })
      load()
      ui.toast.success(u.is_blocked ? 'Đã mở khóa người dùng.' : 'Đã khóa người dùng.')
    } catch (e) {
      ui.toast.error(e.message)
    }
  }

  async function del(u) {
    const ok = await ui.confirm({
      title: 'Xóa người dùng',
      message: `Xóa user ${u.username}?`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
    })
    if (!ok) return
    const res = await fetch(`${API_BASE}/api/admin/users/${u.id}`, { method: 'DELETE', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return ui.toast.error(data.error || 'Xóa thất bại')
    load()
    ui.toast.success('Đã xóa người dùng.')
  }

  return (
    <main className="page-shell">
      <Link to="/admin" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        ← Dashboard
      </Link>
      <h1>Quản lý người dùng</h1>

      <table className="table-pele">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Họ tên</th>
            <th>Ví</th>
            <th>Role</th>
            <th>Khóa</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.fullName || '—'}</td>
              <td style={{ fontWeight: 800 }}>
                {Number(u.wallet || 0).toLocaleString('vi-VN')}đ
              </td>
              <td>
                <select value={u.role || 'USER'} onChange={(e) => setRole(u.id, e.target.value)}>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </td>
              <td>
                <button type="button" className="btn-ghost" onClick={() => toggleBlock(u)}>
                  {u.is_blocked ? 'Mở khóa' : 'Khóa'}
                </button>
              </td>
              <td>
                <button type="button" className="btn-danger" onClick={() => del(u)}>
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

