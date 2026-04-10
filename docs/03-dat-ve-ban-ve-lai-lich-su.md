# 03 - Các phần liên quan đến Đặt vé & Bán vé lại (kèm lịch sử đặt vé)

Tài liệu này gom các đoạn code liên quan đến:

- Đặt vé: lấy sơ đồ ghế theo showtime, tính trạng thái ghế (đã đặt/đang giữ), xác nhận đặt vé.
- Giữ ghế realtime: Socket.IO hold/release theo showtime.
- Lịch sử đặt vé: API `/api/bookings/me` + Front-End `MyTicketsPage`.
- Bán vé lại (pass): đăng bán theo từng ghế, list chợ pass, huỷ pass, mua pass và tạo booking mới cho người mua.

---

## 1) Back-End: Sơ đồ ghế & đặt vé (`/api/bookings`)

### File: `Back-End/src/routes/bookings.js`

#### A) GET `/api/bookings/showtimes/:id/seatmap` (sơ đồ ghế + dịch vụ + trạng thái ghế)

Vị trí: `Back-End/src/routes/bookings.js` (L13-L45)

```js
router.get(
  '/showtimes/:id/seatmap',
  asyncHandler(async (req, res) => {
    const showtimeId = Number(req.params.id)
    const showtime = await col('showtimes').findOne({ id: showtimeId })
    if (!showtime) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' })

    const [movie, room] = await Promise.all([
      showtime.movie_id != null ? col('movies').findOne({ id: showtime.movie_id }, { projection: { title: 1 } }) : null,
      showtime.room_id != null ? col('rooms').findOne({ id: showtime.room_id }, { projection: { name: 1, total_rows: 1, total_cols: 1 } }) : null,
    ])

    const { bookedSeats, heldSeats, occupiedSeats } = await getSeatStatesForShowtime(showtimeId)
    const products = await col('products')
      .find({ $or: [{ active: true }, { active: { $exists: false } }] }, { projection: { _id: 0 } })
      .sort({ id: -1 })
      .toArray()

    res.json({
      showtime: {
        ...showtime,
        movieTitle: movie?.title || null,
        roomName: room?.name || null,
      },
      rows: room?.total_rows || 10,
      cols: room?.total_cols || 10,
      products,
      occupiedSeats,
      bookedSeats,
      heldSeats,
      holdMinutes: Math.round(SEAT_HOLD_MS / 60000),
    })
  }),
)
```

Giải thích từng dòng:

- **L16**: ép `showtimeId` sang number.
- **L17**: tìm showtime theo id.
- **L18**: nếu không có showtime → 404.
- **L20-L23**: join thêm thông tin movie/room bằng `Promise.all` (tối ưu tốc độ).
- **L25**: gọi service `getSeatStatesForShowtime()` để lấy:
  - `bookedSeats`: ghế đã đặt thành công,
  - `heldSeats`: ghế đang giữ chỗ (PENDING hoặc socket hold),
  - `occupiedSeats`: union của 2 loại trên.
- **L26-L29**: lấy danh sách `products` (dịch vụ) đang active.
- **L31-L44**: trả JSON seatmap gồm:
  - `showtime` có thêm `movieTitle/roomName`,
  - `rows/cols` (fallback 10x10),
  - danh sách `products`,
  - các tập ghế trạng thái,
  - `holdMinutes` = thời gian giữ ghế (từ `SEAT_HOLD_MS`).

#### B) POST `/api/bookings/confirm` (xác nhận đặt vé, tạo booking)

Vị trí: `Back-End/src/routes/bookings.js` (L96-L258) — đây là route trung tâm của đặt vé.

Các ý quan trọng (theo dòng) trong đoạn code:

- **L99-L118**: `zod` schema validate toàn bộ payload: `showtimeId`, `seats`, `seatSocketId`, `promoCode`, thông tin khách, `products`, `paymentMethod`, `returnUrl`.
- **L121-L122**: kiểm tra showtime tồn tại.
- **L124-L127**: lấy `occupiedSeats` và check xung đột ghế (đã đặt/đang giữ) → trả `409`.
- **L129-L140**: nếu có `seatSocketId` thì chặn trường hợp ghế đang bị “giữ” bởi socket khác.
- **L142-L145**: xác định `userId` (có thể null), `paymentMethod`, `status`:
  - VNPAY → `PENDING`
  - CASH → `SUCCESS`
- **L146-L185**: tính tiền server-side:
  - tiền ghế = số ghế × giá showtime,
  - tiền dịch vụ = tổng `unit_price × qty` từ collection `products`.
- **L187-L218**: re-validate promo server-side và tính `promoDiscount` + làm tròn VND.
- **L220-L241**: insert booking vào `bookings` với snapshot đầy đủ (`seat_numbers`, `products`, `promo_*`, `payment_status`...).
- **L243-L255**: nếu `VNPAY` thì gọi nội bộ `/api/payments/vnpay/create` để lấy `paymentUrl`.
- **L257**: nếu CASH thì trả `{ bookingId }` ngay.

---

## 2) Back-End: Trạng thái ghế (booked/held) + thời gian giữ ghế

### File: `Back-End/src/services/showtimeSeatmap.js`

#### Hàm `getSeatStatesForShowtime(showtimeId)`

Vị trí: `Back-End/src/services/showtimeSeatmap.js` (L5-L39)

```js
export const SEAT_HOLD_MS = 5 * 60 * 1000

export async function getSeatStatesForShowtime(showtimeId) {
  const cutoff = Date.now() - SEAT_HOLD_MS
  const rows = await col('bookings')
    .find(
      { showtime_id: showtimeId, status: { $nin: ['FAILED', 'CANCELLED'] } },
      { projection: { seat_numbers: 1, status: 1, booking_time: 1 } },
    )
    .toArray()

  const booked = new Set()
  const held = new Set(getHeldSeatsLive(showtimeId))

  for (const b of rows) {
    const seats = parseSeats(b.seat_numbers || '')
    const st = b.status
    if (st === 'PENDING') {
      const t = b.booking_time ? new Date(b.booking_time).getTime() : 0
      if (t < cutoff) continue
      for (const s of seats) held.add(s)
    } else {
      for (const s of seats) booked.add(s)
    }
  }

  const bookedSeats = uniqueSeats([...booked])
  const heldSeats = uniqueSeats([...held])
  const occupiedSeats = uniqueSeats([...bookedSeats, ...heldSeats])
  return { bookedSeats, heldSeats, occupiedSeats }
}
```

Giải thích từng dòng:

- **L5**: `SEAT_HOLD_MS = 5 phút` dùng cho trạng thái PENDING (VNPay) và giữ chỗ.
- **L12**: `cutoff` = thời điểm trước đó 5 phút; booking PENDING cũ hơn cutoff xem như hết giữ.
- **L13-L18**: query bookings của showtime, loại `FAILED/CANCELLED`, chỉ lấy 3 field cần cho tính ghế.
- **L20**: set `booked` cho ghế đã mua thành công.
- **L21**: set `held` khởi tạo từ các ghế đang được giữ realtime qua socket (in-memory).
- **L23-L33**: duyệt từng booking:
  - **L26**: nếu `PENDING` thì kiểm tra `booking_time` có còn trong thời gian giữ không,
  - **L29**: còn hạn thì add ghế vào `held`,
  - **L31**: các trạng thái khác (SUCCESS/...) thì add vào `booked`.
- **L35-L37**: chuẩn hoá và sort danh sách ghế bằng `uniqueSeats`.

---

## 3) Realtime giữ ghế: Socket.IO

### File: `Back-End/src/socket/seatSocket.js`

Vị trí: `Back-End/src/socket/seatSocket.js` (L8-L47)

```js
export function registerSeatSocket(io, sessionMiddleware) {
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next)
  })

  setInterval(() => cleanupAllExpired(), 30 * 1000).unref?.()

  io.on('connection', (socket) => {
    socket.on('showtime:join', (payload = {}) => {
      const showtimeId = Number(payload.showtimeId)
      if (!Number.isFinite(showtimeId) || showtimeId <= 0) return
      socket.join(roomKey(showtimeId))
      io.to(socket.id).emit('showtime:holds', { showtimeId, holds: getHeldEntriesLive(showtimeId) })
    })

    socket.on('seat:hold', (payload = {}) => {
      const u = socket.request?.session?.user
      const showtimeId = Number(payload.showtimeId)
      const seats = uniqueSeats(payload.seats || [])
      if (!Number.isFinite(showtimeId) || showtimeId <= 0 || !seats.length) return
      holdSeats({ showtimeId, seats, userId: u?.id || 0, socketId: socket.id })
      io.to(roomKey(showtimeId)).emit('showtime:holds', { showtimeId, holds: getHeldEntriesLive(showtimeId) })
    })

    socket.on('seat:release', (payload = {}) => {
      const u = socket.request?.session?.user
      const showtimeId = Number(payload.showtimeId)
      const seats = uniqueSeats(payload.seats || [])
      if (!Number.isFinite(showtimeId) || showtimeId <= 0 || !seats.length) return
      releaseSeats({ showtimeId, seats, userId: u?.id || 0, socketId: socket.id })
      io.to(roomKey(showtimeId)).emit('showtime:holds', { showtimeId, holds: getHeldEntriesLive(showtimeId) })
    })

    socket.on('disconnect', () => {
      releaseAllForSocket(socket.id)
    })
  })
}
```

Giải thích từng dòng:

