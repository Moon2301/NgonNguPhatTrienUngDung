# 06 - Các phần liên quan đến Auth/Profile & Cấu hình còn lại

Tài liệu này gom các đoạn code liên quan đến:

- Auth (đăng ký/đăng nhập/đăng xuất/lấy user hiện tại).
- Profile (xem/cập nhật hồ sơ).
- Middleware phân quyền (`requireAuth`, `requireAdmin`).
- Cấu hình server: CORS, session cookie, mount routes, Socket.IO share session.
- Cấu hình Front-End: AuthProvider, RequireAuth/RequireAdmin, router.
- Các util nền: `asyncHandler`, `db.js`, `api.js`, `.env.example`.

---

## 1) Back-End: Auth API (`/api/auth`)

### File: `Back-End/src/routes/auth.js`

#### A) GET `/api/auth/me` (lấy user từ session)

Vị trí: `Back-End/src/routes/auth.js` (L9-L11)

```js
router.get('/me', (req, res) => {
  res.json({ user: req.session?.user || null })
})
```

Giải thích từng dòng:

- **L9**: route GET `/me`.
- **L10**: trả `user` từ session nếu có, nếu không trả `null`.
- **L11**: kết thúc handler.

#### B) POST `/api/auth/register` (đăng ký + tự login)

Vị trí: `Back-End/src/routes/auth.js` (L13-L64)

Các bước theo dòng:

- **L16-L22**: validate body bằng `zod` (`username/password/email/fullName/phone`).
- **L25-L31**: check trùng `username` hoặc `email` trong collection `users` → 409.
- **L33**: hash password bằng `bcrypt.hash(..., 10)`.
- **L36-L47**: tạo document user:
  - `id` dùng `nextId('users')`,
  - lưu `passwordHash`,
  - khởi tạo `role: 'USER'`, `wallet: 0`, `createdAt`.
- **L49**: insert vào DB.
- **L51-L60**: set `req.session.user` (đây là “đăng nhập” ngay sau khi đăng ký).
- **L62**: trả 201 + user session.

#### C) POST `/api/auth/login`

Vị trí: `Back-End/src/routes/auth.js` (L66-L98)

Các bước theo dòng:

- **L69-L73**: validate body `username/password`.
- **L75-L83**:
  - tìm user theo `username`,
  - chặn nếu không có user hoặc mật khẩu sai (401),
  - chặn nếu `is_blocked` (403).
- **L82-L83**: `bcrypt.compare` để check password.
- **L85-L95**: set `req.session.user` từ dữ liệu DB và trả JSON.

#### D) POST `/api/auth/logout`

Vị trí: `Back-End/src/routes/auth.js` (L100-L103)

```js
router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ success: true })
  req.session.destroy(() => res.json({ success: true }))
})
```

Giải thích từng dòng:

- Nếu session không tồn tại thì vẫn trả success (idempotent).
- Nếu có session thì `destroy()` để xoá session server-side.

---

## 2) Back-End: Profile API (`/api/profile`)

### File: `Back-End/src/routes/profile.js`

#### A) GET `/api/profile` (xem hồ sơ)

Vị trí: `Back-End/src/routes/profile.js` (L9-L21)

Ý chính theo dòng:

- **L11**: `requireAuth` bắt login.
- **L13**: lấy `userId` từ session.
- **L14-L17**: query `users` và loại `passwordHash`.
- **L18**: không có user → 404.
- **L19**: trả `{ profile: u }`.

#### B) PUT `/api/profile` (cập nhật hồ sơ + sync session)

Vị trí: `Back-End/src/routes/profile.js` (L23-L68)

Các bước theo dòng:

- **L25**: `requireAuth`.
- **L29-L35**: validate payload (`fullName/age/phone/email`).
- **L37-L43**: tạo `$set` để update DB, kèm `updatedAt`.
- **L45-L50**: check email unique (cho phép “self”, chặn trùng email của user khác) → 409.
- **L52**: update user.
- **L56-L64**: cập nhật `req.session.user` để Front-End refresh nhanh (không phải logout/login).
- **L66**: trả `{ profile, user }`.

---

## 3) Back-End: Middleware phân quyền

### File: `Back-End/src/middleware/requireAuth.js`

Vị trí: `Back-End/src/middleware/requireAuth.js` (L1-L11)

```js
export function requireAuth(req, res, next) {
  if (req.session?.user) return next()
  return res.status(401).json({ error: 'Bạn cần đăng nhập.' })
}

export function requireAdmin(req, res, next) {
  const u = req.session?.user
  if (!u) return res.status(401).json({ error: 'Bạn cần đăng nhập.' })
  if (u.role !== 'ADMIN') return res.status(403).json({ error: 'Bạn không có quyền.' })
  return next()
}
```

