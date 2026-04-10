# 05 - Các phần liên quan đến Thanh toán & Lịch sử thanh toán

Tài liệu này gom các đoạn code liên quan đến:

- Tạo URL thanh toán VNPay cho booking.
- VNPay return: xác minh chữ ký, cập nhật trạng thái `payments` và `bookings`.
- Nạp ví (TOPUP) qua VNPay và cập nhật `users.wallet`.
- Lịch sử/topup cho admin.
- Front-End: checkout redirect sang VNPay và trang return xử lý kết quả.

---

## 1) Back-End: VNPay route (`/api/payments/vnpay`)

### File: `Back-End/src/routes/paymentsVnpay.js`

#### A) Đọc cấu hình VNPay từ `.env`

Vị trí: `Back-End/src/routes/paymentsVnpay.js` (L10-L18)

```js
function getConfig() {
  const tmnCode = (process.env.VNPAY_TMN_CODE || '').trim()
  const hashSecret = (process.env.VNPAY_HASH_SECRET || '').trim()
  const vnpUrl = (process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html').trim()
  const returnUrl = (process.env.VNPAY_RETURN_URL || 'http://localhost:5173/payment/vnpay-return').trim()
  const orderType = (process.env.VNPAY_ORDER_TYPE || 'other').trim()
  const expireMinutes = Math.max(0, Number.parseInt(process.env.VNPAY_EXPIRE_MINUTES || '0', 10) || 0)
  return { tmnCode, hashSecret, vnpUrl, returnUrl, orderType, expireMinutes }
}
```

Giải thích từng dòng:

- **tmnCode/hashSecret**: 2 biến bắt buộc để ký VNPay.
- **vnpUrl/returnUrl**: URL VNPay (sandbox) và URL FE nhận kết quả.
- **orderType**: loại đơn VNPay.
- **expireMinutes**: thời hạn hiệu lực link thanh toán (tuỳ chọn).

#### B) Tạo URL thanh toán cho booking: POST `/api/payments/vnpay/create`

Vị trí: `Back-End/src/routes/paymentsVnpay.js` (L66-L127)

Các dòng quan trọng:

- **L69-L72**: chặn nếu thiếu config `VNPAY_TMN_CODE/VNPAY_HASH_SECRET`.
- **L74-L80**: validate body: `bookingId`, `amount`, `orderInfo`, `returnUrl`.
- **L82-L83**: kiểm tra booking tồn tại.
- **L85-L100**: build params `vnp_*`:
  - **L91**: `vnp_Amount` = `amount * 100` (VNPay dùng đơn vị “xu”).
  - **L97**: dùng `returnUrl` từ FE hoặc default.
  - **L99**: `vnp_CreateDate` theo timezone VN.
- **L105-L109**: sort params + ký HMAC (sha512) + append `vnp_SecureHash` → tạo URL.
- **L111-L118**: insert bản ghi vào collection `payments` (provider=VNPAY, status=CREATED).
- **L120-L123**: update booking set `payment_method`, `payment_status`, `payment_txn_ref`.
- **L125**: trả `{ url, txnRef }` cho client redirect.

#### C) Tạo URL nạp ví: POST `/api/payments/vnpay/topup/create`

Vị trí: `Back-End/src/routes/paymentsVnpay.js` (L129-L187)

Các dòng quan trọng:

- **L131**: `requireAuth` (chỉ user login được nạp ví).
- **L138-L143**: validate `amount >= 1000`.
- **L148**: `txnRef` có prefix `TOPUP_{userId}_{timestamp}`.
- **L174-L183**: insert `payments` với `purpose: 'TOPUP'`.

#### D) Xác minh VNPay return: GET `/api/payments/vnpay/return`

Vị trí: `Back-End/src/routes/paymentsVnpay.js` (L189-L305)

Các bước theo dòng:

1) **Xác minh chữ ký**

- **L195-L203**: chỉ lấy các field `vnp_*` (loại trừ `vnp_SecureHash`).
- **L204-L208**: build sorted params và ký lại để so với `secureHash` → sai thì 400.

2) **Cập nhật `payments`**

- **L210-L218**: đọc `txnRef`, `respCode`, `amount`, xác định `newStatus` SUCCESS/FAILED.
- **L220-L231**: update doc `payments` lưu:
  - `status`,
  - `vnp_response_code`,
  - `vnp_raw` (toàn bộ query để debug),
  - `updated_at`.

3) **Nếu SUCCESS**

- **Topup**:
  - **L234-L248**: nếu `purpose === 'TOPUP'` thì tăng `users.wallet` và sync `req.session.user.wallet`.

- **Booking**:
  - **L250-L281**: nếu booking có `promo_code` thì increment `usage_count` (có check `usage_limit`).
  - **L282-L285**: update booking `status: 'SUCCESS'`, `payment_status: 'SUCCESS'`.

4) **Nếu FAILED**

