import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { API_BASE } from '../api'

export default function BookingPage() {
    const { showtimeId } = useParams()
    const navigate = useNavigate()
    const [seatmap, setSeatmap] = useState(null)
    const [selected, setSelected] = useState(new Set())
    const [err, setErr] = useState('')
    const [socket, setSocket] = useState(null)

    // Fetch Seat Map
    const fetchSeatmap = () => {
        fetch(`${API_BASE}/api/bookings/showtimes/${showtimeId}/seatmap`, { credentials: 'include' })
            .then(async (r) => {
                const d = await r.json()
                if (!r.ok) throw new Error(d.error || 'Lỗi')
                return d
            })
            .then(setSeatmap)
            .catch((e) => setErr(e.message))
    }

    useEffect(() => {
        fetchSeatmap()
    }, [showtimeId])

    // Socket.IO Connection
    useEffect(() => {
        const s = io(API_BASE, { withCredentials: true })
        setSocket(s)

        s.emit('join-showtime', showtimeId)

        s.on('seat-status-updated', () => {
            fetchSeatmap()
        })

        return () => {
            s.disconnect()
        }
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
        const isSel = selected.has(seat)
        if (occupied.has(seat) && !isSel) return

        setSelected((prev) => {
            const n = new Set(prev)
            if (isSel) {
                n.delete(seat)
                if (socket) socket.emit('release-seat', seat)
            } else {
                n.add(seat)
                if (socket) socket.emit('hold-seat', seat)
            }
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
                products: [], 
            },
        })
    }

    if (err) return <main className="page-shell"><p className="muted">{err}</p></main>
    if (!seatmap) return <main className="page-shell"><p>Đang tải sơ đồ ghế...</p></main>

    const st = seatmap.showtime

    return (
        <main className="page-shell" style={{ maxWidth: 1000, margin: '0 auto', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <Link to={st.movie_id ? `/movie/${st.movie_id}` : '/'} className="back-link" style={{ fontSize: 14, color: '#e50914', textDecoration: 'none', fontWeight: 600 }}>
                    <i className="fa-solid fa-chevron-left" style={{ marginRight: 8 }}></i> Quay lại
                </Link>
                <div style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: 24, margin: 0, color: '#fff' }}>Chọn ghế</h1>
                    <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>{st.movieTitle || 'Phim'} • {st.roomName || 'Phòng chiếu'}</p>
                </div>
            </div>

            <div className="card-pele" style={{ padding: '60px 20px 40px', background: 'rgba(20, 20, 23, 0.7)', backdropFilter: 'blur(30px)', borderRadius: 32, border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
                
                {/* Background Decorations */}
                <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'radial-gradient(circle, rgba(229, 9, 20, 0.05) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
                <div style={{ position: 'absolute', bottom: -50, left: -50, width: 200, height: 200, background: 'radial-gradient(circle, rgba(229, 9, 20, 0.03) 0%, transparent 70%)', pointerEvents: 'none' }}></div>

                {/* Emergency Exits */}
                <div style={{ position: 'absolute', top: 30, left: 30, color: '#333', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.5 }}>
                    <i className="fa-solid fa-person-running"></i> THOÁT HIỂM
                </div>
                <div style={{ position: 'absolute', top: 30, right: 30, color: '#333', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.5 }}>
                    THOÁT HIỂM <i className="fa-solid fa-person-running"></i>
                </div>

                {/* Screen Indicator */}
                <div style={{ width: '70%', height: 4, background: 'linear-gradient(90deg, transparent, #e50914, transparent)', margin: '0 auto 12px', borderRadius: 4, boxShadow: '0 8px 30px rgba(229, 9, 20, 0.6)' }}></div>
                <p style={{ textAlign: 'center', fontSize: 10, color: '#e50914', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 8, marginBottom: 64, opacity: 0.8 }}>MÀN HÌNH</p>
                
                <div 
                    style={{ 
                        display: 'grid', 
                        gridTemplateColumns: `30px repeat(${cols.length}, 36px) 30px`, 
                        gap: '10px', 
                        justifyContent: 'center',
                        position: 'relative',
                        width: 'fit-content',
                        margin: '0 auto'
                    }}
                >
                    {/* Best Area Frame */}
                    {bestArea && (
                        <div 
                            style={{
                                position: 'absolute',
                                gridRow: `${bestArea.rowStart + 1} / ${bestArea.rowEnd + 2}`,
                                gridColumn: `${bestArea.colStart + 2} / ${bestArea.colEnd + 3}`,
                                top: -6,
                                left: -6,
                                right: -6,
                                bottom: -6,
                                border: '1px dashed rgba(255,255,255,0.2)',
                                borderRadius: 12,
                                pointerEvents: 'none',
                                zIndex: 0
                            }}
                        ></div>
                    )}

                    {rows.map((row) => (
                        <React.Fragment key={row}>
                            <div style={{ display: 'flex', alignItems: 'center', color: '#444', fontSize: 14, fontWeight: 800 }}>{row}</div>
                            {cols.map((col) => {
                                const id = `${row}${col}`
                                const isMine = myBooked.has(id)
                                const isSel = selected.has(id)
                                const isOcc = occupied.has(id) && !isSel
                                
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => toggle(id)}
                                        disabled={isOcc || isMine}
                                        style={{
                                            width: 36,
                                            height: 36,
                                            fontSize: 11,
                                            borderRadius: 10,
                                            border: isMine ? '1.5px solid #4caf50' : isSel ? '1.5px solid #e50914' : isOcc ? '1px solid #222' : '1px solid #2a2a2e',
                                            background: isMine ? 'rgba(76, 175, 80, 0.15)' : isSel ? '#e50914' : isOcc ? '#16161a' : 'rgba(255,255,255,0.02)',
                                            color: isMine ? '#4caf50' : isOcc ? '#333' : '#eee',
                                            cursor: (isOcc || isMine) ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                            boxShadow: isSel ? '0 0 25px rgba(229, 9, 20, 0.5)' : 'none',
                                            fontWeight: 800,
                                            position: 'relative',
                                            overflow: 'hidden',
                                            zIndex: 1,
                                            transform: isSel ? 'scale(1.15)' : 'scale(1)'
                                        }}
                                    >
                                        {isMine ? (
                                            <i className="fa-solid fa-user-check" style={{ fontSize: 12 }}></i>
                                        ) : isOcc ? (
                                            <span style={{ fontSize: 16, opacity: 0.3 }}>×</span>
                                        ) : (
                                            col
                                        )}
                                        {isSel && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 100%)' }}></div>}
                                    </button>
                                )
                            })}
                            <div style={{ display: 'flex', alignItems: 'center', color: '#444', fontSize: 14, fontWeight: 800, paddingLeft: 10 }}>{row}</div>
                        </React.Fragment>
                    ))}
                </div>

                {/* Entrance/Exit Icons */}
                <div style={{ position: 'absolute', bottom: 30, right: 40, color: '#333', textAlign: 'center', opacity: 0.6 }}>
                    <i className="fa-solid fa-door-open" style={{ fontSize: 24, display: 'block', marginBottom: 4 }}></i>
                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>Lối vào</span>
                </div>
                <div style={{ position: 'absolute', bottom: 30, left: 40, color: '#333', textAlign: 'center', opacity: 0.6 }}>
                    <i className="fa-solid fa-door-open" style={{ fontSize: 24, display: 'block', marginBottom: 4, transform: 'scaleX(-1)' }}></i>
                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>Lối ra</span>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 70, fontSize: 11, color: '#666', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 40 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, border: '1px solid #333' }}></div>
                        <span>Ghế trống</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: '#e50914' }}></div>
                        <span style={{ color: '#aaa' }}>Đang chọn</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: 'rgba(76, 175, 80, 0.1)', border: '1px solid #4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4caf50', fontSize: 8 }}><i className="fa-solid fa-user-check"></i></div>
                        <span>Ghế của bạn</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: '#16161a', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 10 }}>×</div>
                        <span>Đã bán / Có người chọn</span>
                    </div>
                </div>
            </div>

            {/* Price & Checkout Section */}
            <div style={{ marginTop: 40, display: 'flex', gap: 20, alignItems: 'stretch' }}>
                <div style={{ flex: 1, padding: '20px 30px', background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#666', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>Đã chọn: {selected.size} ghế</p>
                    <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900, color: '#fff' }}>{(selected.size * Number(st.price || 0)).toLocaleString('vi-VN')} <span style={{ fontSize: 14, color: '#e50914' }}>đ</span></p>
                </div>
                <button 
                    type="button" 
                    className="btn-primary-pele" 
                    style={{ 
                        flex: 2, 
                        borderRadius: 24, 
                        fontSize: 18, 
                        fontWeight: 900, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', gap: 16,
                        opacity: selected.size > 0 ? 1 : 0.4,
                        cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                        boxShadow: selected.size > 0 ? '0 15px 30px rgba(229, 9, 20, 0.4)' : 'none',
                        transition: 'all 0.3s ease'
                    }} 
                    onClick={next}
                    disabled={selected.size === 0}
                >
                    Xác nhận đặt vé <i className="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        </main>
    )
}
