# Hướng dẫn tích hợp AI Agent vào Hệ thống chung

## 1. Giới thiệu

Hệ thống nghiên cứu gồm nhiều **AI Agent** (mỗi Agent = một trợ lý độc lập) do các nhóm khác nhau phát triển, và 1. **AI Orchestrator** điều phối
Mỗi **AI Agent**:

* Đảm nhận một tác vụ chuyên biệt
* Có thể sử dụng LLM, RAG, thuật toán ML hoặc logic xử lý riêng
* Triển khai độc lập trên các server khác nhau
* Giao tiếp qua API chuẩn **OpenAPI 3.0+**

**AI Orchestrator** đóng vai trò:

* Nhận yêu cầu người dùng
* Chọn đúng Agent phù hợp
* Gọi API của Agent theo chuẩn **OpenAPI 3.0+**

## 2. Yêu cầu chung cho mỗi AI Agent
Có các endpoint:
* **/metadata** – thông tin cấu hình & khả năng của Agent (bắt buộc)
* **/data** – trả về dữ liệu hiện có của Agent (nếu có)
* **/ask** – xử lý yêu cầu, trả về markdown (bắt buộc)

## 3. Endpoint /metadata – khai báo Agent

**Mục đích**: Khai báo cấu hình và khả năng của Agent
**Response:**
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
**Ví dụ**: [https://research.neu.edu.vn/api/demo_agent/v1/metadata](https://research.neu.edu.vn/api/demo_agent/v1/metadata)

## 4. Endpoint /data – Lấy dữ liệu hiện có

**Mục đích**: Cho phép xem dữ liệu mà Agent đang sở hữu, phục vụ gợi ý tìm kiếm hoặc hiển thị trước.

**Ví dụ Request:**

```python
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
**Ví dụ**: [https://research.neu.edu.vn/api/demo_agent/v1/data](https://research.neu.edu.vn/api/demo_agent/v1/data)

## 5. Endpoint /ask – Xử lý Prompt
Nhận prompt và model cần dùng để Agent xử lý.
**Request:**
Sử dụng giao thức **POST** với payload như sau:

```python
{
  session_id: "96f343da-10d9-43a4-93df-52563a5dc644",
  model_id: "gpt-4.1",
  user: "demo-user",
  prompt: "Thành phố này có bao nhiêu người?",
  context: {
    language: "vi",
    project: "d9f7sd93",
    "extra_data": {
      "document": ["tailieu2-sds23f3.pdf", "tailieu1-43dfg34.pdf"],
    },
    history: [
      {
        role: "user",
        content: "thành phố lớn nhất thế giới",
      },
      {
        role: "assistant",
        content: "Thành phố lớn nhất thế giới tính theo dân số là Tokyo (Nhật Bản), với khu vực đô thị có trên 37 triệu dân. Nếu tính theo diện tích, thành phố lớn nhất là New York (Mỹ).",
      },
    ],
  },
}
```

**Response:**

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

**Ví dụ:**
```python
curl --location 'http://localhost:3000/api/demo_agent/v1/ask' \
--header 'Content-Type: application/json' \
--data-raw '{
  "session_id": "592badb9-5796-4ca6-8d3a-0fd55e01f93a",
  "model_id": "gpt-4o",
  "user": "https://research.neu.edu.vn/users/lampx@neu.edu.vn",
  "prompt": "Tóm tắt bài báo '\''Deep Learning in Healthcare'\''",
  "context": {
    "project": "https://research.neu.edu.vn/projects/d9f7sd93",
    "extra_data": {
      "document": ["https://research.neu.edu.vn/documents/tailieu2-sds23f3.pdf", "https://research.neu.edu.vn/documents/tailieu1-43dfg34.pdf"]
    }
  }
}'
```

## 6. OpenAPI Specification rút gọn

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
## 7. Các API

**Session chat:**
Sử dụng API sau để lấy lịch sử chat:
https://research.neu.edu.vn/api/chat/sessions/592badb9-5796-4ca6-8d3a-0fd55e01f93a/messages

(Thay 592badb9-5796-4ca6-8d3a-0fd55e01f93a bằng session_id)

## 8. Databases Postgres
POSTGRES_HOST=101.96.66.223
POSTGRES_PORT=8017
POSTGRES_DB=research_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword