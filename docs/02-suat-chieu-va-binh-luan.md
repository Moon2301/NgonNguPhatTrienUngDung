# 02 - Các phần liên quan đến Suất chiếu & Bình luận

Tài liệu này gom các đoạn code liên quan đến:

- Suất chiếu: API list suất chiếu, join tên phim và phòng.
- Bình luận: list bình luận theo phim, tạo bình luận (cần đăng nhập).
- Front-End: MovieDetail hiển thị suất chiếu + gọi API bình luận + gửi bình luận.

---

## 1) Back-End: API Suất chiếu (`/api/showtimes`)

### File: `Back-End/src/routes/showtimes.js`

#### GET `/api/showtimes?movieId=...` (list suất chiếu, có thể lọc theo movieId)

Vị trí: `Back-End/src/routes/showtimes.js` (L8-L37)

```js
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      movieId: z.coerce.number().optional(),
    })
    const { movieId } = schema.parse(req.query)

    const match = movieId != null ? { movie_id: movieId } : {}
    const showtimes = await col('showtimes').find(match).sort({ start_time: 1 }).toArray()

    const movieIds = [...new Set(showtimes.map((s) => s.movie_id).filter((x) => x != null))]
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]

    const [movies, rooms] = await Promise.all([
      movieIds.length ? col('movies').find({ id: { $in: movieIds } }, { projection: { id: 1, title: 1 } }).toArray() : [],
      roomIds.length ? col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray() : [],
    ])

    const movieMap = new Map(movies.map((m) => [m.id, m.title]))
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]))

    const rows = showtimes.map((s) => ({
      ...toId(s),
      movieTitle: movieMap.get(s.movie_id) || null,
      roomName: roomMap.get(s.room_id) || null,
    }))

    res.json({ showtimes: rows })
  }),
)
```

Giải thích từng dòng:

- **L8-L10**: tạo route GET `/api/showtimes`.
- **L11-L13**: schema query cho `movieId`, dùng `z.coerce.number()` để nhận string `"123"` và ép sang number.
- **L14**: parse query.
- **L16**: tạo điều kiện lọc `match`: nếu có `movieId` thì lọc theo `movie_id`, nếu không thì `{}` = tất cả.
- **L17**: query `showtimes` theo `match`, sort theo `start_time` tăng dần.
- **L19-L20**: lấy danh sách `movie_id` và `room_id` duy nhất để join.
- **L22-L25**: `Promise.all` để query movies và rooms song song, chỉ lấy projection cần thiết.
- **L27-L28**: tạo map để tra nhanh:
  - `movieId -> title`
  - `roomId -> name`
- **L30-L34**: map showtime ra output có thêm `movieTitle` và `roomName`.
- **L36**: trả JSON `{ showtimes: rows }`.

---

## 2) Back-End: API Bình luận (`/api/comments`)

### File: `Back-End/src/routes/comments.js`

#### A) GET `/api/comments/movie/:movieId` (list bình luận của 1 phim)

Vị trí: `Back-End/src/routes/comments.js` (L9-L34)

```js
router.get(
  '/movie/:movieId',
  asyncHandler(async (req, res) => {
    const movieId = Number(req.params.movieId)
    const comments = await col('comments').find({ movie_id: movieId }).sort({ created_at: -1, id: -1 }).toArray()
    const userIds = [...new Set(comments.map((c) => c.user_id).filter((x) => x != null))]
    const users = userIds.length
      ? await col('users').find({ id: { $in: userIds } }, { projection: { id: 1, username: 1, fullName: 1 } }).toArray()
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))
    res.json({
      comments: comments.map((c) => {
        const u = userMap.get(c.user_id)
        return {
          id: c.id,
          content: c.content,
          rating: c.rating,
          createdAt: c.created_at,
          userId: c.user_id,
          fullName: u?.fullName ?? null,
          username: u?.username ?? null,
        }
      }),
    })
  }),
)
```

Giải thích từng dòng:

