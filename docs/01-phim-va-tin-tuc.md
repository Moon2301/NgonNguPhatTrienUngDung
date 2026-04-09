# 01 - Các phần liên quan đến Phim & Tin tức mới

Tài liệu này gom các đoạn code liên quan đến:

- Phim: lấy danh sách phim, lọc theo từ khoá/thể loại, phim sắp chiếu, chi tiết phim + suất chiếu.
- Tin tức: danh sách tin tức đang active, chi tiết 1 bài tin.
- Front-End: gọi API và hiển thị Movie Detail / News list / News detail.

---

## 1) Back-End: API Phim (`/api/movies`)

### File: `Back-End/src/routes/movies.js`

#### A) GET `/api/movies/upcoming` (phim sắp chiếu)

Vị trí: `Back-End/src/routes/movies.js` (L8-L18)

```js
router.get(
  '/upcoming',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const rows = await col('movies')
      .find({ release_date: { $type: 'date', $gt: now } })
      .sort({ release_date: 1 })
      .toArray()
    res.json({ movies: rows.map(toId) })
  }),
)
```

Giải thích từng dòng:

- **L8**: đăng ký route HTTP GET trên router Express.
- **L9**: path con là `'/upcoming'` (khi mount vào `/api/movies` sẽ thành `/api/movies/upcoming`).
- **L10**: bọc handler bằng `asyncHandler` để bắt lỗi async và đẩy sang middleware lỗi.
- **L11**: tạo mốc thời gian hiện tại để so sánh ngày phát hành.
- **L12**: lấy collection MongoDB tên `movies`.
- **L13**: query phim có `release_date` là kiểu `date` và lớn hơn `now`.
- **L14**: sort tăng dần theo `release_date` (phim gần ra rạp đứng trước).
- **L15**: convert cursor → mảng.
- **L16**: trả JSON, map qua `toId` để chuẩn hoá id trả về.
- **L17-L18**: kết thúc handler và route.

#### B) GET `/api/movies` (danh sách phim + filter)

Vị trí: `Back-End/src/routes/movies.js` (L20-L50)

```js
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      genre: z.string().optional(),
      keyword: z.string().optional(),
    })
    const { genre, keyword } = schema.parse(req.query)

    if (keyword && keyword.trim()) {
      const q = String(keyword).trim()
      const rows = await col('movies')
        .find({ title: { $regex: q, $options: 'i' } })
        .sort({ id: -1 })
        .toArray()
      return res.json({ movies: rows.map(toId) })
    }

    if (genre && genre.trim()) {
      const g = String(genre).trim()
      const rows = await col('movies')
        .find({ genre: { $regex: g, $options: 'i' } })
        .sort({ id: -1 })
        .toArray()
      return res.json({ movies: rows.map(toId) })
    }

    const rows = await col('movies').find({}).sort({ id: -1 }).toArray()
    return res.json({ movies: rows.map(toId) })
  }),
)
```

Giải thích từng dòng:

- **L20-L22**: tạo route GET `/` với handler async.
- **L23-L26**: dùng `zod` định nghĩa schema cho query string (cho phép `genre`, `keyword`).
- **L27**: parse/validate `req.query` để tránh dữ liệu “rác”.
- **L29**: nhánh filter theo `keyword` nếu có.
- **L30**: chuẩn hoá keyword thành string và trim.
- **L31-L34**: tìm phim theo `title` với regex, `i` = không phân biệt hoa thường; sort theo `id` giảm dần.
- **L35**: trả về luôn (return) danh sách phim đã map `toId`.
- **L38**: nhánh filter theo `genre` tương tự keyword.
- **L39-L44**: tìm phim theo `genre` bằng regex và trả JSON.
- **L47-L48**: nếu không filter gì thì trả toàn bộ phim, sort `id` giảm dần.
- **L49-L50**: kết thúc route.

#### C) GET `/api/movies/:id` (chi tiết phim + suất chiếu)

