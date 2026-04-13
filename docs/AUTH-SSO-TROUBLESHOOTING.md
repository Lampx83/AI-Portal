# Khắc phục lỗi đăng nhập SSO / Next-Auth (CLIENT_FETCH_ERROR)

Khi gặp lỗi console: `[next-auth][error][CLIENT_FETCH_ERROR] "Failed to fetch"` khi đăng nhập SSO (Azure AD, Google) hoặc load session.

## Nguyên nhân thường gặp

### 1. Backend không chạy hoặc không tới được

Frontend proxy mọi request `/api/auth/*` sang backend (mặc định `http://localhost:3001`). Nếu backend tắt hoặc sai port → fetch từ frontend tới backend lỗi → trả 503 → client có thể báo "Failed to fetch".

**Kiểm tra:**

- Chạy backend cùng lúc với frontend (ví dụ `npm run dev` ở thư mục backend, hoặc `docker-compose up`).
- Trong thư mục frontend, kiểm tra `BACKEND_URL` (hoặc mặc định dev: `http://localhost:3001`).
- Mở trực tiếp: `curl -s http://localhost:3001/health` → phải trả JSON `{"status":"ok",...}`.

### 2. Redirect URI trong Azure AD / Google sai hoặc thiếu

Trình duyệt chỉ gọi **frontend** (vd. `http://localhost:3000`). Backend chạy port 3001 chỉ nhận request qua proxy từ frontend — **bạn không đăng ký callback là port 3001**. Redirect URI phải là **URL frontend** và **đường dẫn đầy đủ**:

- **Azure AD**: trong Azure Portal → App registration → Authentication → Redirect URIs, thêm **chính xác**:
  - `http://localhost:3000/api/auth/callback/azure-ad` (localhost, không basePath)
  - hoặc `https://your-domain.com/base-path/api/auth/callback/azure-ad` (production có basePath, ví dụ `/tuyen-sinh`)
  - hoặc `https://your-domain.com/api/auth/callback/azure-ad` (production không basePath)
- **Google**: trong Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs, thêm:
  - `http://localhost:3000/api/auth/callback/google` (localhost)
  - hoặc `https://your-domain.com/api/auth/callback/google` (production)

Chỉ đăng ký `http://localhost:3000/` (thiếu `/api/auth/callback/azure-ad`) sẽ **không đủ** — IdP so khớp từng ký tự. Trang Admin → Cài đặt → Đăng nhập SSO giờ có hiển thị đúng Redirect URI để bạn copy vào Azure/Google.

### 3. NEXTAUTH_URL sai → SSO về `/.../callback/azure-ad` (404) hoặc redirect lệch

`next-auth` v4 (`parseUrl`): nếu **NEXTAUTH_URL** có pathname (vd. `https://host/tuyen-sinh`), thư viện coi đó là base và tạo callback OAuth là `.../tuyen-sinh/callback/azure-ad` — **không** có `/api/auth`, trình duyệt 404.

**Cách xử lý:**

- **Có basePath** (vd. `/tuyen-sinh`): đặt `NEXTAUTH_URL` = URL app **cộng** `/api/auth`, ví dụ `https://ai.neu.edu.vn/tuyen-sinh/api/auth` (không chỉ `.../tuyen-sinh`).
- **Không basePath**: `NEXTAUTH_URL` = origin (vd. `https://ai.example.com` hoặc `http://localhost:3000`) là đủ — thư viện tự gắn `/api/auth`.
- Trong Admin / `.env` / Docker: sau khi sửa, backend tải lại cấu hình (hoặc khởi động lại container). Bản build có `runtime-config` cũng tự chuẩn hóa nếu bạn chỉ nhập `.../tuyen-sinh` thiếu `/api/auth`.
- Redirect URI trên Azure/Google phải trùng URL thật trên trình duyệt: `.../api/auth/callback/azure-ad` (có basePath thì nằm sau basePath).

### 4. Timeout khi callback SSO chậm

Callback từ Azure AD/Google có thể chậm. Frontend proxy timeout mặc định đã được tăng lên (15s). Nếu vẫn lỗi, kiểm tra backend và IdP có phản hồi trong vài giây.

### 5. CORS / proxy

Nếu bạn truy cập frontend qua domain khác (vd. `https://portal.côngty.com`) và backend chạy trên máy khác, cần:

- Backend cho phép origin của frontend (CORS) — thường cấu hình qua Admin → Cài đặt (APP_URL / CORS).
- Proxy (Nginx, etc.) chuyển đúng `Host`, `X-Forwarded-Proto`, `X-Forwarded-Host` xuống frontend/backend.

## Checklist nhanh

- [ ] Backend đang chạy và `curl http://localhost:3001/health` trả `ok`.
- [ ] Frontend có `BACKEND_URL` trỏ đúng backend (dev: `http://localhost:3001`).
- [ ] **NEXTAUTH_URL**: có basePath thì dạng `https://host/base/api/auth`; không basePath thì origin (vd. `https://host`).
- [ ] **NEXTAUTH_SECRET** đã set (trong .env hoặc Admin), đặc biệt khi chạy production.
- [ ] Nếu dùng basePath: `NEXT_PUBLIC_BASE_PATH` (hoặc `BASE_PATH`) và NEXTAUTH_URL đều có cùng basePath.

Sau khi sửa, thử đăng xuất (xóa cookie) rồi đăng nhập SSO lại.
