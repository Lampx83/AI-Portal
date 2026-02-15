# Tài liệu kỹ thuật – AI Portal

## 1. Giới thiệu

AI Portal gồm **AI Orchestrator** (điều phối trung tâm) và nhiều **AI Agent** (mỗi Agent là một trợ lý chuyên biệt). Mỗi Agent:

- Đảm nhận một tác vụ cụ thể (tài liệu, chuyên gia, dữ liệu, viết bài, v.v.)
- Có thể sử dụng LLM, RAG, thuật toán ML hoặc logic xử lý riêng
- Triển khai độc lập trên các server khác nhau
- Giao tiếp qua API chuẩn **OpenAPI 3.0+**

Orchestrator nhận yêu cầu người dùng, chọn Agent phù hợp và gọi API của Agent theo chuẩn.

---

## 2. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                             USERS                           │
│                   Chatbot / AI Portal Web/App               │
└─┬─────────────────────────────┬───────────────────────────┬─┘
  │                      HTTPS  │  JWT / OAuth2             │
  │                             ▼                           │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │                AI ORCHESTRATOR CORE               │  │
  │  │  - Phân tích intent / ngữ cảnh                    │  │
  │  │  - Điều phối Agent (single / multi-agent)         │  │
  │  │  - Quản lý session & project context              │  │
  │  │  - Chuẩn hoá prompt / response                    │  │
  └───┬───────────────────────────────────────────────┬───┘  │
      │ REST / OpenAPI                │   Async Tasks  │      │
      ▼                               ▼               ▼      │
┌──────────────────────┐   ┌──────────────────────┐          │
│      AI AGENT        │   │   MESSAGE QUEUE      │          │
│  (Triển khai phân tán)   │   RabbitMQ / Redis   │          │
│  - Trợ lý tài liệu   │   │  - Crawl định kỳ     │          │
│  - Trợ lý chuyên gia │   │  - OCR / Chunking    │          │
│  - Trợ lý viết bài   │   │  - Long tasks        │          │
│  - Trợ lý dữ liệu    │   └──────────────────────┘          │
└──────────────────────┘                                      │
```

---

## 3. Hướng dẫn phát triển Agent

Phần này dành cho developer muốn tạo Agent mới tích hợp vào hệ thống.

### 3.1 Tổng quan API Agent

Mỗi Agent **bắt buộc** triển khai ít nhất 2 endpoint:

| Endpoint   | Method | Bắt buộc | Mô tả |
|------------|--------|----------|-------|
| `/metadata`| GET    | ✅       | Khai báo cấu hình và khả năng của Agent |
| `/ask`     | POST   | ✅       | Xử lý yêu cầu người dùng, trả về nội dung Markdown |
| `/data`    | GET    | ❌       | Trả về dữ liệu hiện có (documents, experts, v.v.) |

Base URL của Agent thường có dạng: `https://your-server.com/v1` hoặc `http://localhost:8000/v1`.

---

### 3.2 Endpoint `/metadata` – Khai báo Agent

**Mục đích:** Cho hệ thống biết Agent làm gì, hỗ trợ mô hình nào, có dữ liệu gì.

**Response JSON mẫu:**

```json
{
  "name": "Document Assistant",
  "description": "Tìm kiếm, tóm tắt và giải thích tài liệu",
  "version": "1.2.0",
  "developer": "Nhóm H Thắng, H Việt, X Lâm",
  "capabilities": ["search", "summarize", "explain"],
  "supported_models": [
    {
      "model_id": "gpt-4o",
      "name": "GPT-4o",
      "description": "Mô hình mạnh cho tóm tắt và giải thích chi tiết",
      "accepted_file_types": ["pdf", "docx", "txt", "md"]
    },
    {
      "model_id": "gpt-4o-mini",
      "name": "GPT-4o Mini",
      "description": "Mô hình nhanh, tiết kiệm chi phí",
      "accepted_file_types": ["pdf", "txt"]
    }
  ],
  "sample_prompts": [
    "Tóm tắt bài báo về học sâu trong y tế",
    "Giải thích khái niệm 'federated learning' trong AI",
    "Tìm các bài về biến đổi khí hậu năm 2024"
  ],
  "provided_data_types": [
    {
      "type": "documents",
      "description": "Danh sách và thông tin tóm tắt các tài liệu mà Agent lưu trữ"
    },
    {
      "type": "experts",
      "description": "Danh sách chuyên gia liên quan tới lĩnh vực mà Agent quản lý"
    }
  ],
  "contact": "email@example.com",
  "status": "active"
}
```