- **L9-L12**: dùng chung `express-session` cho socket (để đọc `socket.request.session.user`).
- **L15**: cleanup holds hết hạn mỗi 30 giây (tránh rò rỉ bộ nhớ).
- **L18-L23**: client join “phòng” theo showtime và server gửi ngay danh sách hold hiện tại.
- **L25-L32**: event giữ ghế:
  - validate showtimeId và danh sách ghế,
  - gọi `holdSeats`,
  - broadcast lại `showtime:holds` cho cả room.
- **L34-L41**: event trả ghế tương tự.
- **L43-L45**: khi disconnect thì trả tất cả ghế đã giữ theo socket id.

---

## 4) Lịch sử đặt vé (booking history)

### Back-End: GET `/api/bookings/me`

Vị trí: `Back-End/src/routes/bookings.js` (L261-L296)

Ý chính theo dòng:

- **L263**: `requireAuth` bắt buộc đăng nhập.
- **L266-L269**: query bookings theo `user_id` và `status: 'SUCCESS'`, sort mới nhất.
- **L270-L293**: join showtime/movie/room để Front-End hiển thị `movieTitle`, `posterUrl`, `roomName`, `start_time`.

### Front-End: `MyTicketsPage.jsx` hiển thị lịch sử + tạo QR theo ghế

File: `Front-End/src/pages/MyTicketsPage.jsx`

Đoạn gọi lịch sử vé:

- Vị trí (L13-L17): fetch `/api/bookings/me` rồi set `bookings`.

Đoạn lấy pass đang rao bán để “chặn tạo QR”:

- Vị trí (L18-L34): fetch `/api/ticket-passes?filter=my`, tạo map `selling[bookingId][seat]=true`.

---

## 5) Bán vé lại (Ticket Pass)

### File: `Back-End/src/routes/ticketPasses.js`

#### A) GET `/api/ticket-passes` (chợ pass, filter theo keyword / my)

Vị trí: `Back-End/src/routes/ticketPasses.js` (L58-L117)

Ý chính theo dòng:

- **L69-L82**: `filter=my` → trả pass của người bán đang `AVAILABLE/LOCKED`, chưa hết hạn.
- **L84-L102**: tìm theo keyword (tên phim) nhưng vẫn chỉ lấy pass khả dụng (LOCKED quá hạn sẽ coi như AVAILABLE).
- **L104-L116**: list pass khả dụng không filter.

#### B) POST `/api/ticket-passes` (đăng bán pass theo ghế)

Vị trí: `Back-End/src/routes/ticketPasses.js` (L156-L227)

Ý chính theo dòng:

- **L158**: `requireAuth` bắt buộc đăng nhập.
- **L160-L166**: validate body: `bookingId`, `seats[]`, `passPrice`.
- **L170-L177**: kiểm tra booking tồn tại, thuộc về seller, và booking `SUCCESS`.
- **L178-L182**: kiểm tra ghế đăng bán phải thuộc booking gốc.
- **L183-L192**: chặn đăng trùng ghế đã/đang rao bán.
- **L194-L223**: tạo document pass cho từng ghế: `status: 'AVAILABLE'`, kèm `expire_at` theo `showtime.start_time`.

#### C) POST `/api/ticket-passes/:id/buy` (mua pass)

Vị trí: `Back-End/src/routes/ticketPasses.js` (L229-L337)

Ý chính theo dòng:

- **L246-L248**: chỉ cho mua khi pass `AVAILABLE`.
- **L249**: chặn tự mua pass của chính mình.
- **L251-L259**: check hết hạn.
- **L261-L273**: check ví người mua đủ tiền.
- **L280-L287**: “lock pass” bằng `findOneAndUpdate` để tránh race condition.
- **L301-L305**: trừ tiền buyer, cộng tiền seller (wallet).
- **L306-L329**: tách booking:
  - update booking seller bỏ ghế vừa bán,
  - tạo booking mới `booking_type: 'PASS'` cho buyer với 1 ghế.
- **L331-L334**: update pass → `SOLD`, gắn `buyer_booking_id`.

### Front-End: Đăng bán pass và xem chợ

- `Front-End/src/pages/TicketPostPage.jsx`
  - **L42-L45**: load `/api/bookings/me` để chọn vé (booking) và ghế.
  - **L89-L93**: POST `/api/ticket-passes` để đăng bán.

- `Front-End/src/pages/TicketMarketPage.jsx`
  - **L25-L29**: GET `/api/ticket-passes?keyword=...` để list pass theo tên phim.

- `Front-End/src/pages/MyPassesPage.jsx`
  - **L17-L20**: GET `/api/ticket-passes/me/list` để list pass của mình.
  - **L33-L38**: POST `/api/ticket-passes/:id/cancel` để huỷ đăng bán.

