# Tầm nhìn AI-Portal

**AI-Portal** là nền tảng vận hành hệ thống AI, cho phép nhà phát triển và tổ chức xây dựng ứng dụng AI cho doanh nghiệp mà **không cần tự xây giao diện**. Trang quản trị được xây dựng để **quản lý và kiểm soát toàn bộ hệ thống**. Các gói ngôn ngữ dễ dàng bổ sung qua Admin → Settings.

---

## 1. Vai trò nền tảng

- **Nơi vận hành các hệ thống AI**  
  Một điểm triển khai duy nhất: chat, trợ lý ảo, RAG, đa Agent. Self-hosted trên hạ tầng của bạn.

- **Cho nhà phát triển**  
  Tạo **Agent** (API theo chuẩn) hoặc **Ứng dụng** (theo chuẩn ứng dụng), đăng ký vào Portal. Portal cung cấp sẵn giao diện chat, embed, quản lý phiên và người dùng.

- **Cho doanh nghiệp / tổ chức**  
  Triển khai một lần, quản lý người dùng, dự án, agents, ứng dụng, giới hạn, feedback và vận hành qua Admin.

---

## 2. Kiểm soát toàn hệ thống (Admin)

Trang **Admin** là trung tâm điều khiển toàn bộ hệ thống. Mọi cấu hình và dữ liệu vận hành đều quản lý tại đây; không cần sửa code để thay đổi hành vi.

### 2.1 Overview — Xem toàn bộ thông tin

- **Tổng quan hệ thống:** thống kê bảng DB, tổng dòng, người dùng (online, admin), Agents (số đang bật), Dự án, Bài viết (Write), Storage (số object, dung lượng), Qdrant (nếu bật plugin).
- Biểu đồ: tin nhắn theo ngày, theo nguồn (web/embed), theo Agent; đăng nhập theo ngày.
- Trạng thái kết nối: Database, Storage, Qdrant; danh sách Agents và trạng thái healthy/unhealthy.

**Mục đích:** Một màn hình duy nhất để nắm toàn bộ thông tin vận hành.

---

### 2.2 Agents — Quản lý các Agent

- **Thêm / sửa / xóa Agent:** alias, base URL, icon, thứ tự hiển thị, cấu hình (embed, giới hạn tin/ngày, gợi ý routing).
- **Export / Import** cấu hình Agent (JSON).
- **Embed:** lấy mã iframe, cấu hình domain whitelist, giới hạn tin nhắn/ngày cho embed.
- **Hội thoại:** xem danh sách phiên (theo agent, nguồn web/embed), xem tin nhắn (ẩn danh người dùng).
- **Test:** kiểm thử metadata, data, ask (text/file) cho từng Agent.

**Agent Central (Trợ lý chính):**

- **Vai trò điều phối:** Khi người dùng **không chọn** Agent cụ thể, tin nhắn được gửi tới **Central**. Central sử dụng LLM (OpenAI / Gemini / Anthropic / OpenAI-compatible) để **lựa chọn Agent phù hợp** từ danh sách Agents đã đăng ký (và có thể gọi nhiều Agent), rồi tổng hợp phản hồi. Nhờ đó người dùng chỉ cần hỏi, hệ thống tự chọn Agent phù hợp.
- Cấu hình Central: **Admin → Central** (hoặc Settings: LLM Trợ lý chính): provider, model, API key, base URL. Central không xóa được; alias luôn là `central`.

---

### 2.3 Applications — Quản lý ứng dụng

- **Nơi quản lý các ứng dụng** (Write, Data và các ứng dụng thêm vào sau).
- Mỗi ứng dụng: **alias**, **base URL**, icon, bật/tắt, thứ tự hiển thị, cấu hình (giới hạn tin nhắn/ngày, gợi ý routing, embed).
- **Cho phép đưa thêm ứng dụng** lên hệ thống: thêm bản ghi trong Admin → Applications, khai báo base URL (và tùy chọn domain URL nếu ứng dụng là SPA riêng). Ứng dụng mới phải tuân thủ **chuẩn phát triển ứng dụng** (xem mục 4 và `docs/APPLICATIONS.md`).

**Chuẩn ứng dụng:** Ứng dụng cung cấp endpoint **GET {base_url}/metadata** trả về metadata (name, description, capabilities, …) giống Agent; Portal dùng metadata để hiển thị và kiểm tra kết nối. Ứng dụng có thể là một trang web riêng (domain_url) hoặc chạy qua proxy Portal.

---

### 2.4 Plugins — Tính năng bổ sung

- **Plugins** là những tính năng thêm vào để hệ thống **mạnh mẽ hơn**, mở rộng theo nhu cầu.
- Ví dụ: **Plugin Qdrant** — bật/tắt tab Qdrant trong Admin, cấu hình URL Qdrant; dùng cho RAG, vector DB, embedding.
- Có thể mở rộng thêm plugin khác (tích hợp nguồn Agent ngoài, webhook, báo cáo, …) theo chuẩn plugin của Portal.

---

### 2.5 Các mục Admin khác