Giải thích từng dòng:

- `requireAuth`: chỉ cần có `req.session.user`.
- `requireAdmin`: cần login và `role === 'ADMIN'`.

---

## 4) Back-End: Cấu hình server, session, mount routes, Socket.IO

### File: `Back-End/src/server.js`

#### A) CORS allowlist + credentials

Vị trí: `Back-End/src/server.js` (L28-L44)

Ý chính theo dòng:

- **L30-L43**: CORS bật `credentials:true` và kiểm origin theo `CLIENT_ORIGIN` (comma-separated) + allow localhost dev.

#### B) Session middleware

Vị trí: `Back-End/src/server.js` (L46-L61)

```js
export const sessionMiddleware = session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
})

app.use(sessionMiddleware)
```

Giải thích từng dòng:

- `name:'sid'`: tên cookie session.
- `secret`: khoá ký session.
- `httpOnly`: JS FE không đọc cookie (an toàn hơn).
- `sameSite/secure`: cấu hình theo env để chạy production.
- `maxAge`: sống 7 ngày.

#### C) Mount routes

Vị trí: `Back-End/src/server.js` (L66-L79)

Ý chính:

- `app.use('/api/auth', authRoutes)` …
- `app.use('/api/profile', profileRoutes)` …
- Các route khác được mount tương tự.

#### D) Socket.IO share session

Vị trí: `Back-End/src/server.js` (L116) và `Back-End/src/socket/seatSocket.js` (share session).

- **server.js L116**: `registerSeatSocket(io, sessionMiddleware)` để socket đọc được `socket.request.session.user`.

---

## 5) Front-End: AuthProvider + RequireAuth/RequireAdmin + Router

### A) Bọc Provider ở root

File: `Front-End/src/main.jsx` (L9-L18)

```jsx
<BrowserRouter>
  <UiProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </UiProvider>
</BrowserRouter>
```

Giải thích từng dòng:

- Router nằm ngoài để các page dùng `useNavigate`.
- `UiProvider` cung cấp toast/confirm/prompt.
- `AuthProvider` tự gọi `/api/auth/me` để biết user hiện tại.

### B) AuthProvider gọi `/api/auth/me` và cung cấp login/register/logout

File: `Front-End/src/context/AuthContext.jsx` (L9-L54)

Các bước theo dòng:

- **L9-L19**: `refresh()` fetch `/api/auth/me`, set `user`, set `loading:false`.
- **L21-L23**: gọi `refresh()` khi app mount.
- **L25-L36**: `login()` POST `/api/auth/login`, nếu ok thì set `user`.
- **L38-L49**: `register()` POST `/api/auth/register`, nếu ok thì set `user`.
- **L51-L54**: `logout()` POST `/api/auth/logout`, set `user:null`.

### C) Chặn route cần đăng nhập/quyền admin

File: `Front-End/src/components/RequireAuth.jsx` (L4-L28)

Ý chính theo dòng:

- Nếu `loading` thì render “đang kiểm tra”.
- Nếu `!user`:
  - redirect `/error?code=401&from=...`
- Nếu admin:
  - check `user.role !== 'ADMIN'` → redirect 403.

### D) Router map các route và bọc RequireAuth/RequireAdmin

File: `Front-End/src/App.jsx` (L55-L154)

Ví dụ:

- **L55-L62**: `/my-tickets` bọc `RequireAuth`.
- **L91-L97**: `/admin` bọc `RequireAdmin`.

---

## 6) Util nền & cấu hình môi trường

### A) asyncHandler

File: `Back-End/src/utils/asyncHandler.js` (L1-L3)

```js
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
```

Giải thích từng dòng:

- Wrap function async để mọi lỗi `.catch(next)` đi vào middleware error của Express.

### B) DB helper & auto-increment id

File: `Back-End/src/db.js` (L22-L51)

Ý chính:

- `connectMongo()` kết nối Mongo.
- `col(name)` trả collection.
- `nextId(seqName)` dùng collection `counters` để tăng `seq` giống auto-increment.

### C) Front-End API base + helper fetch

File: `Front-End/src/api.js` (L1-L19)

```js
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}
```

Giải thích từng dòng:

- `API_BASE`: lấy từ env Vite hoặc fallback localhost.
- `credentials:'include'`: luôn gửi cookie session.
- Nếu HTTP fail thì throw để page bắt lỗi.

### D) `.env.example` (các biến cấu hình chính)

File: `Back-End/.env.example` (L1-L21)

Nhóm biến đáng chú ý:

- **PORT/CLIENT_ORIGIN**: cấu hình server + CORS.
- **SESSION_SECRET**: khoá session.
- **VNPay**: `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`, ...
- **TICKET_HASH_CODE**: secret tạo mã QR vé (không nên commit giá trị thật).