**Các trường quan trọng:**

- `name`, `description`: Hiển thị trên giao diện
- `supported_models`: Mô hình LLM Agent hỗ trợ; `model_id` dùng trong payload `/ask`
- `sample_prompts`: Gợi ý câu hỏi mẫu cho người dùng
- `provided_data_types`: Các loại dữ liệu Agent có (dùng cho `/data?type=...`)

**Ví dụ:** [https://portal.neu.edu.vn/api/demo_agent/v1/metadata](https://portal.neu.edu.vn/api/demo_agent/v1/metadata)

---

### 3.3 Endpoint `/data` – Lấy dữ liệu (tùy chọn)

**Mục đích:** Cho phép xem dữ liệu mà Agent đang sở hữu (phục vụ gợi ý, tìm kiếm).

**Request:**

```
GET /v1/data?type=documents
```

**Response mẫu:**

```json
{
  "status": "success",
  "data_type": "documents",
  "items": [
    {"id": "doc123", "title": "AI in Education", "summary": "Tổng quan ứng dụng AI trong giáo dục"},
    {"id": "doc124", "title": "Machine Learning Basics", "summary": "Các khái niệm cơ bản"}
  ],
  "last_updated": "2025-08-15T08:00:00Z"
}
```

**Ví dụ:** [https://portal.neu.edu.vn/api/demo_agent/v1/data](https://portal.neu.edu.vn/api/demo_agent/v1/data)

---

### 3.4 Endpoint `/ask` – Xử lý yêu cầu

**Mục đích:** Nhận prompt và context, xử lý logic/LLM, trả về câu trả lời Markdown.

#### 3.4.1 Request – Payload gửi đến Agent

**Method:** `POST`  
**Content-Type:** `application/json`

```json
{
  "session_id": "bdbb0a79-1122-4f9e-9934-5635695dc661",
  "model_id": "gpt-4o",
  "user": "https://portal.neu.edu.vn/api/users/email/lampx@neu.edu.vn",
  "prompt": "Nói thêm về tài liệu",
  "context": {
    "language": "vi",
    "project": "https://portal.neu.edu.vn/api/projects/d9f7sd93-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "extra_data": {
      "document": [
        "https://portal.neu.edu.vn/.../file.pdf"
      ]
    },
    "history": [
      {"role": "user", "content": "Xin chào"},
      {"role": "assistant", "content": "Chào bạn! Bạn cần hỗ trợ gì?"}
    ]
  }
}
```

**Các trường bắt buộc:**

| Trường       | Kiểu   | Mô tả |
|--------------|--------|-------|
| `session_id` | string | ID phiên chat |
| `model_id`   | string | Mô hình LLM (phải nằm trong `supported_models`) |
| `user`       | string | URL thông tin user (có thể gọi API để lấy chi tiết) |
| `prompt`     | string | Câu hỏi/yêu cầu của người dùng |

**Trường `context` (tùy chọn):**

| Trường     | Kiểu   | Mô tả |
|------------|--------|-------|
| `language` | string | Ngôn ngữ ưu tiên (ví dụ: `vi`, `en`) |
| `project`  | string | **URL API project** – Gọi `GET project` để lấy thông tin dự án |
| `extra_data.document` | string[] | Danh sách URL file đính kèm (PDF, DOCX, v.v.) |
| `history`  | array  | Lịch sử hội thoại `[{role, content}, ...]` |

**Lưu ý cho Developer:**

- `user` là URL dạng `/api/users/email/{email}` – Agent có thể `GET` để lấy hồ sơ user (tên, khoa, định hướng, công bố).
- `project` là URL dạng `/api/projects/{id}` – Agent có thể `GET` để lấy thông tin dự án (tên, mô tả, thành viên, file đính kèm).

#### 3.4.2 Response – Định dạng trả về

**Trả lời thành công:**

```json
{
  "session_id": "bdbb0a79-1122-4f9e-9934-5635695dc661",
  "status": "success",
  "content_markdown": "## Tóm tắt\nBài báo trình bày...",
  "meta": {
    "model": "gpt-4o",
    "response_time_ms": 1420,
    "tokens_used": 312
  },
  "attachments": [
    {"type": "pdf", "url": "https://example.com/file.pdf"}
  ]
}
```

**Trường bắt buộc trong response:**

- `content_markdown`: Nội dung trả lời dạng **Markdown** (hệ thống hiển thị trực tiếp)
- Hoặc `answer` / `content` (hệ thống ưu tiên theo thứ tự: `content_markdown` > `answer` > `content`)

**Trường tùy chọn:**

- `sources`: Danh sách nguồn tham khảo
- `attachments`: File đính kèm (PDF, v.v.)
- `meta`: Thông tin thời gian phản hồi, token sử dụng

---

### 3.5 Đăng ký Agent trong trang Admin

1. Đăng nhập trang quản trị: [https://portal.neu.edu.vn/admin](https://portal.neu.edu.vn/admin)
2. Vào tab **Agents**
3. Thêm Agent mới với:
   - **Alias:** Tên ngắn, không dấu (ví dụ: `papers`, `experts`)
   - **Icon:** Chọn từ danh sách (FileText, Users, Database, v.v.)
   - **Base URL:** URL gốc của Agent (ví dụ: `https://your-server.com/v1` hoặc `http://localhost:8000/v1`)
   - **Routing hint:** Mô tả ngắn giúp Orchestrator chọn Agent (ví dụ: "Tài liệu, papers, tìm kiếm bài báo")

4. Nếu Agent chạy nội bộ (cùng backend), tích **Internal** và Base URL sẽ tự resolve sang `http://localhost:3001/api/{alias}_agent/v1`.

---

### 3.6 Testing & Debug

**Test metadata:**

```bash
curl https://portal.neu.edu.vn/api/demo_agent/v1/metadata
```

**Test ask:**

```bash
curl -X POST https://portal.neu.edu.vn/api/demo_agent/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "592badb9-5796-4ca6-8d3a-0fd55e01f93a",
    "model_id": "gpt-4o",
    "user": "https://portal.neu.edu.vn/api/users/email/lampx@neu.edu.vn",
    "prompt": "Tóm tắt bài báo Deep Learning in Healthcare",
    "context": {
      "project": "https://portal.neu.edu.vn/api/projects/xxx",
      "extra_data": {
        "document": ["https://portal.neu.edu.vn/.../file.pdf"]
      }
    }
  }'
```

**Test trên trang Admin:** Vào tab **Agents** → chọn Agent → **Test API** để gửi request mẫu và xem payload/response.

---

### 3.7 Checklist phát triển Agent mới

- [ ] Triển khai `GET /metadata` trả JSON đúng format
- [ ] Triển khai `POST /ask` nhận payload, trả `content_markdown` (hoặc `answer`/`content`)
- [ ] (Tùy chọn) Triển khai `GET /data?type=...` nếu Agent có dữ liệu
- [ ] Xử lý `context.user` – gọi API user nếu cần thông tin người dùng
- [ ] Xử lý `context.project` – gọi API project nếu cần thông tin dự án
- [ ] Xử lý `context.extra_data.document` – tải và phân tích file đính kèm nếu cần
- [ ] Đăng ký Agent trong trang Admin
- [ ] Test qua curl và qua giao diện Admin

---

## 4. OpenAPI Specification rút gọn

```yaml
openapi: 3.0.3
info:
  title: Agent API
  version: 1.2.0
paths:
  /v1/metadata:
    get:
      summary: Lấy thông tin Agent và cấu hình
  /v1/data:
    get:
      summary: Lấy dữ liệu hiện có từ Agent
      parameters:
        - in: query
          name: type
          schema:
            type: string
          description: Loại dữ liệu (documents, experts, ...)
  /v1/ask:
    post:
      summary: Gửi yêu cầu đến Agent
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [session_id, model_id, user, prompt]
```

---

## 5. Các API hệ thống

### 5.1 Session chat – Lịch sử tin nhắn

```
GET https://portal.neu.edu.vn/api/chat/sessions/{session_id}/messages
```

### 5.2 User – Thông tin người dùng

```
GET https://portal.neu.edu.vn/api/users/email/{email}
```

Ví dụ: `GET .../api/users/email/lampx@neu.edu.vn`

### 5.3 Project – Thông tin dự án

```
GET https://portal.neu.edu.vn/api/projects/{project_id}
```

Trả về: id, name, description, user, team_members, file_keys, created_at, updated_at.

---

## 6. Database PostgreSQL

```
POSTGRES_HOST=101.96.66.223
POSTGRES_PORT=8013
POSTGRES_DB=ai_portal
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
```

---

## 7. MinIO – Lưu trữ file

### 7.1 Cấu hình

```
MINIO_ENDPOINT=203.113.132.48
MINIO_PORT=8008
MINIO_ACCESS_KEY=course2
MINIO_SECRET_KEY=course2-s3-uiauia
MINIO_BUCKET_NAME=ai-portal
```

### 7.2 Giao diện quản lý

- URL: http://203.113.132.48:8009  
- Access Key: course2  
- Secret Key: scrrect_key  

---

## 8. Ollama & LLM nội bộ

### 8.1 Endpoint Proxy

**Base URL:** [https://portal.neu.edu.vn/ollama](https://portal.neu.edu.vn/ollama)

| Tên mô hình          | ID            | Kích thước |
|----------------------|---------------|------------|
| deepseek-r1:32b      | edba8017331d  | 19 GB      |
| qwen3:8b             | 500a1f067a9f  | 5.2 GB     |
| qwen3-embedding:8b   | 64b933495768  | 4.7 GB     |
| mxbai-embed-large    | 468836162de7  | 669 MB     |
| ...                  | ...           | ...        |

### 8.2 Ví dụ Chat Completion

```bash
curl https://portal.neu.edu.vn/ollama/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:8b",
    "messages": [{"role": "user", "content": "Đâu là thủ đô của Việt Nam?"}]
  }'
```

### 8.3 Ví dụ Embedding

```bash
curl -X POST https://portal.neu.edu.vn/ollama/api/embed \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3-embedding", "input": "Apple"}'
```

---

## 9. API Tóm tắt & Embedding tài liệu

Endpoint kết hợp tóm tắt và sinh embedding:

```
POST https://portal.neu.edu.vn/ai/summarize_and_embed?provider=ollama
Content-Type: multipart/form-data
file: <file>
```

```bash
curl --location 'https://portal.neu.edu.vn/ai/summarize_and_embed?provider=ollama' \
  --form 'file=@"/path/to/document.pdf"'
```

---

## 10. Data Lake – Kiến trúc lưu trữ

### 10.1 Các zone chính

| Zone           | Mục đích |
|----------------|----------|
| `000_inbox/`   | Tiếp nhận tài liệu ban đầu |
| `100_raw/`     | Lưu trữ bản gốc bất biến (hash nội dung) |
| `200_staging/` | Phân tích format, validation |
| `300_processed/` | Dữ liệu AI-ready (text, chunks) |
| `400_embeddings/` | Artifact embedding |
| `500_catalog/` | Metadata, quyền truy cập, mapping file |

### 10.2 Nguyên tắc

- AI **chỉ đọc** từ `300_processed/` sau khi Catalog cho phép
- Không đọc trực tiếp `000_inbox/` hoặc `100_raw/`
- Mọi chunk/vector phải truy vết được về file gốc

### 10.3 Thông tin đăng nhập NAS

- Link: https://nasneucourse.quickconnect.to/
- User: portal  
- Cài đặt Synology Drive Client: [Download DS925+](https://www.synology.com/en-global/support/download/DS925+?version=7.3#utilities)
