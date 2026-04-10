# 00 - Tổng hợp số chức năng theo chủ đề

File này tổng hợp **tổng số chức năng** cho 6 chủ đề theo quy ước đếm bạn chọn.

## Quy ước đếm (đang dùng)

- **Back-End**: mỗi endpoint = 1 chức năng. Với admin CRUD:
  - **thêm / sửa / xóa** tính **3 chức năng riêng** (kể cả dùng chung `POST` và phân biệt bằng có/không có `id`).
- **Front-End Pages**: **mỗi page chỉ tính 1 lần toàn hệ thống** (không lặp lại giữa các chủ đề).
- **Front-End Actions**: mỗi hành động chính = 1 chức năng (fetch list/detail, submit form, redirect thanh toán, toggle biểu đồ…).

---

## Bảng tổng hợp

| Chủ đề | Back-End | FE Pages (không lặp) | FE Actions | Tổng |
|---|---:|---:|---:|---:|
| **1) Phim & Tin tức mới** | 13 | 6 | 4 | **23** |
| **2) Suất chiếu & Bình luận** | 7 | 1 | 6 | **14** |
| **3) Đặt vé & Bán vé lại (kèm lịch sử)** | 15 | 7 | 13 | **35** |
| **4) Khuyến mãi & Dịch vụ** | 10 | 3 | 8 | **21** |
| **5) Thanh toán & Lịch sử thanh toán** | 6 | 2 | 7 | **15** |
| **6) Auth/Profile & cấu hình còn lại** | 12 | 4 | 6 | **22** |
| **TỔNG TOÀN HỆ THỐNG** | **63** | **23** | **44** | **130** |

---

## Ghi chú quan trọng

- **Chủ đề 5 (Thanh toán)** đã tính thêm:
  - `GET /api/admin/dashboard` (tổng doanh thu)
  - `GET /api/admin/revenue-series` (biểu đồ doanh thu tuần/tháng)
  - Page `AdminDashboard` + các action vẽ/đổi tuần-tháng.
- **TicketDetailPage**: hiện mình **chưa cộng** vào Chủ đề 3 để tránh sai lệch nếu page đó không có flow mua pass trong UI.  
  Nếu bạn muốn “cứ theo route `App.jsx` là tính”, thì cộng thêm:
  - **FE Pages +1** (`TicketDetailPage`)
  - **FE Actions +1** (mua pass)
  → Tổng toàn hệ thống sẽ thành **132**.

