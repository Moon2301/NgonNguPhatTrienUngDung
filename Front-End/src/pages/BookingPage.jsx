import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { API_BASE } from '../api'

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

// 2D Adjacency Check (BFS)
function checkAdjacency(selectedSeats) {
    if (selectedSeats.size <= 1) return true;
    
    const array = Array.from(selectedSeats);
    const visited = new Set();
    const queue = [array[0]];
    visited.add(array[0]);

    while (queue.length > 0) {
        const curr = queue.shift();
        const r = curr.charAt(0);
        const c = parseInt(curr.substring(1));

        const neighbors = [
            `${String.fromCharCode(r.charCodeAt(0) - 1)}${c}`,
            `${String.fromCharCode(r.charCodeAt(0) + 1)}${c}`,
            `${r}${c - 1}`,
            `${r}${c + 1}`
        ];

        for (const n of neighbors) {
            if (selectedSeats.has(n) && !visited.has(n)) {
                visited.add(n);
                queue.push(n);
            }
        }
    }
    return visited.size === selectedSeats.size;
}

export default function BookingPage() {
    const { showtimeId } = useParams()
    const navigate = useNavigate()
    const [seatmap, setSeatmap] = useState(null)
    const [selected, setSelected] = useState(new Set())
    const [err, setErr] = useState('')
    const [socket, setSocket] = useState(null)
    const [timeLeft, setTimeLeft] = useState(null)
    const [user, setUser] = useState(null)

    // Fetch Seat Map & User Session
    const fetchData = async () => {
        try {
            const [smRes, userRes] = await Promise.all([
                fetch(`${API_BASE}/api/bookings/showtimes/${showtimeId}/seatmap`, { credentials: 'include' }),
                fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
            ]);
            
            const smData = await smRes.json();
            if (!smRes.ok) throw new Error(smData.error || 'Lỗi tải sơ đồ');
            setSeatmap(smData);

            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData.user);
            }
        } catch (e) {
            setErr(e.message);
        }
    }

    useEffect(() => {
        fetchData()
    }, [showtimeId])

    // Timer Logic
    useEffect(() => {
        if (selected.size === 0) {
            setTimeLeft(null);
            return;
        }
        if (timeLeft === null) {
            setTimeLeft((seatmap?.holdMinutes || 5) * 60);
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    alert("Hết thời gian giữ ghế! Các ghế đã chọn sẽ bị giải phóng.");
                    window.location.reload();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [selected.size, seatmap]);

    // Socket.IO Connection
    useEffect(() => {
        const s = io(API_BASE, { withCredentials: true })
        setSocket(s)

        s.emit('join-showtime', showtimeId)

        s.on('seat-status-updated', () => {
            fetchData();
        })

        s.on('error', (data) => {
            alert(data.message);
        })

        return () => {
            s.disconnect()
        }
    }, [showtimeId])

    const occupied = useMemo(() => new Set(seatmap?.occupiedSeats || []), [seatmap])
    const myBooked = useMemo(() => new Set(seatmap?.myBookedSeats || []), [seatmap])

    const rows = useMemo(() => {
        if (!seatmap) return []
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
        return chars.slice(0, seatmap.rows || 10)
    }, [seatmap])

    const cols = useMemo(() => {
        if (!seatmap) return []
        return Array.from({ length: seatmap.cols || 10 }, (_, i) => i + 1)
    }, [seatmap])

    const bestArea = useMemo(() => {
        if (!seatmap || !rows.length || !cols.length) return null
        return {
            rowStart: Math.floor(rows.length * 0.3),
            rowEnd: Math.floor(rows.length * 0.75),
            colStart: Math.floor(cols.length * 0.25),
            colEnd: Math.floor(cols.length * 0.75),
        }
    }, [seatmap, rows, cols])

    const isTooLate = useMemo(() => {
        if (!seatmap?.showtime) return false;
        const start = new Date(seatmap.showtime.start_time).getTime();
        const now = Date.now();
        const fifteenMins = 15 * 60 * 1000;
        return now > (start - fifteenMins);
    }, [seatmap]);

    function toggle(seat) {
        if (!user) {
            alert("Vui lòng đăng nhập để chọn ghế.");
            return;
        }
        if (isTooLate) {
            alert("Đã quá thời gian đặt vé trực tuyến cho suất chiếu này.");
            return;
        }

        const isSel = selected.has(seat)
        if (occupied.has(seat) && !isSel) return

        if (!isSel && selected.size >= 8) {
            alert("Bạn không được giữ quá 8 ghế cùng lúc.");
            return;
        }

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

    function handleNext() {
        if (selected.size === 0) return;

        // Final local validation: Connected block check
        if (!checkAdjacency(selected)) {
            alert("Các ghế được chọn phải nằm cạnh nhau (tạo thành một khối liên tục).");
            return;
        }

        // Lone seat check for each involved row
        const rowsInSel = [...new Set(Array.from(selected).map(s => s.charAt(0)))];
        for (const r of rowsInSel) {
            const selCols = Array.from(selected).filter(s => s.startsWith(r)).map(s => parseInt(s.substring(1)));
            const occCols = Array.from(occupied).filter(s => s.startsWith(r) && !selected.has(s)).map(s => parseInt(s.substring(1)));
            if (checkLoneSeat(r, selCols, occCols, seatmap.cols || 10)) {
                alert(`Không được để ghế trống đơn lẻ ở hàng ${r}.`);
                return;
            }
        }

        const st = seatmap.showtime
        const price = Number(st.price || 0)
        navigate('/checkout', {
            state: {
                showtimeId: Number(showtimeId),
                seats: Array.from(selected),
                showtime: st,
                pricePerSeat: price,
                totalAmount: selected.size * price,
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

            {timeLeft !== null && (
                <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', 
                    background: timeLeft < 60 ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.05)', 
                    borderRadius: 16, marginBottom: 24, border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <i className="fa-regular fa-clock" style={{ color: timeLeft < 60 ? '#e50914' : '#888' }}></i>
                    <span style={{ fontSize: 13, color: '#aaa' }}>Thời gian giữ ghế còn lại:</span>
                    <strong style={{ fontSize: 16, color: timeLeft < 60 ? '#e50914' : '#fff' }}>
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </strong>
                </div>
            )}

            <div className="card-pele" style={{ padding: '60px 20px 40px', background: 'rgba(20, 20, 23, 0.7)', backdropFilter: 'blur(30px)', borderRadius: 32, border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
                
                {isTooLate && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
                        <div className="card-pele" style={{ padding: '24px 32px' }}>
                            <i className="fa-solid fa-hourglass-end" style={{ fontSize: 40, color: '#e50914', marginBottom: 16 }}></i>
                            <h3 style={{ margin: 0 }}>Hết giờ đặt vé</h3>
                            <p className="muted" style={{ margin: '8px 0 0' }}>Suất chiếu đã bắt đầu hoặc quá gần giờ chiếu để đặt trực tuyến.</p>
                        </div>
                    </div>
                )}

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
                    {bestArea && (
                        <div style={{ position: 'absolute', gridRow: `${bestArea.rowStart + 1} / ${bestArea.rowEnd + 2}`, gridColumn: `${bestArea.colStart + 2} / ${bestArea.colEnd + 3}`, top: -6, left: -6, right: -6, bottom: -6, border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 12, pointerEvents: 'none' }}></div>
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
                                        disabled={isOcc || isMine || isTooLate}
                                        style={{
                                            width: 36, height: 36, fontSize: 11, borderRadius: 10,
                                            border: isMine ? '1.5px solid #4caf50' : isSel ? '1.5px solid #e50914' : isOcc ? '1px solid #222' : '1px solid #2a2a2e',
                                            background: isMine ? 'rgba(76, 175, 80, 0.15)' : isSel ? '#e50914' : isOcc ? '#16161a' : 'rgba(255,255,255,0.02)',
                                            color: isMine ? '#4caf50' : isOcc ? '#333' : '#eee',
                                            cursor: (isOcc || isMine || isTooLate) ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                            boxShadow: isSel ? '0 0 25px rgba(229, 9, 20, 0.5)' : 'none',
                                            fontWeight: 800, position: 'relative', zIndex: 1,
                                            transform: isSel ? 'scale(1.15)' : 'scale(1)'
                                        }}
                                    >
                                        {isMine ? <i className="fa-solid fa-user-check" /> : isOcc ? <span style={{ opacity: 0.3 }}>×</span> : col}
                                    </button>
                                )
                            })}
                            <div style={{ display: 'flex', alignItems: 'center', color: '#444', fontSize: 14, fontWeight: 800, paddingLeft: 10 }}>{row}</div>
                        </React.Fragment>
                    ))}
                </div>

                <div style={{ position: 'absolute', bottom: 30, right: 40, color: '#333', textAlign: 'center', opacity: 0.6 }}>
                    <i className="fa-solid fa-door-open" style={{ fontSize: 24 }}></i>
                    <p style={{ fontSize: 9, margin: 0 }}>Lối vào</p>
                </div>
                <div style={{ position: 'absolute', bottom: 30, left: 40, color: '#333', textAlign: 'center', opacity: 0.6 }}>
                    <i className="fa-solid fa-door-open" style={{ fontSize: 24, transform: 'scaleX(-1)' }}></i>
                    <p style={{ fontSize: 9, margin: 0 }}>Lối ra</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 70, fontSize: 11, color: '#666', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 40 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 4, border: '1px solid #333' }} /> Ghế trống</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 4, background: '#e50914' }} /> Đang chọn</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 4, background: '#4caf50' }} /> Ghế của bạn</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 4, background: '#16161a' }} /> Đã bán</div>
                </div>
            </div>

            <div style={{ marginTop: 40, display: 'flex', gap: 20, alignItems: 'stretch' }}>
                <div style={{ flex: 1, padding: '20px 30px', background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#666', fontWeight: 800 }}>Đã chọn: {selected.size} ghế</p>
                    <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900, color: '#fff' }}>{(selected.size * Number(st.price || 0)).toLocaleString('vi-VN')} đ</p>
                </div>
                <button 
                    disabled={selected.size === 0 || isTooLate}
                    onClick={handleNext}
                    style={{ 
                        flex: 2, borderRadius: 24, fontSize: 18, fontWeight: 900, background: '#e50914', color: '#fff', border: 'none',
                        opacity: (selected.size > 0 && !isTooLate) ? 1 : 0.4, cursor: (selected.size > 0 && !isTooLate) ? 'pointer' : 'not-allowed',
                        boxShadow: (selected.size > 0 && !isTooLate) ? '0 15px 30px rgba(229, 9, 20, 0.4)' : 'none'
                    }} 
                >
                    Xác nhận đặt vé <i className="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        </main>
    )
}
