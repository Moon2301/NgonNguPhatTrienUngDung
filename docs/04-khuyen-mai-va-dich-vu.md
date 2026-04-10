# 04 - Các phần liên quan đến Khuyến mãi & Dịch vụ

Tài liệu này gom các đoạn code liên quan đến:

- Khuyến mãi (promo): list promo (public), quản trị promo (admin), áp promo khi thanh toán.
- Dịch vụ (products): list service kèm theo trong trang chọn ghế, quản trị products (admin).
- Cách tính tiền dịch vụ + snapshot vào booking.

---

## 1) Khuyến mãi: API public list promo

### File: `Back-End/src/routes/promotions.js`

#### GET `/api/promotions`

Vị trí: `Back-End/src/routes/promotions.js` (L7-L13)

```js
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await col('promotions').find({ active: { $ne: false } }).sort({ id: -1 }).toArray()
    res.json({ promotions: rows.map(toId) })
  }),
)
```

Giải thích từng dòng:

- **L7-L9**: route GET `/api/promotions`.
- **L10**: query promotions mà `active` không phải `false` (tức active hoặc field chưa tồn tại).
- **L10**: sort `id` giảm dần (mới tạo trước).
- **L11**: trả JSON và chuẩn hoá bằng `toId`.

### Front-End hiển thị list promo

File: `Front-End/src/pages/PromotionsPage.jsx` (L6-L10)

```js
useEffect(() => {
  fetch(`${API_BASE}/api/promotions`, { credentials: 'include' })
    .then((r) => r.json())
    .then((d) => setPromotions(d.promotions || []))
}, [])
```

Giải thích từng dòng:

- **L6**: load promo 1 lần khi trang mount.
- **L7**: gọi API `/api/promotions`.
- **L8**: parse JSON.
- **L9**: set state `promotions`.

---

## 2) Áp mã khuyến mãi trong flow đặt vé

### Back-End: POST `/api/bookings/apply-promo`

File: `Back-End/src/routes/bookings.js` (L48-L94)

Đoạn code áp dụng promo:

```js
router.post(
  '/apply-promo',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      code: z.string().min(1),
      originalAmount: z.coerce.number().min(0),
      showtimeId: z.coerce.number().optional(),
    })
    const input = schema.parse(req.body)

    const code = input.code.toUpperCase().trim()
    const now = new Date()
    const promo = await col('promotions').findOne({
      code,
      active: true,
      $or: [{ expires_at: null }, { expires_at: { $gt: now } }],
    })
    if (!promo) {
      return res.json({ success: false, message: 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn!' })
    }

    const limit = promo.usage_limit == null ? null : Number(promo.usage_limit)
    const used = promo.usage_count == null ? 0 : Number(promo.usage_count)
    if (limit != null && Number.isFinite(limit) && limit >= 0 && used >= limit) {
      return res.json({ success: false, message: 'Mã khuyến mãi đã hết lượt sử dụng.' })
    }

    if (promo.showtime_id && input.showtimeId && Number(promo.showtime_id) !== Number(input.showtimeId)) {
      return res.json({ success: false, message: 'Mã này chỉ áp dụng cho suất chiếu cụ thể!' })
    }

    const discountAmount = Number(promo.discount_amount || 0)
    const discountPercent = Number(promo.discount_percent || 0)
    let discount = 0
    if (discountAmount > 0) discount = Math.min(discountAmount, input.originalAmount)
    else if (discountPercent > 0) discount = (input.originalAmount * discountPercent) / 100

    discount = Math.round(discount)

    const newTotal = Math.max(0, Math.round(input.originalAmount - discount))
    const discountText = discountAmount > 0 ? `Giảm ${Math.round(discountAmount)}đ` : `Giảm ${discountPercent}%`

    const remaining = limit != null && Number.isFinite(limit) && limit >= 0 ? Math.max(0, limit - used) : null
    return res.json({ success: true, discount, newTotal, discountText, remaining })
  }),
)
```

Giải thích từng dòng:

