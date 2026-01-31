# NEU Research System

Hệ thống AI hỗ trợ nghiên cứu NEU với kiến trúc tách biệt Frontend và Backend.

## Cấu trúc

```
Research/
├── backend/          # Backend API Server (Express.js)
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── frontend/         # Frontend Application (Next.js)
│   ├── app/
│   ├── Dockerfile
│   └── package.json
├── schema.sql        # PostgreSQL database schema
├── docker-compose.yml # Docker Compose configuration
├── .env.example      # Environment variables template
└── README.md         # This file
```

## Quick Start với Docker

1. **Tạo file `.env` từ template:**
   ```bash
   cp .env.example .env
   ```

2. **Cập nhật các biến môi trường trong `.env`** (đặc biệt là `OPENAI_API_KEY`, `NEXTAUTH_SECRET`)

3. **Khởi động tất cả services:**
   ```bash
   docker-compose up -d
   ```

4. **Kiểm tra services:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - PostgreSQL: localhost:5432

5. **Xem logs:**
   ```bash
   docker-compose logs -f
   ```

6. **Dừng services:**
   ```bash
   docker-compose down
   ```

## Development (không dùng Docker)

### Backend
```bash
cd backend
npm install
# Tạo .env từ .env.example ở root và cập nhật
npm run dev  # Chạy tại http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
# Tạo .env.local với NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
npm run dev  # Chạy tại http://localhost:3000
```

### PostgreSQL
Cần chạy PostgreSQL riêng hoặc dùng Docker:
```bash
docker run -d \
  --name research_postgres \
  -e POSTGRES_DB=research_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

## Services

- **PostgreSQL**: Database server (port 5432)
- **Backend**: Express.js API server (port 3001)
- **Frontend**: Next.js application (port 3000)

## Environment Variables

Xem `.env.example` để biết danh sách đầy đủ các biến môi trường cần thiết.

## Kiến trúc hệ thống

Hệ thống gồm nhiều **AI Agent** (mỗi Agent = một trợ lý độc lập) do các nhóm khác nhau phát triển, và 1 **AI Orchestrator** điều phối.

Mỗi **AI Agent**:
- Đảm nhận một tác vụ chuyên biệt
- Có thể sử dụng LLM, RAG, thuật toán ML hoặc logic xử lý riêng
- Triển khai độc lập trên các server khác nhau
- Giao tiếp qua API chuẩn **OpenAPI 3.0+**

**AI Orchestrator** đóng vai trò:
- Nhận yêu cầu người dùng
- Chọn đúng Agent phù hợp
- Gọi API của Agent theo chuẩn **OpenAPI 3.0+**

## Yêu cầu chung cho mỗi AI Agent

Mỗi Agent cần có các endpoint:
- **/metadata** – thông tin cấu hình & khả năng của Agent (bắt buộc)
- **/data** – trả về dữ liệu hiện có của Agent (nếu có)
- **/ask** – xử lý yêu cầu, trả về markdown (bắt buộc)

### Endpoint /metadata

**Mục đích**: Khai báo cấu hình và khả năng của Agent

**Response:**
```json
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
    }
  ],
  "sample_prompts": [
    "Tóm tắt bài báo về học sâu trong y tế",
    "Giải thích khái niệm 'federated learning' trong AI"
  ],
  "provided_data_types": [
    {
      "type": "documents",
      "description": "Danh sách và thông tin tóm tắt các tài liệu nghiên cứu mà Agent lưu trữ"
    }
  ],
  "contact": "email@example.com",
  "status": "active"
}
```

### Endpoint /ask

**Request:**
```json
{
  "session_id": "bdbb0a79-1122-4f9e-9934-5635695dc661",
  "model_id": "gpt-4o",
  "user": "demo-user",
  "prompt": "Nói thêm về tài liệu",
  "context": {
    "language": "vi",
    "project": "demo-project",
    "extra_data": {
      "document": [
        "http://example.com/document.pdf"
      ]
    },
    "history": [
      {
        "role": "user",
        "content": "test"
      },
      {
        "role": "assistant",
        "content": "Chào bạn!"
      }
    ]
  }
}
```

**Response:**
```json
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

## Database Schema

Database schema được định nghĩa trong `schema.sql`. Schema bao gồm:
- `research_chat.users` - Người dùng
- `research_chat.chat_sessions` - Phiên chat
- `research_chat.messages` - Tin nhắn
- `research_chat.message_attachments` - File đính kèm

## Documentation

- [Backend README](./backend/README.md)
- [Backend Migration Guide](./BACKEND_MIGRATION.md)

## Hạ tầng Ollama & các mô hình LLM nội bộ

Hệ thống đã triển khai **Ollama** cùng khoảng **15 mô hình LLM** trên các server nội bộ, đồng thời cấu hình **Proxy API** để các thầy cô và nhóm nghiên cứu có thể **gọi API thống nhất**.

### Endpoint Ollama Proxy

**Base URL:** https://research.neu.edu.vn/ollama

Endpoint này tương thích với **OpenAI-style API**, cho phép sử dụng trực tiếp trong các thư viện, framework hoặc công cụ hiện có.

### Ví dụ gọi Chat Completion

```bash
curl https://research.neu.edu.vn/ollama/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3:8b",
    "messages": [
      {
        "role": "user",
        "content": "Đâu là thủ đô của Việt Nam?"
      }
    ]
  }'
```

### Ví dụ gọi API Embedding

```bash
curl -X POST https://research.neu.edu.vn/ollama/api/embed \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-embedding",
    "input": "Apple"
  }'
```

## MinIO Storage

Hệ thống sử dụng **MinIO** để lưu trữ các file, tài liệu phục vụ cho các AI Agent và dự án nghiên cứu.

### Cấu hình MinIO

```env
MINIO_ENDPOINT=203.113.132.48
MINIO_PORT=8008
MINIO_ACCESS_KEY=course2
MINIO_SECRET_KEY=course2-s3-uiauia
MINIO_BUCKET_NAME=research
```

### Truy cập giao diện quản lý

```
http://203.113.132.48:8009
Access Key: course2
Secret Key: scrrect_key
```

## API tổng hợp: Tóm tắt & Embedding tài liệu

Hệ thống cung cấp endpoint **kết hợp xử lý tóm tắt và sinh embedding**:

```
https://research.neu.edu.vn/ai/summarize_and_embed
```

**Ví dụ sử dụng:**
```bash
curl --location 'https://research.neu.edu.vn/ai/summarize_and_embed?provider=ollama' \
  --form 'file=@"/path/to/document.pdf"'
```