Vị trí: `Back-End/src/routes/movies.js` (L52-L69)

```js
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const movie = await col('movies').findOne({ id })
    if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim.' })

    const showtimes = await col('showtimes').find({ movie_id: id }).sort({ start_time: 1 }).toArray()
    const roomIds = [...new Set(showtimes.map((s) => s.room_id).filter((x) => x != null))]
    const rooms = roomIds.length
      ? await col('rooms').find({ id: { $in: roomIds } }, { projection: { id: 1, name: 1 } }).toArray()
      : []
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]))
    const stOut = showtimes.map((s) => ({ ...toId(s), roomName: roomMap.get(s.room_id) || null }))

    return res.json({ movie: toId(movie), showtimes: stOut })
  }),
)
```

Giải thích từng dòng:

- **L52-L54**: route GET theo tham số `:id`.
- **L55**: ép `req.params.id` sang số để query theo field `id` dạng number.
- **L56**: tìm 1 phim theo `{ id }` trong collection `movies`.
- **L57**: nếu không có phim → 404.
- **L59**: lấy các suất chiếu của phim (`showtimes` có `movie_id`), sort thời gian tăng dần.
- **L60**: gom danh sách `room_id` duy nhất, bỏ null/undefined.
- **L61-L63**: nếu có roomIds thì query `rooms` lấy `id` và `name`, ngược lại trả mảng rỗng.
- **L64**: tạo map `roomId -> roomName` để join dữ liệu nhanh.
- **L65**: tạo output `stOut` = showtime đã `toId` và gắn thêm `roomName`.
- **L67**: trả JSON gồm `movie` và `showtimes`.

---

## 2) Back-End: API Tin tức (`/api/news`)

### File: `Back-End/src/routes/news.js`

#### A) GET `/api/news` (danh sách tin active)

Vị trí: `Back-End/src/routes/news.js` (L7-L22)

```js
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await col('news')
      .find({ active: true }, { projection: { _id: 0 } })
      .sort({ published_at: -1, id: -1 })
      .toArray()
    res.json({
      news: rows.map((n) => ({
        ...n,
        imageUrl: n.image_url ?? n.imageUrl ?? null,
        publishedAt: n.published_at ?? n.publishedAt ?? null,
      })),
    })
  }),
)
```

Giải thích từng dòng:

- **L7-L9**: route GET `/api/news`.
- **L10**: lấy collection `news`.
- **L11**: chỉ lấy bài `active: true`, và bỏ `_id` khi trả về.
- **L12**: sort theo `published_at` giảm dần, fallback theo `id` giảm dần.
- **L13**: cursor → array.
- **L14-L20**: trả JSON, đồng thời chuẩn hoá field theo 2 kiểu naming (`snake_case` vs `camelCase`) để Front-End dùng ổn định:
  - **L17**: `imageUrl` lấy từ `image_url` hoặc `imageUrl`.
  - **L18**: `publishedAt` lấy từ `published_at` hoặc `publishedAt`.

#### B) GET `/api/news/:id` (chi tiết tin)

Vị trí: `Back-End/src/routes/news.js` (L24-L38)

```js
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const article = await col('news').findOne({ id, active: true }, { projection: { _id: 0 } })
    if (!article) return res.status(404).json({ error: 'Không tìm thấy tin.' })
    res.json({
      article: {
        ...article,
        imageUrl: article.image_url ?? article.imageUrl ?? null,
        publishedAt: article.published_at ?? article.publishedAt ?? null,
      },
    })
  }),
)
```

Giải thích từng dòng:

- **L27**: ép `:id` sang number.
- **L28**: chỉ trả bài active, bỏ `_id`.
- **L29**: nếu không tồn tại → 404.
- **L30-L36**: trả `article` với chuẩn hoá field tương tự list.

---

## 2.1) Back-End: Admin thêm/sửa/xóa cho Phim & Tin tức (`/api/admin`)

