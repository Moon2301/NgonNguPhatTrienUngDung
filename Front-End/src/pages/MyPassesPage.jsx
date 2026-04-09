import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'
import { useUi } from '../context/useUi.js'

function fmtDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('vi-VN')
}

export default function MyPassesPage() {
  const ui = useUi()
  const [passes, setPasses] = useState([])
  function load() {
    fetch(`${API_BASE}/api/ticket-passes/me/list`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPasses(d.passes || []))
  }
  useEffect(() => {
    load()
  }, [])

  async function cancelPass(p) {
    const ok = await ui.confirm({
      title: 'Huỷ đăng bán',
      message: `Huỷ đăng bán (ghế ${p.seat_number || ''})?`,
      confirmText: 'Huỷ',
      cancelText: 'Đóng',
    })
    if (!ok) return
    const res = await fetch(`${API_BASE}/api/ticket-passes/${p.id}/cancel`, { method: 'POST', credentials: 'include' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return ui.toast.error(d.error || 'Huỷ thất bại.')
    ui.toast.success('Đã huỷ đăng bán.')
    load()
  }

  return (
    <main className="page-shell">
      <h1>Vé đang bán</h1>
      <div style={{ display: 'grid', gap: 10 }}>
        {passes.map((p) => (
          <div key={p.id} className="card-pele" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <Link to={`/ticket/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontWeight: 800 }}>
                {p.movieTitle} · Ghế {p.seat_number || '—'}
              </div>
              <div className="muted small">
                Suất chiếu: {fmtDateTime(p.start_time)} · {Number(p.pass_price).toLocaleString('vi-VN')}đ · {p.status}
              </div>
            </Link>
            {(p.status === 'AVAILABLE' || p.status === 'LOCKED') && (
              <button type="button" className="btn-danger" onClick={() => cancelPass(p)}>
                Huỷ
              </button>
            )}
          </div>
        ))}
      </div>
      {!passes.length && <p className="muted">Chưa đăng bán vé nào.</p>}
    </main>
  )
}
