import { useEffect, useState } from 'react'
import { API_BASE } from '../api'

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState([])
  useEffect(() => {
    fetch(`${API_BASE}/api/promotions`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPromotions(d.promotions || []))
  }, [])

  return (
    <main className="page-shell">
      <h1>Khuyến mãi</h1>
      <div className="promo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {promotions.map((p) => (
          <div key={p.id} className="card-pele">
            <h3 style={{ marginTop: 0, color: '#e50914' }}>{p.code}</h3>
            <h4 style={{ margin: '4px 0' }}>{p.title}</h4>
            <p className="muted small">{p.description}</p>
            <p className="small">
              Hết hạn: {p.expires_at ? String(p.expires_at).slice(0, 16).replace('T', ' ') : 'Không giới hạn'}
            </p>
          </div>
        ))}
      </div>
      {!promotions.length && <p className="muted">Chưa có khuyến mãi.</p>}
    </main>
  )
}
