# Agent API — AI-Portal

Triển khai Agent theo chuẩn bên dưới, đăng ký **Admin → Agents**. Portal cung cấp UI chat, embed, đa ngôn ngữ. Ứng dụng (app): [APPLICATIONS.md](../../docs/APPLICATIONS.md). Tổng quan: [DEVELOPERS.md](../../docs/DEVELOPERS.md) · [VISION.md](../../VISION.md).

---

## 1. Endpoints bắt buộc

| Endpoint | Method | Mô tả |
|----------|--------|--------|
| `{base_url}/metadata` | GET | Khai báo tên, mô tả, khả năng, mô hình hỗ trợ. |
| `{base_url}/ask` | POST | Nhận prompt + context, trả nội dung Markdown. |
| `{base_url}/data` | GET | Tùy chọn. Trả dữ liệu (documents, experts, …). |

Base URL: `https://your-server.com/v1` hoặc `http://localhost:8000/v1`.

---

## 2. GET /metadata

Response JSON, tối thiểu:

| Trường | Bắt buộc | Mô tả |
|--------|----------|--------|
| `name` | ✅ | Tên hiển thị. |
| `description` | | Mô tả ngắn. |
| `capabilities` | | Mảng string (vd. `["search","summarize"]`). |
| `supported_models` | | `[{ "model_id", "name", "accepted_file_types" }]` — `model_id` dùng trong `/ask`. |
| `sample_prompts` | | Gợi ý câu hỏi mẫu. |
| `provided_data_types` | | Cho `/data?type=...` (vd. `documents`, `experts`). |
| `status` | | `"active"` \| `"inactive"`. |

Ví dụ:

```json
{
  "name": "Document Assistant",
  "description": "Tìm kiếm, tóm tắt tài liệu",
  "capabilities": ["search", "summarize"],
  "supported_models": [
    { "model_id": "gpt-4o", "name": "GPT-4o", "accepted_file_types": ["pdf", "docx"] }
  ],
  "sample_prompts": ["Tóm tắt bài báo về AI"],
  "status": "active"
}
```

---

## 3. POST /ask

**Request (JSON):**

| Trường | Bắt buộc | Mô tả |
|--------|----------|--------|
| `session_id` | ✅ | ID phiên. |
| `model_id` | ✅ | Nằm trong `supported_models[].model_id`. |
| `user` | ✅ | URL API user (vd. `https://portal.example.com/api/users/email/{email}`). |
| `prompt` | ✅ | Câu hỏi/yêu cầu. |
| `context.language` | | `vi`, `en`, … |
| `context.project` | | URL API project — GET để lấy thông tin dự án. |
| `context.extra_data.document` | | Mảng URL file đính kèm. |
| `context.history` | | `[{ "role": "user"|"assistant", "content": "..." }]`. |

**Response (JSON):** Trả ít nhất một trong: `content_markdown`, `answer`, `content` (ưu tiên theo thứ tự). Tùy chọn: `sources`, `attachments`, `meta.response_time_ms`.

Ví dụ request:

```json
{
  "session_id": "uuid",
  "model_id": "gpt-4o",
  "user": "https://portal.example.com/api/users/email/user@example.com",
  "prompt": "Tóm tắt tài liệu",
  "context": {
    "language": "vi",
    "project": "https://portal.example.com/api/projects/{id}",
    "extra_data": { "document": ["https://.../file.pdf"] },
    "history": []
  }
}
```

Ví dụ response:

```json
{
  "session_id": "uuid",
  "status": "success",
  "content_markdown": "## Tóm tắt\nNội dung..."
}
```

---

## 4. GET /data (tùy chọn)

`GET {base_url}/data?type=documents` (hoặc `experts`, …). Response: `{ "status": "success", "data_type": "...", "items": [...] }`. Dùng khi Agent có dữ liệu cần liệt kê/gợi ý.

---

## 5. Đăng ký & kiểm thử

**Đăng ký:** Admin → **Agents** → Thêm: **alias** (vd. `papers`), **base URL**, **icon**. Có thể thêm **routing hint** để Central chọn Agent phù hợp khi user không chọn.

**Test:**

```bash
curl -s {base_url}/metadata
curl -X POST {base_url}/ask -H "Content-Type: application/json" -d '{"session_id":"...","model_id":"gpt-4o","user":"...","prompt":"Hello"}'
```

Admin → Agents → chọn Agent → **Test API** để gửi request mẫu.

---

## 6. API hệ thống (Portal gửi vào context)

- User: `GET /api/users/email/{email}` — Agent có thể gọi để lấy hồ sơ user.
- Project: `GET /api/projects/{id}` — Thông tin dự án (name, description, team_members, file_keys).
- Chat history: `GET /api/chat/sessions/{session_id}/messages` — Lịch sử tin nhắn.

---

## Checklist

- [ ] `GET /metadata` trả JSON đúng format.
- [ ] `POST /ask` nhận payload, trả `content_markdown` (hoặc `answer`/`content`).
- [ ] (Tùy chọn) `GET /data?type=...` nếu có dữ liệu.
- [ ] Xử lý `context.user`, `context.project`, `context.extra_data.document` nếu cần.
- [ ] Đăng ký trong Admin → Agents và test.
