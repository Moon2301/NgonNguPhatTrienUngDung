import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'

export default function AdminUsers() {
  const [users, setUsers] = useState([])

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
    } catch (e) {
      alert(e.message)
    }
  }

  async function toggleBlock(u) {
    try {
      await apiPost(`/api/admin/users/${u.id}`, { isBlocked: !u.is_blocked })
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  async function del(u) {
    if (!confirm(`Xóa user ${u.username}?`)) return
    const res = await fetch(`${API_BASE}/api/admin/users/${u.id}`, { method: 'DELETE', credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return alert(data.error || 'Xóa thất bại')
    load()
  }

  return (
    <main className="page-shell">
      <Link to="/admin" className="back-link">
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
                <button type="button" className="btn-ghost" onClick={() => del(u)}>
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

