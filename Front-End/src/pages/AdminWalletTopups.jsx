import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'

export default function AdminWalletTopups() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetch(`${API_BASE}/api/admin/wallet-topups`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRows(d.topups || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="page-shell">
      <Link
        to="/admin"
        className="admin-back btn-ghost"
        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}
      >
        ← Dashboard
      </Link>
      <h1 style={{ marginTop: 8 }}>Lịch sử nạp ví (VNPay)</h1>

      <div className="card-pele" style={{ marginTop: 12 }}>
        <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Đang tải...' : 'Tải lại'}
        </button>
      </div>

      <table className="table-pele" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>User</th>
            <th>Số tiền</th>
            <th>Trạng thái</th>
            <th>Mã giao dịch</th>
            <th>Mã VNPay</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <td>{x.created_at ? String(x.created_at).replace('T', ' ').slice(0, 19) : '—'}</td>
              <td>
                {(x.user?.username || x.user?.email || '—')}
                {x.user?.fullName ? ` (${x.user.fullName})` : ''}
              </td>
              <td style={{ fontWeight: 800 }}>{Number(x.amount || 0).toLocaleString('vi-VN')}đ</td>
              <td>{x.status || '—'}</td>
              <td style={{ fontFamily: 'monospace' }}>{x.txn_ref || '—'}</td>
              <td style={{ fontFamily: 'monospace' }}>{x.vnp_response_code || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!loading && !rows.length && <p className="muted">Chưa có lịch sử nạp ví.</p>}
    </main>
  )
}