- **Users** — Tài khoản, vai trò (user / admin / developer), giới hạn tin nhắn/ngày.
- **Projects** — Dự án của người dùng, thành viên, file.
- **Limits** — Giới hạn tin nhắn theo user, theo agent, tin nhắn khách.
- **Feedback** — Góp ý người dùng, đánh giá tin nhắn.
- **Database** — Xem/sửa bảng (vd. departments), chạy SQL.
- **Storage** — MinIO/S3, quản lý object.
- **Qdrant** — Vector DB (khi bật plugin Qdrant), RAG/embedding.
- **Settings** — Ngôn ngữ mặc định, Qdrant URL, biến môi trường (chỉ đọc), reset DB. **Các gói ngôn ngữ** dễ dàng bổ sung: tải mẫu gói ngôn ngữ, chỉnh sửa, upload vào hệ thống; hỗ trợ đa ngôn ngữ (vi, en, zh, hi, es và thêm mới).

---

## 3. Giá trị với nhà phát triển

| Nhu cầu | AI-Portal đáp ứng |
|--------|--------------------|
| Tạo Agent mới | Triển khai API (metadata, ask, data). Đăng ký trong Admin → Agents. Không cần làm frontend. |
| Đưa ứng dụng lên Portal | Tuân thủ chuẩn ứng dụng (metadata). Thêm trong Admin → Applications. |
| Giao diện người dùng | Portal cung cấp sẵn: chat, embed iframe, ứng dụng Write/Data, đa ngôn ngữ. |
| Điều phối khi không chọn Agent | Central tự chọn Agent phù hợp nhờ LLM; admin cấu hình LLM tại Admin → Central. |
| Mở rộng hệ thống | Plugins (vd. Qdrant); thêm ngôn ngữ qua Settings. |

**Luồng điển hình:** Developer triển khai Agent hoặc Ứng dụng (API + metadata) → Đăng ký trong Admin (Agents hoặc Applications) → Người dùng cuối dùng ngay qua web/embed. Khi người dùng không chọn Agent, Central điều phối và chọn Agent phù hợp.

---

## 4. Chuẩn phát triển ứng dụng

Để **đưa thêm ứng dụng** lên hệ thống (Admin → Applications), ứng dụng cần:

1. **Base URL** — Địa chỉ API của ứng dụng (vd. `https://my-app.example.com/v1` hoặc `http://localhost:3001/api/my_agent/v1`).
2. **Endpoint metadata** — **GET {base_url}/metadata** trả về JSON với ít nhất:
   - `name` (string): tên hiển thị
   - `description` (string, tùy chọn): mô tả
   - `capabilities` (array, tùy chọn)
   - Các trường khác theo chuẩn Agent (xem `frontend/docs/README.md`).

Portal gọi `/metadata` để lấy tên, mô tả và kiểm tra trạng thái (healthy/unhealthy). Ứng dụng có thể chỉ là API (Portal embed hoặc proxy), hoặc là SPA riêng (khai báo **domain_url** trong Admin để mở trong iframe/tab).

Chi tiết kỹ thuật và ví dụ: xem **`docs/APPLICATIONS.md`**.

---

## 5. Hướng phát triển tiếp theo

1. **Trải nghiệm nhà phát triển** — Tài liệu rõ ràng (Agent + Ứng dụng), ví dụ mã, trang Developer trong app; webhook/event khi lỗi Agent hoặc vượt giới hạn.
2. **Chuẩn plugin** — Định nghĩa rõ cách đóng gói và bật/tắt plugin (Qdrant là mẫu) để dễ thêm plugin mới.
3. **Tổ chức / đa tenant (tùy chọn)** — Workspace/Organization, SSO/SAML.
4. **Vận hành & quan sát** — Dashboard latency, tỷ lệ lỗi, cảnh báo Agent down.
5. **Giao diện & ngôn ngữ** — Tiếp tục cải thiện đa ngôn ngữ, accessibility; bổ sung gói ngôn ngữ qua Settings.

---

## 6. Tóm tắt

- **AI-Portal** = nền tảng vận hành AI self-hosted; Admin = quản lý và kiểm soát toàn bộ hệ thống.
- **Overview** = xem toàn bộ thông tin (DB, users, agents, projects, storage, Qdrant, …).
- **Agents** = quản lý Agents; **Central** = điều phối, lựa chọn Agent phù hợp khi người dùng không chọn Agent.
- **Applications** = quản lý ứng dụng; cho phép đưa thêm ứng dụng lên hệ thống theo **chuẩn phát triển ứng dụng**.
- **Plugins** = tính năng bổ sung để hệ thống mạnh mẽ hơn (vd. Qdrant).
- **Gói ngôn ngữ** = dễ dàng bổ sung qua Admin → Settings.

**Tài liệu nhà phát triển (ngắn gọn):** [docs/DEVELOPERS.md](docs/DEVELOPERS.md) — mục lục. Agent API: `frontend/docs/README.md` và trang **/devs/docs**. Chuẩn ứng dụng: [docs/APPLICATIONS.md](docs/APPLICATIONS.md).