Các API này dành cho admin, được chặn bởi `requireAdmin` trong `Back-End/src/routes/admin.js`.

### A) Admin Phim

- **GET `/api/admin/movies`**: xem danh sách phim để quản trị.
- **POST `/api/admin/movies`**: thêm/sửa phim
  - **có** `id` trong body → **sửa**
  - **không có** `id` → **thêm mới**
- **DELETE `/api/admin/movies/:id`**: xóa phim.

### B) Admin Tin tức

- **GET `/api/admin/news`**: xem danh sách tin (bao gồm cả inactive) để quản trị.
- **POST `/api/admin/news`**: thêm/sửa tin
  - **có** `id` trong body → **sửa**
  - **không có** `id` → **thêm mới**
- **DELETE `/api/admin/news/:id`**: xóa tin.

## 3) Front-End: Trang chi tiết phim, tin tức

### A) Movie Detail gọi API phim + bình luận + điều hướng đặt vé

File: `Front-End/src/pages/MovieDetailPage.jsx`

#### Đoạn fetch chi tiết phim `/api/movies/:id`

Vị trí: `Front-End/src/pages/MovieDetailPage.jsx` (L21-L30)

```js
useEffect(() => {
  fetch(`${API_BASE}/api/movies/${id}`, { credentials: 'include' })
    .then(async (r) => {
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Lỗi')
      return d
    })
    .then(setData)
    .catch((e) => setErr(e.message))
}, [id])
```

Giải thích từng dòng:

- **L21**: `useEffect` chạy khi `id` thay đổi.
- **L22**: gọi API BE; `credentials: 'include'` để gửi cookie session nếu có.
- **L23-L27**: parse JSON; nếu HTTP không OK thì ném lỗi để rơi vào `catch`.
- **L28**: set state `data` = payload `{ movie, showtimes }`.
- **L29**: set lỗi nếu fail.
- **L30**: dependency là `[id]`.

#### Đoạn nhóm suất chiếu theo ngày và điều hướng `/booking/:showtimeId`

Vị trí: `Front-End/src/pages/MovieDetailPage.jsx` (L59-L76 và L122-L146)

Giải thích ý chính theo từng dòng quan trọng:

- **L59-L72**: tạo `groups` dạng `Map<yyyy-mm-dd, showtime[]>`, sau đó sort showtime theo `start_time`.
- **L74-L76**: lấy danh sách ngày và chọn ngày đang active.
- **L122-L146**: render các showtime của ngày được chọn; mỗi button click:
  - **L129**: `navigate(`/booking/${s.id}`)` → đi sang màn chọn ghế.

### B) Tin tức list và detail

#### News list gọi `/api/news`

File: `Front-End/src/pages/NewsPage.jsx` (L8-L12)

```js
useEffect(() => {
  fetch(`${API_BASE}/api/news`, { credentials: 'include' })
    .then((r) => r.json())
    .then((d) => setList(d.news || []))
}, [])
```

Giải thích từng dòng:

- **L8**: chỉ chạy 1 lần khi mount (dependency `[]`).
- **L9**: gọi API list tin.
- **L10**: parse JSON.
- **L11**: set `list` từ `d.news`.

#### News detail gọi `/api/news/:id`

File: `Front-End/src/pages/NewsDetailPage.jsx` (L11-L20)

```js
useEffect(() => {
  fetch(`${API_BASE}/api/news/${id}`, { credentials: 'include' })
    .then(async (r) => {
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Lỗi')
      return d.article
    })
    .then(setArticle)
    .catch(() => setErr('Lỗi tải'))
}, [id])
```

Giải thích từng dòng:

- **L12**: gọi API chi tiết theo `id`.
- **L13-L17**: bắt lỗi nếu response không OK.
- **L18**: set `article`.
- **L19**: set error message.
- **L20**: chạy lại khi `id` thay đổi.

