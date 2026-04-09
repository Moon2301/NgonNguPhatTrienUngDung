import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../api'
import QRCode from 'qrcode'
import { useUi } from '../context/useUi.js'

export default function MyTicketsPage() {
  const ui = useUi()
  const [bookings, setBookings] = useState([])
  const [selling, setSelling] = useState({}) // { [bookingId]: { [seat]: true } }
  const [qr, setQr] = useState(null) // { bookingId, seat, payload, code, dataUrl }
  const [detail, setDetail] = useState(null) // booking object
  useEffect(() => {
    fetch(`${API_BASE}/api/bookings/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []))

    // Ghế đang rao bán (pass) để tô xám + chặn tạo QR
    fetch(`${API_BASE}/api/ticket-passes?filter=my`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const map = {}
        for (const p of d.passes || []) {
          const bid = Number(p.booking_id || p.bookingId || 0)
          const seat = String(p.seat_number || '').trim()
          const st = String(p.status || '').toUpperCase()
          if (!bid || !seat) continue
          // pass đang rao/đang giữ chỗ mua
          if (st !== 'AVAILABLE' && st !== 'LOCKED') continue
          map[bid] = map[bid] || {}
          map[bid][seat] = true
        }
        setSelling(map)
      })
      .catch(() => {})
  }, [])

  function fmtDateTime(v) {
    if (!v) return '—'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString('vi-VN')
  }

  async function openQr(bookingId, seat) {
    try {
      const res = await fetch(
        `${API_BASE}/api/tickets/qr?bookingId=${encodeURIComponent(bookingId)}&seat=${encodeURIComponent(seat)}`,
        { credentials: 'include' },
      )
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Không tạo được QR.')
      const dataUrl = await QRCode.toDataURL(d.payload, { margin: 1, width: 260 })
      setQr({ bookingId: d.bookingId, seat: d.seat, payload: d.payload, code: d.code, dataUrl })
    } catch (e) {
      ui.toast.error(e.message)
    }
  }

  return (
    <main className="page-shell">
      <h1>Vé của tôi</h1>
      <table className="table-pele">
        <thead>
          <tr>
            <th>Phim</th>
            <th>Suất</th>
            <th>Ghế</th>
            <th>Tiền</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.movieTitle}</td>
              <td>{b.start_time ? String(b.start_time).slice(0, 16) : '—'}</td>
              <td>
                {String(b.seat_numbers || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => (
                    <button
                      key={`${b.id}_${s}`}
                      type="button"
                      className="btn-ghost"
                      style={{
                        marginRight: 8,
                        marginBottom: 6,
                        padding: '6px 10px',
                        opacity: selling?.[b.id]?.[s] ? 0.55 : 1,
                        background: selling?.[b.id]?.[s] ? 'rgba(255,255,255,0.06)' : undefined,
                        borderColor: selling?.[b.id]?.[s] ? 'rgba(255,255,255,0.12)' : undefined,
                        color: selling?.[b.id]?.[s] ? 'rgba(255,255,255,0.7)' : undefined,
                        cursor: selling?.[b.id]?.[s] ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() => {
                        if (selling?.[b.id]?.[s]) {
                          ui.toast.warn('Ghế này đang được rao bán nên không thể tạo QR.')
                          return
                        }
                        openQr(b.id, s)
                      }}
                      title={selling?.[b.id]?.[s] ? 'Đang rao bán' : 'Tạo QR cho ghế này'}
                    >
                      {s}
                    </button>
                  ))}
              </td>
              <td>{Number(b.total_amount).toLocaleString('vi-VN')}đ</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button type="button" className="btn-ghost" onClick={() => setDetail(b)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!bookings.length && <p className="muted">Chưa có vé.</p>}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
        <Link to="/ticket/post" className="btn-primary-pele" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-tag" />
          Đăng bán pass vé
        </Link>
      </div>

      {qr && (
        <div
          role="presentation"
          onClick={() => setQr(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card-pele"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}
          >
            <h3 style={{ marginTop: 0 }}>QR vé · Ghế {qr.seat}</h3>
            <img src={qr.dataUrl} alt="QR" style={{ width: 260, height: 260, borderRadius: 12 }} />
            <p className="muted small" style={{ marginTop: 12 }}>
              Mã: <strong style={{ color: '#fff' }}>{qr.payload}</strong>
            </p>
            <button type="button" className="btn-primary-pele" onClick={() => setQr(null)}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {detail && (
        <div
          role="presentation"
          onClick={() => setDetail(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card-pele"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, width: '100%' }}
          >
            <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'stretch' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>{detail.movieTitle || 'Vé'}</h3>
                <p className="muted" style={{ margin: '0 0 8px' }}>
                  Suất chiếu: {fmtDateTime(detail.start_time)}
                  {detail.roomName ? ` · ${detail.roomName}` : ''}
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  Ghế:{' '}
                  <strong style={{ color: '#fff' }}>
                    {String(detail.seat_numbers || '')
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </strong>
                </p>

                <div className="card-pele" style={{ padding: 12, marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span className="muted">Tiền vé</span>
                    <strong>{Number(detail.tickets_amount || 0).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                    <span className="muted">Dịch vụ</span>
                    <strong>{Number(detail.products_amount || 0).toLocaleString('vi-VN')}đ</strong>
                  </div>
                  {!!Number(detail.promo_discount || 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                      <span className="muted">Giảm giá</span>
                      <strong>-{Number(detail.promo_discount || 0).toLocaleString('vi-VN')}đ</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                    <span className="muted">Tổng</span>
                    <strong style={{ color: '#ff6b6b' }}>{Number(detail.total_amount || 0).toLocaleString('vi-VN')}đ</strong>
                  </div>
                </div>

                <div className="card-pele" style={{ padding: 12, marginTop: 10 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Dịch vụ đi kèm</div>
                  {Array.isArray(detail.products) && detail.products.length ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {detail.products.map((p, idx) => (
                        <div key={`${p.product_id || idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div className="muted small">
                              {Number(p.qty || 0)} × {Number(p.unit_price || 0).toLocaleString('vi-VN')}đ
                            </div>
                          </div>
                          <div style={{ fontWeight: 900 }}>{Number(p.line_total || 0).toLocaleString('vi-VN')}đ</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>
                      Không có dịch vụ đi kèm (vé mua từ pass thường không kèm dịch vụ).
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  width: 190,
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.06)',
                  flex: '0 0 auto',
                }}
              >
                {detail.posterUrl ? (
                  <img src={detail.posterUrl} alt={detail.movieTitle || 'poster'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: 260 }} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn-primary-pele" onClick={() => setDetail(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