- **Schema (code/originalAmount/showtimeId)**: validate đầu vào để FE không gửi sai kiểu.
- **Chuẩn hoá code**: `toUpperCase().trim()` để code luôn cùng format.
- **Query promo**: phải `active: true` và chưa hết hạn (`expires_at` null hoặc > now).
- **Usage limit**: nếu `usage_limit` tồn tại và `usage_count >= usage_limit` thì không cho áp.
- **Promo theo showtime**: nếu promo có `showtime_id` thì chỉ áp cho showtime đó.
- **Tính discount**:
  - Ưu tiên `discount_amount` nếu > 0,
  - ngược lại dùng `discount_percent`.
- **Làm tròn VND**: `Math.round` để VNPay/VND dùng số nguyên.
- **Trả kết quả**: `{ success, newTotal, discountText, remaining }` cho FE hiển thị.

### Front-End: bấm “Áp dụng” promo ở Checkout

File: `Front-End/src/pages/CheckoutPage.jsx` (L42-L63)

```js
async function applyPromo() {
  try {
    const res = await fetch(`${API_BASE}/api/bookings/apply-promo`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: promoCode,
        originalAmount: totalAmount,
        showtimeId,
      }),
    })
    const d = await res.json()
    if (d.success) {
      setFinalAmount(d.newTotal)
      setDiscountText(d.discountText || '')
      ui.toast.success('Đã áp dụng khuyến mãi.')
    } else ui.toast.warn(d.message || 'Không áp dụng được.')
  } catch {
    ui.toast.error('Lỗi áp mã.')
  }
}
```

Giải thích từng dòng:

- **POST** tới `/api/bookings/apply-promo` với body `{ code, originalAmount, showtimeId }`.
- Nếu `d.success` → update UI `finalAmount` và `discountText`.
- Nếu fail → toast warn message từ server.

---

## 3) Dịch vụ (products) đi kèm trong đặt vé

### Back-End: products được trả về trong seatmap

File: `Back-End/src/routes/bookings.js` (L26-L29)

Ý chính theo dòng:

- **L26**: query `col('products')`.
- **L27**: điều kiện active “linh hoạt”: `active:true` hoặc dữ liệu cũ chưa có field active (`$exists:false`).
- **L28**: sort `id` giảm dần.
- **L29**: toArray và trả về trong response seatmap.

### Front-End: chọn dịch vụ trong `BookingPage`

File: `Front-End/src/pages/BookingPage.jsx`

Các đoạn quan trọng:

- **L44-L57**: tính `productsAmount` dựa trên `productQty` và `productMap`.
- **L227-L315**: UI tăng/giảm số lượng dịch vụ, và hiển thị tạm tính.
- **L142-L156**: khi `next()` sang Checkout thì đưa `products` và `productsAmount` vào `navigate('/checkout', { state: ... })`.

Giải thích logic:

- `productQty` là object `{ [productId]: qty }`.
- `productsAmount` = tổng `price * qty` của các item.
- Khi qua Checkout, FE gửi ngược danh sách `{ id, qty }` lên Back-End trong `/api/bookings/confirm`.

### Back-End: snapshot dịch vụ vào booking khi confirm

File: `Back-End/src/routes/bookings.js` (L151-L183 và L221-L241)

Ý chính:

- Build `productQty` map từ payload.
- Query `products` để lấy giá/name chuẩn từ DB (không tin FE).
- Tạo `bookingProducts` có `unit_price`, `qty`, `line_total`.
- Lưu vào booking:
  - `products_amount`
  - `products` (mảng snapshot)

---

## 4) Admin quản trị promo & products

### File: `Back-End/src/routes/admin.js`

#### A) Quản trị promotions

Vị trí: `Back-End/src/routes/admin.js`:

- **GET `/api/admin/promotions`**: (L177-L183) list full promotions (admin).
- **POST `/api/admin/promotions`**: (L186-L232) tạo/cập nhật promo:
  - chuẩn hoá code,
  - lưu `discount_amount/discount_percent`,
  - set `usage_limit`, khởi tạo `usage_count:0` khi tạo mới,
  - check trùng code khi update/insert.
- **DELETE `/api/admin/promotions/:id`**: (L234-L242) xoá promo.

#### B) Quản trị products (dịch vụ)

Vị trí: `Back-End/src/routes/admin.js`:

- **GET `/api/admin/products`**: (L254-L261) list products.
- **POST `/api/admin/products`**: (L263-L295) tạo/cập nhật product:
  - name/price/image_url/category/active,
  - insert mới sẽ có `created_at`.
- **DELETE `/api/admin/products/:id`**: (L297-L305) xoá product.

