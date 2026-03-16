# Xử lý lỗi Docker frontend (aiportal-frontend)

## Các lỗi thường gặp trong log

### 1. `ReferenceError: returnNaN is not defined`

- **Nguyên nhân có thể:** Next.js/React serialize giá trị `NaN` trong props (server → client). `JSON.stringify(NaN)` ra `null`, nhưng RSC hoặc code khác có thể tham chiếu tới symbol/helper tên `returnNaN` không tồn tại trong bundle.
- **Cách xử lý:**
  - Trong **server components** hoặc **getServerSideProps/getStaticProps**: không trả về `NaN`. Dùng `null` hoặc số thay thế (vd: `0`, `-1`) hoặc bỏ field đó.
  - Trong code đã kiểm tra: dùng `Number.isNaN(x)` và return sớm (vd: `if (Number.isNaN(date.getTime())) return null`) là đúng; không truyền `NaN` xuống props của page.

### 2. `EACCES: permission denied, open '/dev/let'`, `/var/let`, `/etc/let`, `/let`

- **Đặc điểm:** Ứng dụng cố mở hoặc tạo file tại các đường dẫn có segment `"let"` (từ khóa JavaScript). **Không có đoạn code nào trong source AI-Portal tạo các đường dẫn này.**
- **Khả năng:**
  - Dependency (ví dụ native addon, thư viện dùng `detect-libc`, sharp, v.v.) bị lỗi hoặc bị thay đổi khiến path build sai (vd: biến path bị gán nhầm thành `"let"`).
  - Bundle/minifier méo identifier (ít gặp).
  - Phiên bản cũ của package đã có bug hoặc bị compromise (bạn đã nói đây là logs cũ).
- **Cách xử lý:**
  - Cập nhật dependencies: `npm update` hoặc kiểm tra bản mới của `sharp`, `detect-libc`, và các package dùng file system.
  - Cài lại sạch: xóa `node_modules` và `package-lock.json` (hoặc `yarn.lock`), cài lại và build lại image.
  - Trong Docker: chạy container với user không root và không mount thư mục nhạy cảm (`/dev`, `/var`, `/etc`) vào container; các lỗi EACCES với `/dev/let`, `/var/let` có thể do process trong container cố ghi/đọc ở đây.

### 3. `[Error: NEXT_REDIRECT]`

- Đây là cơ chế redirect của Next.js (ném đặc biệt), thường **không phải lỗi**; có thể in ra log khi redirect. Có thể bỏ qua nếu trang vẫn redirect đúng.

### 4. `ResponseAborted` / `ETIMEDOUT`

- Client hủy request hoặc hết thời gian. Có thể do người dùng thoát trang hoặc mạng chậm; nếu xảy ra hàng loạt thì kiểm tra proxy, timeout và tải backend.

---

## Checklist khi log vẫn lặp lại

1. **Không truyền NaN trong props:** Rà lại mọi `getServerSideProps`, `getStaticProps`, và Server Component trả về data cho client; đảm bảo không có field nào là `NaN`.
2. **Build lại image từ source sạch:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   # Rồi build lại Docker image
   ```
3. **Kiểm tra phiên bản:** So sánh `next`, `react`, `sharp` (nếu dùng) với bản đang chạy ổn định (vd bản cũ trước khi có log lạ).
4. **Chạy local không Docker:** `npm run dev` / `npm run start` trên máy local để xem lỗi có còn; nếu chỉ thấy trong Docker thì thu hẹp nguyên nhân vào môi trường container (quyền, volume, image base).

Nếu sau khi làm sạch dependencies và build lại mà vẫn thấy `returnNaN` hoặc `open '.../let'`, nên ghi lại đủ stack trace (nếu có) và danh sách dependency để báo issue cho Next.js hoặc repo tương ứng.