- **L12**: ép `movieId` sang number để query.
- **L13**: lấy comments theo `movie_id`, sort mới nhất lên trước (`created_at` giảm dần).
- **L14**: gom user id duy nhất từ comment để join dữ liệu user.
- **L15-L17**: nếu có userIds thì query `users` lấy trường tối thiểu; nếu không có thì `[]`.
- **L18**: tạo `userMap` để lookup nhanh.
- **L19-L32**: trả JSON `comments`, map mỗi comment thành shape thân thiện FE:
  - **L26**: đổi tên field thời gian `created_at` → `createdAt`.
  - **L28-L29**: bổ sung `fullName/username` từ bảng user (có thể null).

#### B) POST `/api/comments` (tạo bình luận, bắt buộc login)

Vị trí: `Back-End/src/routes/comments.js` (L36-L59)

```js
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      movieId: z.coerce.number(),
      content: z.string().min(1).max(5000),
      rating: z.coerce.number().int().min(1).max(5),
    })
    const input = schema.parse(req.body)
    const userId = req.session.user.id

    const id = await nextId('comments')
    await col('comments').insertOne({
      id,
      movie_id: input.movieId,
      user_id: userId,
      content: input.content.trim(),
      rating: input.rating,
      created_at: new Date(),
    })
    res.status(201).json({ id })
  }),
)
```

Giải thích từng dòng:

- **L38**: `requireAuth` chặn người chưa đăng nhập.
- **L40-L44**: validate body:
  - `movieId` ép sang number,
  - `content` không rỗng và giới hạn độ dài,
  - `rating` là số nguyên 1..5.
- **L45**: parse body.
- **L46**: lấy `userId` từ session (đã login).
- **L48**: tạo id tăng dần cho comment.
- **L49-L56**: insert comment vào collection `comments`, lưu `created_at`.
- **L57**: trả 201 kèm id comment vừa tạo.

---

## 3) Front-End: Hiển thị suất chiếu & bình luận trong chi tiết phim

### File: `Front-End/src/pages/MovieDetailPage.jsx`

#### A) Load bình luận từ `/api/comments/movie/:id`

Vị trí: `Front-End/src/pages/MovieDetailPage.jsx` (L32-L36)

```js
useEffect(() => {
  fetch(`${API_BASE}/api/comments/movie/${id}`, { credentials: 'include' })
    .then((r) => r.json())
    .then((d) => setComments(d.comments || []))
}, [id])
```

Giải thích từng dòng:

- **L32**: effect chạy lại khi `id` phim đổi.
- **L33**: gọi API list bình luận; `credentials` để gửi cookie.
- **L34**: parse JSON.
- **L35**: set state `comments`.
- **L36**: dependency `id`.

#### B) Gửi bình luận lên `/api/comments`

Vị trí: `Front-End/src/pages/MovieDetailPage.jsx` (L38-L52)

```js
async function sendComment(e) {
  e.preventDefault()
  if (!user) return
  if (!String(content || '').trim()) return ui.toast.warn('Vui lòng nhập nội dung bình luận.')
  try {
    await apiPost('/api/comments', { movieId: Number(id), content, rating })
    setContent('')
    const r = await fetch(`${API_BASE}/api/comments/movie/${id}`, { credentials: 'include' })
    const d = await r.json()
    setComments(d.comments || [])
    ui.toast.success('Đã gửi bình luận.')
  } catch (er) {
    ui.toast.error(er.message)
  }
}
```

Giải thích từng dòng:

- **L39**: chặn submit mặc định của form.
- **L40**: nếu chưa đăng nhập (`user` null) thì dừng.
- **L41**: validate content không rỗng; nếu rỗng thì toast cảnh báo.
- **L43**: gọi helper `apiPost` để POST comment (FE gửi `movieId`, `content`, `rating`).
- **L44**: clear ô nhập.
- **L45-L47**: reload lại list bình luận mới nhất từ server.
- **L48**: toast thành công.
- **L49-L51**: nếu lỗi thì toast error với message từ exception.

#### C) Điều hướng sang chọn ghế theo showtime

Vị trí: `Front-End/src/pages/MovieDetailPage.jsx` (L122-L146)

Điểm quan trọng:

- **L129**: `navigate(`/booking/${s.id}`)` chuyển sang trang đặt vé theo `showtimeId`.

