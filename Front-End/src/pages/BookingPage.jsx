import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { API_BASE } from '../api'

export default function BookingPage() {
    const { showtimeId } = useParams()
    const navigate = useNavigate()
    const [seatmap, setSeatmap] = useState(null)
    const [selected, setSelected] = useState(new Set())
    const [err, setErr] = useState('')

    useEffect(() => {
        fetch(`${API_BASE}/api/bookings/showtimes/${showtimeId}/seatmap`, { credentials: 'include' })
            .then(async (r) => {
                const d = await r.json()
                if (!r.ok) throw new Error(d.error || 'Lỗi')
                return d
            })
            .then(setSeatmap)
            .catch((e) => setErr(e.message))
    }, [showtimeId])

    const occupied = useMemo(() => new Set(seatmap?.occupiedSeats || []), [seatmap])
    const myBooked = useMemo(() => new Set(seatmap?.myBookedSeats || []), [seatmap])

    // Generate rows/cols dynamically
    const rows = useMemo(() => {
        if (!seatmap) return []
        const count = seatmap.rows || 10
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
        return chars.slice(0, count)
    }, [seatmap])

    const cols = useMemo(() => {
        if (!seatmap) return []
        const count = seatmap.cols || 10
        return Array.from({ length: count }, (_, i) => i + 1)
    }, [seatmap])

    // Best Seat Area logic
    const bestArea = useMemo(() => {
        if (!seatmap || !rows.length || !cols.length) return null
        const rCount = rows.length
        const cCount = cols.length
        return {
            rowStart: Math.floor(rCount * 0.3),
            rowEnd: Math.floor(rCount * 0.75),
            colStart: Math.floor(cCount * 0.25),
            colEnd: Math.floor(cCount * 0.75),
        }
    }, [seatmap, rows, cols])

    function toggle(seat) {
        if (occupied.has(seat)) return
        setSelected((prev) => {
            const n = new Set(prev)
            if (n.has(seat)) n.delete(seat)
            else n.add(seat)
            return n
        })
    }

    function next() {
        const seats = Array.from(selected)
        if (!seats.length) {
            alert('Chọn ít nhất một ghế')
            return
        }
        const st = seatmap.showtime
        const price = Number(st.price || 0)
        navigate('/checkout', {
            state: {
                showtimeId: Number(showtimeId),
                seats,
                showtime: st,
                pricePerSeat: price,
                totalAmount: seats.length * price,
                products: [], // Future: Add product selection UI
            },
        })
    }

    if (err) return <main className="page-shell"><p className="muted">{err}</p></main>
    if (!seatmap) return <main className="page-shell"><p>Đang tải sơ đồ ghế...</p></main>

    const st = seatmap.showtime

    return (
        <main className="page-shell">
            <Link to={st.movie_id ? `/movie/${st.movie_id}` : '/'} className="back-link">
                ← Quay lại
            </Link>
            <h1>Chọn ghế</h1>
            <p className="muted">
                Giá vé: {Number(st.price || 0).toLocaleString('vi-VN')}đ / ghế · Đã chọn: {selected.size}
            </p>
            <div className="seat-map card-pele" style={{ overflowX: 'auto', padding: '60px 20px 40px' }}>
                <div style={{ width: '100%', maxWidth: 400, height: 4, background: 'linear-gradient(to right, transparent, #e50914, transparent)', margin: '0 auto 40px', borderRadius: 2, boxShadow: '0 4px 10px rgba(229, 9, 20, 0.3)' }}></div>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: -30, marginBottom: 40, textTransform: 'uppercase', letterSpacing: 2 }}>Màn hình</p>
                
                <div 
                    style={{ 
                        display: 'grid', 
                        gridTemplateColumns: `30px repeat(${cols.length}, 32px)`, 
                        gap: '8px', 
                        justifyContent: 'center',
                        position: 'relative',
                        width: 'fit-content',
                        margin: '0 auto'
                    }}
                >
                    {/* Best Area Rectangle Overlay - Minimalist style */}
                    {bestArea && (
                        <div 
                            style={{
                                position: 'absolute',
                                gridRow: `${bestArea.rowStart + 1} / ${bestArea.rowEnd + 2}`,
                                gridColumn: `${bestArea.colStart + 2} / ${bestArea.colEnd + 3}`,
                                top: -4,
                                left: -4,
                                right: -4,
                                bottom: -4,
                                border: '1.5px dashed #555', // Subtle dark dash
                                borderRadius: 10,
                                background: 'transparent',
                                pointerEvents: 'none',
                                zIndex: 0,
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'center'
                            }}
                        >
                        </div>
                    )}


                    {rows.map((row, rIdx) => (
                        <React.Fragment key={row}>
                            <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: 14, fontWeight: 700 }}>{row}</div>
                            {cols.map((col, cIdx) => {
                                const id = `${row}${col}`
                                const isMine = myBooked.has(id)
                                const occ = occupied.has(id)
                                const sel = selected.has(id)
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => toggle(id)}
                                        disabled={occ}
                                        style={{
                                            width: 32,
                                            height: 32,
                                            fontSize: 10,
                                            borderRadius: 8,
                                            border: isMine ? '1px solid #4caf50' : occ ? '1px solid #222' : sel ? '1px solid #e50914' : '1px solid #333',
                                            background: isMine ? 'rgba(76, 175, 80, 0.1)' : occ ? '#1a1a1f' : sel ? '#e50914' : 'transparent',
                                            color: isMine ? '#4caf50' : occ ? '#444' : '#fff',
                                            cursor: occ ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: sel ? '0 0 15px rgba(229, 9, 20, 0.4)' : isMine ? '0 0 8px rgba(76, 175, 80, 0.2)' : 'none',
                                            fontWeight: 600,
                                            position: 'relative',
                                            overflow: 'hidden',
                                            zIndex: 1
                                        }}
                                    >
                                        {isMine ? (
                                            <i className="fa-solid fa-user-check" style={{ fontSize: 12 }}></i>
                                        ) : occ ? (
                                            <span style={{ fontSize: 14, opacity: 0.5 }}>×</span>
                                        ) : (
                                            col
                                        )}
                                        {sel && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.1)' }}></div>}
                                    </button>
                                )
                            })}
                        </React.Fragment>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 40, fontSize: 11, color: '#aaa', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid #444' }}></div>
                        <span>Trống</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: '#e50914' }}></div>
                        <span>Đang chọn</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                            style={{
                                width: 14,
                                height: 14,
                                borderRadius: 3,
                                background: 'rgba(76, 175, 80, 0.1)',
                                border: '1px solid #4caf50',
                                color: '#4caf50',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 8,
                            }}
                        >
                            <i className="fa-solid fa-user-check"></i>
                        </div>
                        <span>Ghế bạn đã đặt</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: '#1a1a1f', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 10 }}>×</div>
                        <span>Đã bán</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 14, borderRadius: 3, border: '1.5px dashed #555' }}></div>
                        <span>Vị trí đẹp</span>
                    </div>
                </div>
            </div>
            
            <button type="button" className="btn-primary-pele" style={{ marginTop: 24, width: '100%' }} onClick={next}>
                Tiếp tục thanh toán ({selected.size} ghế)
            </button>
        </main>
    )
}
