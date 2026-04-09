import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { API_BASE } from '../api'
import { useUi } from '../context/useUi.js'

// Helper for lone seat check (Frontend version)
function checkLoneSeat(row, selectedColsInRow, occupiedColsInRow, totalCols) {
    const finalOccupied = new Set([...occupiedColsInRow, ...selectedColsInRow]);
    for (let c = 1; c <= totalCols; c++) {
        if (!finalOccupied.has(c)) {
            const leftBound = c === 1 || finalOccupied.has(c - 1);
            const rightBound = c === totalCols || finalOccupied.has(c + 1);
            if (leftBound && rightBound) return true;
        }
    }
    return false;
}

export default function BookingPage() {
    const { showtimeId } = useParams()
    const navigate = useNavigate()
    const ui = useUi()
    
    const [seatmap, setSeatmap] = useState(null)
    const [selected, setSelected] = useState(new Set())
    const [productQty, setProductQty] = useState({})
    const [err, setErr] = useState('')
    const [liveHeld, setLiveHeld] = useState([])
    const [mySockId, setMySockId] = useState('')
    
    const socketRef = useRef(null)
    const selectedRef = useRef(new Set())
    const lastSentRef = useRef(new Set())

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

    useEffect(() => {
        selectedRef.current = selected
    }, [selected])

    // Realtime holds via Socket.IO
    useEffect(() => {
        const sid = Number(showtimeId)
        if (!Number.isFinite(sid) || sid <= 0) return

        const socket = io(API_BASE, { withCredentials: true, transports: ['websocket', 'polling'] })
        socketRef.current = socket
        
        socket.on('connect', () => {
             setMySockId(socket.id || '')
             socket.emit('showtime:join', { showtimeId: sid })
        })

        socket.on('showtime:holds', (payload) => {
            if (Number(payload?.showtimeId) !== sid) return
            const holds = payload.holds || []
            const heldSeats = holds
                .filter((h) => h && h.seat && String(h.socketId) !== String(socket.id))
                .map((h) => String(h.seat))
            setLiveHeld(heldSeats)
        })

        socket.on('error', (payload) => {
             ui.toast.error(payload.message || 'Lỗi socket')
        })

        return () => {
            const seats = Array.from(selectedRef.current || [])
            if (seats.length && socketRef.current) socketRef.current.emit('seat:release', { showtimeId: sid, seats })
            socket.close()
            socketRef.current = null
            setMySockId('')
            lastSentRef.current = new Set()
        }
    }, [showtimeId, ui])

    // Update server holds
    useEffect(() => {
        const sid = Number(showtimeId)
        if (!Number.isFinite(sid) || sid <= 0) return
        const sock = socketRef.current
        if (!sock) return
        const nextSel = new Set(selected || [])
        const prevSel = lastSentRef.current || new Set()

        const toHold = []
        const toRelease = []
        for (const s of nextSel) if (!prevSel.has(s)) toHold.push(s)
        for (const s of prevSel) if (!nextSel.has(s)) toRelease.push(s)

        if (toHold.length) sock.emit('seat:hold', { showtimeId: sid, seats: toHold })
        if (toRelease.length) sock.emit('seat:release', { showtimeId: sid, seats: toRelease })
        lastSentRef.current = nextSel
    }, [selected, showtimeId])

    const booked = useMemo(() => new Set(seatmap?.bookedSeats || []), [seatmap])
    const held = useMemo(() => {
        const s = new Set(seatmap?.heldSeats || [])
        for (const x of liveHeld || []) s.add(x)
        return s
    }, [seatmap, liveHeld])

    const products = useMemo(() => (Array.isArray(seatmap?.products) ? seatmap.products : []), [seatmap])
    const productMap = useMemo(() => new Map(products.map((p) => [Number(p.id), p])), [products])
    
    const productsAmount = useMemo(() => {
        let sum = 0
        for (const [k, v] of Object.entries(productQty || {})) {
            const pid = Number(k)
            const qty = Number(v || 0)
            if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty <= 0) continue
            const p = productMap.get(pid)
            if (!p) continue
            sum += Number(p.price || 0) * qty
        }
        return sum
    }, [productQty, productMap])

    const rowsCount = seatmap?.rows ? Number(seatmap.rows) : 10
    const colsCount = seatmap?.cols ? Number(seatmap.cols) : 10
    const rowLabels = useMemo(() => Array.from({ length: rowsCount }, (_, i) => String.fromCharCode(65 + i)), [rowsCount])
    const colNums = useMemo(() => Array.from({ length: colsCount }, (_, i) => i + 1), [colsCount])

    const getSeatInfo = (seatId) => {
        const row = seatId.charAt(0).toUpperCase();
        let type = 'STANDARD';
        if (['D', 'E', 'F', 'G'].includes(row)) type = 'VIP';
        else if (row === 'H') type = 'COUPLE';

        let price = Number(seatmap?.showtime?.price || 0);
        if (type === 'VIP') price += 20000;
        else if (type === 'COUPLE') price += 25000;

        const date = new Date(seatmap?.showtime?.start_time);
        const day = date.getDay();
        const hour = date.getHours();

        if ([0, 5, 6].includes(day)) price += 10000;
        if (hour >= 17) price += 15000;

        return { type, price };
    };

    const currentTotal = useMemo(() => {
        let sum = 0;
        selected.forEach(s => {
            sum += getSeatInfo(s).price;
        });
        return sum + productsAmount;
    }, [selected, seatmap, productsAmount]);

    function toggle(seat) {
        if (booked.has(seat) || held.has(seat)) return
        
        const isCouple = seat.startsWith('H');
        let seatsToToggle = [seat];

        if (isCouple) {
            const num = parseInt(seat.substring(1));
            const partnerNum = num % 2 === 0 ? num - 1 : num + 1;
            const partner = `H${partnerNum}`;
            if (!booked.has(partner) && !held.has(partner)) {
                seatsToToggle.push(partner);
            }
        }

        setSelected((prev) => {
            const n = new Set(prev)
            const isRemoving = seatsToToggle.every(s => n.has(s));
            
            if (isRemoving) {
                seatsToToggle.forEach(s => n.delete(s));
            } else {
                if (n.size + seatsToToggle.length > 8) {
                    ui.toast.warn('Bạn không được đặt quá 8 ghế một lúc.')
                    return prev;
                }
                seatsToToggle.forEach(s => n.add(s));
            }
            return n
        })
    }

    function handleNext() {
        if (selected.size === 0) {
            ui.toast.warn('Vui lòng chọn ghế.')
            return
        }

        // Adjacency check: Enforce horizontal blocks in each row
        const rowsInSel = [...new Set(Array.from(selected).map(s => s.charAt(0)))];
        for (const r of rowsInSel) {
            const selCols = Array.from(selected)
                .filter(s => s.startsWith(r))
                .map(s => parseInt(s.substring(1)))
                .sort((a, b) => a - b);
            
            if (selCols.length > 1) {
                for (let i = 0; i < selCols.length - 1; i++) {
                    if (selCols[i+1] - selCols[i] > 1) {
                        ui.toast.warn(`Cần chọn các ghế liên tiếp nhau ở hàng ${r}.`);
                        return;
                    }
                }
            }
        }

        // Lone seat check
        for (const r of rowsInSel) {
            const selCols = Array.from(selected).filter(s => s.startsWith(r)).map(s => parseInt(s.substring(1)));
            const occCols = Array.from(booked).filter(s => s.startsWith(r)).map(s => parseInt(s.substring(1)));
            const heldCols = Array.from(held).filter(s => s.startsWith(r) && !selected.has(s)).map(s => parseInt(s.substring(1)));
            const combinedOcc = [...occCols, ...heldCols];
            if (checkLoneSeat(r, selCols, combinedOcc, colsCount)) {
                ui.toast.warn(`Không được để ghế trống đơn lẻ ở hàng ${r}.`);
                return;
            }
        }

        const seats = Array.from(selected)
        const st = seatmap.showtime
        const pickedProducts = Object.entries(productQty || {})
            .map(([id, qty]) => ({ id: Number(id), qty: Number(qty) }))
            .filter((x) => Number.isFinite(x.id) && x.id > 0 && Number.isFinite(x.qty) && x.qty > 0)

        navigate('/checkout', {
            state: {
                showtimeId: Number(showtimeId),
                seats,
                showtime: st,
                pricePerSeat: st.price, // Final calc is at confirm, st.price is base
                products: pickedProducts,
                productsAmount,
                totalAmount: currentTotal,
                seatSocketId: mySockId || socketRef.current?.id || '',
            },
        })
    }

    if (err) return <main className="page-shell"><p className="status-msg error">{err}</p></main>
    if (!seatmap) return <main className="page-shell"><p>Đang tải sơ đồ ghế...</p></main>

    const st = seatmap.showtime

    return (
        <main className="page-shell" style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Link to={st.movie_id ? `/movie/${st.movie_id}` : '/'} className="back-link" style={{ color: '#e50914', textDecoration: 'none', fontWeight: 700 }}>
                    ← Quay lại
                </Link>
                <div style={{ textAlign: 'right' }}>
                    <h1 style={{ margin: 0, fontSize: 24 }}>Chọn ghế</h1>
                    <p className="muted small">{st.movieTitle} • {st.roomName}</p>
                </div>
            </div>

            <div className="card-pele" style={{ padding: '60px 40px 40px', background: 'rgba(10, 10, 12, 0.9)', backdropFilter: 'blur(30px)', borderRadius: 32, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '60%', height: 4, background: 'linear-gradient(90deg, transparent, #e50914, transparent)', margin: '0 auto 8px', borderRadius: 4, boxShadow: '0 8px 30px rgba(229, 9, 20, 0.4)' }}></div>
                <p style={{ textAlign: 'center', fontSize: 10, color: '#e50914', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 6, marginBottom: 50 }}>MÀN HÌNH</p>
                
                <div className="seat-map-scale" style={{ position: 'relative' }}>
                    {/* Central Area Frame */}
                    <div style={{ 
                        position: 'absolute', 
                        top: '12%', left: '20%', right: '20%', bottom: '30%', 
                        border: '2px dashed rgba(243, 156, 18, 0.3)', 
                        borderRadius: 20, 
                        pointerEvents: 'none',
                        zIndex: 0
                    }}>
                        <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#0a0a0c', padding: '0 10px', fontSize: 9, color: '#f39c12', fontWeight: 700, whiteSpace: 'nowrap' }}>KHU VỰC TRUNG TÂM</span>
                    </div>

                    <table className="seat-table" style={{ position: 'relative', zIndex: 1 }}>
                        <tbody>
                            {rowLabels.map((row) => (
                                <tr key={row}>
                                    <td className="seat-row-label">{row}</td>
                                    {colNums.map((col) => {
                                        const id = `${row}${col}`
                                        const isBooked = booked.has(id)
                                        const isHeld = held.has(id)
                                        const isSel = selected.has(id)
                                        const info = getSeatInfo(id)
                                        
                                        let cls = 'seat-cell-btn seat-free'
                                        if (isBooked) cls = 'seat-cell-btn seat-booked'
                                        else if (isHeld) cls = 'seat-cell-btn seat-held'
                                        else if (isSel) cls = 'seat-cell-btn seat-selected'

                                        const seatStyle = {}
                                        if (isBooked) {
                                            seatStyle.background = '#222';
                                            seatStyle.color = '#444';
                                            seatStyle.borderColor = '#333';
                                            seatStyle.cursor = 'not-allowed';
                                        } else if (isHeld) {
                                            seatStyle.background = 'rgba(243, 156, 18, 0.15)';
                                            seatStyle.borderColor = '#f39c12';
                                            seatStyle.color = '#f39c12';
                                            seatStyle.cursor = 'not-allowed';
                                        } else if (isSel) {
                                            seatStyle.background = '#e50914';
                                            seatStyle.borderColor = '#e50914';
                                            seatStyle.color = '#fff';
                                            seatStyle.boxShadow = '0 0 15px rgba(229, 9, 20, 0.5)';
                                        } else {
                                            if (info.type === 'VIP') seatStyle.borderColor = '#f39c12'
                                            if (info.type === 'COUPLE') seatStyle.borderColor = '#e91e63'
                                        }

                                        return (
                                            <td key={id}>
                                                <button 
                                                    type="button" 
                                                    className={cls} 
                                                    style={seatStyle}
                                                    onClick={() => toggle(id)} 
                                                    disabled={isBooked || isHeld} 
                                                    title={`${id}: ${info.price.toLocaleString()}đ`}
                                                >
                                                    {isBooked ? '×' : col}
                                                </button>
                                            </td>
                                        )
                                    })}
                                    <td className="seat-row-label" style={{ paddingLeft: 10 }}>{row}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: 40, fontSize: 11, color: '#888', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="seat-cell-btn" style={{ width: 16, height: 16, background: '#0a0a0c', border: '1px solid #333' }} /> Ghế trống</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="seat-cell-btn" style={{ width: 16, height: 16, border: '1px solid #f39c12' }} /> VIP</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="seat-cell-btn" style={{ width: 16, height: 16, border: '1px solid #e91e63' }} /> Ghế Đôi</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="seat-cell-btn" style={{ width: 16, height: 16, background: '#e50914', border: 'none' }} /> Đang chọn</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="seat-cell-btn" style={{ width: 16, height: 16, background: 'rgba(243, 156, 18, 0.15)', border: '1px solid #f39c12' }} /> Đang giữ</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="seat-cell-btn" style={{ width: 16, height: 16, background: '#222', border: '1px solid #333' }} /> Đã bán</div>
                </div>
            </div>

            <div className="card-pele" style={{ marginTop: 20 }}>
                <h3 style={{ marginTop: 0 }}>Combo bắp nước</h3>
                {!products.length ? (
                    <p className="muted small">Không tìm thấy dịch vụ nào kèm theo.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                        {products.map((p) => {
                            const pid = Number(p.id)
                            const qty = Number(productQty?.[pid] || 0)
                            const price = Number(p.price || 0)
                            const img = p.image_url || p.imageUrl || null
                            return (
                                <div key={pid} className="card-pele" style={{ padding: 12, borderRadius: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <div style={{ width: 60, height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
                                        {img ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center', opacity: 0.2 }}>🥤</div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                                        <div style={{ color: '#e50914', fontWeight: 800, fontSize: 13 }}>{price.toLocaleString()}đ</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <button type="button" className="btn-ghost" style={{ padding: '4px 10px', borderRadius: 8 }} onClick={() => setProductQty(prev => ({ ...prev, [pid]: Math.max(0, (prev[pid] || 0) - 1) }))}>−</button>
                                        <span style={{ fontWeight: 800 }}>{qty}</span>
                                        <button type="button" className="btn-ghost" style={{ padding: '4px 10px', borderRadius: 8 }} onClick={() => setProductQty(prev => ({ ...prev, [pid]: (prev[pid] || 0) + 1 }))}>+</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 24, alignItems: 'stretch' }}>
                <div className="card-pele" style={{ flex: 1, padding: '16px 24px' }}>
                    <div className="muted small">Tạm tính ({selected.size} ghế)</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{currentTotal.toLocaleString()}đ</div>
                    <div className="small text-gold" style={{ marginTop: 4, fontWeight: 600 }}>Giá đã bao gồm phụ phí vị trí & thời gian</div>
                </div>
                <button type="button" className="btn-primary-pele" style={{ flex: 2, borderRadius: 24, fontSize: 18 }} onClick={handleNext}>
                    Tiếp tục thanh toán →
                </button>
            </div>
        </main>
    )
}