- **L286-L294**: update booking `status: 'FAILED'` và `payment_status`.

5) **Trả kết quả cho Front-End**

- **L296-L303**: trả JSON `{ success, purpose, bookingId, txnRef, responseCode }`.

---

## 2) Back-End: booking gọi tạo VNPay URL

### File: `Back-End/src/routes/bookings.js`

Vị trí: `Back-End/src/routes/bookings.js` (L243-L255)

```js
const d = await apiFetchJson('/api/payments/vnpay/create', {
  method: 'POST',
  body: {
    bookingId,
    amount: finalAmount,
    orderInfo: `Thanh toán booking #${bookingId}`,
    returnUrl: input.returnUrl,
  },
})
return res.status(201).json({ bookingId, paymentUrl: d.url })
```

Giải thích từng dòng:

- Gọi “nội bộ” API VNPay create bằng `apiFetchJson` (server-to-server).
- Trả về `paymentUrl` để Front-End redirect.

---

## 3) Front-End: Checkout redirect sang VNPay

### File: `Front-End/src/pages/CheckoutPage.jsx`

Vị trí: `Front-End/src/pages/CheckoutPage.jsx` (L65-L96)

Ý chính theo dòng:

- **L71-L87**: POST `/api/bookings/confirm` với:
  - `paymentMethod: 'VNPAY'`
  - `returnUrl: ${window.location.origin}/payment/vnpay-return`
- **L90-L93**: nếu server trả `paymentUrl` thì `window.location.href = d.paymentUrl` (redirect sang VNPay).

---

## 4) Front-End: Trang VNPay return xử lý kết quả

### File: `Front-End/src/pages/VnpayReturnPage.jsx`

Vị trí: `Front-End/src/pages/VnpayReturnPage.jsx` (L13-L69)

```js
useEffect(() => {
  const qs = loc.search || ''
  fetch(`${API_BASE}/api/payments/vnpay/return${qs}`, { credentials: 'include' })
    .then(async (r) => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Xác minh thanh toán thất bại.')
      return d
    })
    .then((d) => {
      if (d.success) {
        if (d.purpose === 'TOPUP') {
          ui.toast.success('Nạp ví thành công.')
          // ... có thể mua pass sau topup (buyPassId) ...
          navigate(next || '/', { replace: true })
          return
        }
        ui.toast.success('Thanh toán thành công.')
        navigate('/booking/success', { state: { bookingId: d.bookingId }, replace: true })
      } else {
        // ... hiện lỗi theo responseCode ...
      }
    })
    .catch((e) => {
      ui.toast.error(e.message || 'Xác minh thanh toán thất bại.')
    })
}, [])
```

Giải thích từng dòng:

- **L14-L15**: giữ nguyên query string VNPay trả về (`loc.search`) và forward sang BE `/return`.
- **L16-L20**: parse JSON; nếu không OK thì throw để vào catch.
- **L22-L56**: nếu `success`:
  - booking: chuyển `BookingSuccessPage`,
  - topup: toast success, refresh auth (wallet) và điều hướng theo `next`.
- **L66-L68**: lỗi mạng/chữ ký sai → toast error.

---

## 5) Lịch sử thanh toán (Admin topup list)

### File: `Back-End/src/routes/admin.js`

#### GET `/api/admin/wallet-topups`

Vị trí: `Back-End/src/routes/admin.js` (L361-L394)

Ý chính:

- Query `payments` theo `{ provider:'VNPAY', purpose:'TOPUP' }`.
- Join thông tin user (username/fullName/email).
- Trả `topups[]` gồm amount/status/txn_ref/created_at/response_code.

---

## 6) Doanh thu tổng & biểu đồ doanh thu (Admin Dashboard)

Phần này bạn yêu cầu tính vào **chủ đề Thanh toán**.

### A) Tổng doanh thu (1 con số) trong dashboard

Back-End:

- **GET `/api/admin/dashboard`** (trả `totalRevenue`)
- File: `Back-End/src/routes/admin.js` (route `/dashboard`)
- Ý chính: aggregate collection `bookings`, sum `total_amount` cho booking `SUCCESS` (và dữ liệu cũ status null/không tồn tại).

Front-End:

- Page: `Front-End/src/pages/AdminDashboard.jsx`
- Gọi API `/api/admin/dashboard` để lấy `totalRevenue` và render card “Doanh thu”.

### B) Biểu đồ doanh thu theo tuần/tháng

Back-End:

- **GET `/api/admin/revenue-series?granularity=week|month&points=12`**
- File: `Back-End/src/routes/admin.js`
- Output: `series[]` gồm `{ label, revenue, bookings }` để vẽ cột.

Front-End:

- Page: `Front-End/src/pages/AdminDashboard.jsx`
- Có 2 nút **Theo tuần / Theo tháng** (đổi `granularity`).
- Fetch `/api/admin/revenue-series` và render biểu đồ cột (không dùng thư viện chart).

