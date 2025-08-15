# 📝 Hướng dẫn Chuẩn Tích Hợp AI Agent vào Hệ thống Nghiên cứu Chung

## 1. Giới thiệu

Hệ thống nghiên cứu AI gồm nhiều **AI Agent** (mỗi Agent = một trợ lý độc lập) do các nhóm khác nhau phát triển.
Mỗi Agent:

* Đảm nhận một tác vụ chuyên biệt
* Có thể sử dụng LLM, RAG, thuật toán ML hoặc logic xử lý riêng
* Triển khai độc lập trên các server khác nhau
* Giao tiếp qua API chuẩn **OpenAPI 3.0+**

**AI Orchestrator** đóng vai trò:

* Nhận yêu cầu người dùng
* Chọn đúng Agent phù hợp
* Gọi API của Agent và trả kết quả lại

---

## 2. Yêu cầu chung cho mỗi AI Agent

1. Triển khai độc lập, endpoint API riêng.
2. Xử lý yêu cầu tự động từ ngôn ngữ tự nhiên.
3. Hỗ trợ HTTP REST API theo chuẩn OpenAPI 3.0+.
4. Trả kết quả ở **định dạng Markdown**.
5. Có đầy đủ các endpoint bắt buộc:

   * `/metadata` – thông tin cấu hình & khả năng của Agent
   * `/ask` – xử lý yêu cầu
   * `/data` – trả về dữ liệu hiện có của Agent

---

## 3. Chuẩn khai báo Agent (/metadata)

Mục đích: Cho AI Orchestrator biết cấu hình và khả năng của Agent để hiển thị cho người dùng.

**Ví dụ Response `/metadata`:**

```python
{
  "name": "Document Assistant",
  "description": "Tìm kiếm, tóm tắt và giải thích tài liệu nghiên cứu",
  "version": "1.2.0",
  "developer": "Nhóm H Thắng, H Việt, X Lâm",
  "capabilities": ["search", "summarize", "explain"],
  "supported_models": [
    {
      "model_id": "gpt-4o",
      "name": "GPT-4o",
      "description": "Mô hình mạnh cho tóm tắt và giải thích chi tiết"
    },
    {
      "model_id": "gpt-4o-mini",
      "name": "GPT-4o Mini",
      "description": "Mô hình nhanh, tiết kiệm chi phí"
    }
  ],
  "sample_prompts": [
    "Tóm tắt bài báo về học sâu trong y tế",
    "Giải thích khái niệm 'federated learning' trong AI",
    "Tìm các bài nghiên cứu về biến đổi khí hậu năm 2024"
  ],
  "provided_data_types": [
    {
      "type": "documents",
      "description": "Danh sách và thông tin tóm tắt các tài liệu nghiên cứu mà Agent lưu trữ"
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

---

## 4. Endpoint `/data` – Lấy dữ liệu hiện có

Mục đích: Cho phép Orchestrator (và người dùng qua Orchestrator) xem dữ liệu mà Agent đang sở hữu, phục vụ gợi ý tìm kiếm hoặc hiển thị trước.

**Ví dụ Request:**

```
GET /v1/data?type=documents
Authorization: Bearer <token>
```

**Ví dụ Response:**

```python
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

---

## 5. Endpoint `/ask` – Xử lý yêu cầu

Nhận prompt và model cần dùng để Agent xử lý.

**Ví dụ Request:**

```python
{
  "session_id": "abc123",
  "user_id": "u456",
  "model_id": "gpt-4o",
  "prompt": "Tóm tắt bài báo 'Deep Learning in Healthcare'",
  "context": {
    "language": "vi",
    "project_id": "p789",
    "extra_data": {
      "document_ids": ["doc123", "doc124"],
      "search_filters": {
        "year": 2024,
        "keywords": ["deep learning", "healthcare"]
      }
    }
  }
}
```

**Ví dụ Response:**

```python
{
  "session_id": "abc123",
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

---

## 6. Chuẩn lỗi

**Ví dụ Response lỗi:**

```python
{
  "session_id": "abc123",
  "status": "error",
  "error_code": "INVALID_MODEL",
  "error_message": "Model yêu cầu không được hỗ trợ."
}
```

---

## 7. OpenAPI Specification rút gọn

```python
openapi: 3.0.3
info:
  title: Example Agent API
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
          description: Loại dữ liệu muốn lấy
  /v1/ask:
    post:
      summary: Gửi yêu cầu đến Agent với model cụ thể
```

---

