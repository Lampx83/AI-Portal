# Chuẩn ứng dụng (Applications)

Ứng dụng đăng ký **Admin → Applications**. Sau khi thêm (alias, base URL, icon), app xuất hiện trong sidebar. Portal cung cấp UI; developer tập trung vào logic và **một endpoint bắt buộc**.

---

## Yêu cầu

**GET `{base_url}/metadata`** — Response JSON:

| Trường | Bắt buộc | Mô tả |
|--------|----------|--------|
| `name` | ✅ | Tên hiển thị. |
| `description` | | Mô tả ngắn. |
| `version`, `developer`, `capabilities`, `status` | | Tùy chọn (giống Agent). |

Ví dụ:

```json
{
  "name": "My App",
  "description": "Xử lý tài liệu",
  "capabilities": ["upload", "export"],
  "status": "active"
}
```

Portal gọi `/metadata` để hiển thị tên và kiểm tra trạng thái (healthy/unhealthy).

---

## Đăng ký

1. Triển khai server với **GET {base_url}/metadata**.
2. Admin → **Applications** → Thêm: **alias**, **base_url**, **icon** (FileText | Database | Bot), **is_active**, **display_order**.
3. (Tùy chọn) **domain_url** nếu app là SPA riêng; Portal có thể mở iframe/tab theo URL này.

---

## Tùy chọn

- **ask / data:** Nếu app cũng tham gia chat, triển khai `POST /ask` và `GET /data` theo [Agent API](../frontend/docs/README.md).
- **Agent vs Application:** Agents (Admin → Agents) = trợ lý chat, Central điều phối. Applications (Admin → Applications) = app có UI; chỉ cần `/metadata` để đăng ký.

Tổng quan: [DEVELOPERS.md](DEVELOPERS.md) · [VISION.md](../VISION.md).
