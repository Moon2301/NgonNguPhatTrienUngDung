import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiPost } from '../api'
import { useUi } from '../context/useUi.js'

export default function AdminBookings() {
  const [bookings, setBookings] = useState([])
  const [topups, setTopups] = useState([])
  const ui = useUi()

  function load() {
    fetch(`${API_BASE}/api/admin/bookings`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []))
    fetch(`${API_BASE}/api/admin/wallet-topups`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setTopups(d.topups || []))
  }

  useEffect(() => {
    load()
  }, [])

  async function setStatus(id, status) {
    try {
      await apiPost(`/api/admin/bookings/${id}/status`, { status })
      load()
      ui.toast.success('Đã cập nhật trạng thái.')
    } catch (er) {
      ui.toast.error(er.message)
    }
  }

  return (
    <main className="page-shell">
      <Link to="/admin" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        ← Dashboard
      </Link>
      <h1>Quản lý hóa đơn</h1>
      <table className="table-pele">
        <thead>
          <tr>
            <th>Loại</th>
            <th>Đặt lúc</th>
            <th>Khách</th>
            <th>Phim</th>
            <th>Tiền</th>
            <th>PTTT</th>
            <th>TT</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const cancelled = b.status === 'CANCELLED'
            const bt = b.booking_time ? new Date(b.booking_time) : null
            const timeStr = bt && !Number.isNaN(bt.getTime()) ? bt.toLocaleString('vi-VN') : '—'
            return (
              <tr key={b.id}>
                <td style={{ fontWeight: 800 }}>{b.booking_type || 'TICKET'}</td>
                <td>{timeStr}</td>
                <td>{b.customer_name}</td>
                <td>{b.movieTitle}</td>
                <td>{Number(b.total_amount).toLocaleString('vi-VN')}</td>
                <td>{b.payment_method || '—'}</td>
                <td>
                  {cancelled ? (
                    <span className="muted">CANCELLED</span>
                  ) : (
                    <select value={b.status || 'SUCCESS'} onChange={(e) => setStatus(b.id, e.target.value)}>
                      <option value="SUCCESS">SUCCESS</option>
                      <option value="CANCELLED">CANCELLED</option>
                      <option value="PENDING">PENDING</option>
                      <option value="FAILED">FAILED</option>
                    </select>
                  )}
                </td>
                <td>
                  <Link 
                    to={`/ticket/view/${b.id}`} 
                    className="btn-primary-pele" 
                    style={{ padding: '4px 12px', fontSize: 11, borderRadius: 8, whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}
                  >
                    <i className="fa-solid fa-check-double" style={{ marginRight: 4 }}></i>
                    Soát vé
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="card-pele" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Nạp ví (VNPay)</h3>
        {!topups.length ? (
          <p className="muted">Chưa có giao dịch nạp ví.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-pele">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>User</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {topups.map((p) => {
                  const t = p.created_at ? new Date(p.created_at) : null
                  const timeStr2 = t && !Number.isNaN(t.getTime()) ? t.toLocaleString('vi-VN') : '—'
                  const uname = p.user?.fullName || p.user?.username || p.user?.email || '—'
                  return (
                    <tr key={p.id}>
                      <td>{timeStr2}</td>
                      <td>{uname}</td>
                      <td>{Number(p.amount || 0).toLocaleString('vi-VN')}đ</td>
                      <td>{p.status || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
