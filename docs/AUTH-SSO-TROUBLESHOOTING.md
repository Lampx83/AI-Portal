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
  - hoặc `https://your-domain.com/api/auth/callback/azure-ad` (production)
- **Google**: trong Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs, thêm:
  - `http://localhost:3000/api/auth/callback/google` (localhost)
  - hoặc `https://your-domain.com/api/auth/callback/google` (production)

Chỉ đăng ký `http://localhost:3000/` (thiếu `/api/auth/callback/azure-ad`) sẽ **không đủ** — IdP so khớp từng ký tự. Trang Admin → Cài đặt → Đăng nhập SSO giờ có hiển thị đúng Redirect URI để bạn copy vào Azure/Google.

### 3. NEXTAUTH_URL không khớp URL thực tế

Sau khi SSO redirect về, backend dùng host từ request (header `Host` / `X-Forwarded-Host`) để redirect. Nếu bạn truy cập bằng domain (vd. `https://ai.example.com`) mà `NEXTAUTH_URL` trong Admin hoặc `.env` vẫn là `http://localhost:3000`, callback có thể redirect sai hoặc lỗi.

**Cách xử lý:**

- Đặt **NEXTAUTH_URL** (trong Admin → Cài đặt hệ thống hoặc `.env`) đúng URL mà user mở (vd. `https://ai.example.com` hoặc `https://ai.example.com/base-path` nếu dùng basePath).
- Khi dùng basePath, NEXTAUTH_URL phải có đuôi basePath (vd. `https://ai.neu.edu.vn/base-path`).

### 4. Timeout khi callback SSO chậm

Callback từ Azure AD/Google có thể chậm. Frontend proxy timeout mặc định đã được tăng lên (15s). Nếu vẫn lỗi, kiểm tra backend và IdP có phản hồi trong vài giây.

### 5. CORS / proxy

Nếu bạn truy cập frontend qua domain khác (vd. `https://portal.côngty.com`) và backend chạy trên máy khác, cần:

- Backend cho phép origin của frontend (CORS) — thường cấu hình qua Admin → Cài đặt (APP_URL / CORS).
- Proxy (Nginx, etc.) chuyển đúng `Host`, `X-Forwarded-Proto`, `X-Forwarded-Host` xuống frontend/backend.

## Checklist nhanh

- [ ] Backend đang chạy và `curl http://localhost:3001/health` trả `ok`.
- [ ] Frontend có `BACKEND_URL` trỏ đúng backend (dev: `http://localhost:3001`).
- [ ] **NEXTAUTH_URL** trùng với URL bạn mở trên trình duyệt (kể cả basePath).
- [ ] **NEXTAUTH_SECRET** đã set (trong .env hoặc Admin), đặc biệt khi chạy production.
- [ ] Nếu dùng basePath: `NEXT_PUBLIC_BASE_PATH` (hoặc `BASE_PATH`) và NEXTAUTH_URL đều có cùng basePath.

Sau khi sửa, thử đăng xuất (xóa cookie) rồi đăng nhập SSO lại.
