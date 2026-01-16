# Hướng dẫn kỹ thuật

## 1. Giới thiệu

Hệ thống AI hỗ trợ nghiên cứu gồm nhiều **AI Agent** (mỗi Agent = một trợ lý độc lập) do các nhóm khác nhau phát triển, và 1. **AI Orchestrator** điều phối
Mỗi **AI Agent**:

* Đảm nhận một tác vụ chuyên biệt
* Có thể sử dụng LLM, RAG, thuật toán ML hoặc logic xử lý riêng
* Triển khai độc lập trên các server khác nhau
* Giao tiếp qua API chuẩn **OpenAPI 3.0+**

**AI Orchestrator** đóng vai trò:

* Nhận yêu cầu người dùng
* Chọn đúng Agent phù hợp
* Gọi API của Agent theo chuẩn **OpenAPI 3.0+**

## Kiến trúc chung cho toàn bộ hệ thống
```
┌─────────────────────────────────────────────────────────────┐
│                             USERS                           │
│                   Chatbot / Research Web/App                │
└─┬─────────────────────────────┬───────────────────────────┬─┘
  │                      HTTPS  │  JWT / OAuth2             |
  │                             ▼                           |
  │  ┌───────────────────────────────────────────────────┐  |
  │  │                AI ORCHESTRATOR CORE               │  |
  │  │                (Điều phối trung tâm)              │  |
  │  │                                                   │  |
  │  │  - Phân tích intent / ngữ cảnh                    │  |
  │  │  - Điều phối Agent (single / multi-agent)         ├──┼──────────────┐ 
  │  │  - Quản lý session & project context              │  |              |
  │  │  - Chuẩn hoá prompt / response                    │  |              |
  │  │  - Ghi log & metric                               │  |              |
  │  └───────────┬───────────────────────────────┬───────┘  |              |
  │              │ REST / OpenAPI                │   Async  |              |
  ▼              ▼                               ▼   Tasks  ▼              |
┌──────────────────────────────────┐   ┌──────────────────────┐            |
│             AI AGENT             │   │    MESSAGE QUEUE     │            |
│       (Triển khai phân tán)      │   │   RabbitMQ / Redis   │            |
│                                  │   │                      │            |
│ ┌──────────────────────────────┐ │   │ - Crawl định kỳ      │            |
│ │ Agent 1 – Trợ lý tài liệu    │ │   │ - OCR / Chunking     │            ▼    
│ │ Agent 2 – Trợ lý chuyên gia  │ │   │ - Long tasks         │    ┌────────────────┐   
│ │ Agent 3 – Viết nghiên cứu    │ │   │ - Multi-agent flow   │    │                |  
│ │ Agent 4 – Dữ liệu, phân tích │ │   └───────────┬──────────┘    │                |
│ │ Agent 5 – Phản biện/Đạo văn  │ │               │               │                | 
│ │ Agent 6 – ...                │ │◀─-------------┘               │                |
│ └──────────────────────────────┘ │                               │                |
└─────────────┬──┬─────────────────┘                               │                |
              |  |                                                 │                │
              ▼  └────────────────────────────────────────────────▶|                |
┌──────────────────────────────────────────────────────────────┐   │                |
│               SERVER WEB / RAG BACKEND                       │   │                | 
│        (Python / Node / LangChain / LlamaIndex...)           │   │                |
│                                                              │   │                |
│  - Context builder                                           │   │                |
│  - Vector search + metadata query                            │   │                |
│  - File access control                                       │   │   AI CLOUD /   |
│                                                              │   |   ON PREMISE   |
│   ┌──────────────────────┐      ┌────────────────────────┐   ├──▶│                |
│   │  VECTOR DATABASE     │      │       POSTGRESQL       │   │   │- Embedding API |
│   │ (Qdrant / Milvus)    │      │  Metadata / Projects   │   │   │- LLM API       |
│   │ - embeddings         │      │  Users / Permissions   │   │   │                | 
│   │ - similarity search  │      │  Chat / Agent logs     │   │   │                |
│   └──────────┬───────────┘      └───────────┬────────────┘   │   │                |
│              │                              │                │   │                |
│              └────────── Context / Files ───┘                │   │                |
└──────────────────────────┬───────────────────────────────────┘   │                |
                           │ NFS / SMB / S3                        │                |
                           ▼                                       │                |
┌──────────────────────────────────────────────────────────────┐   │                |
│                  NAS SYNOLOGY – DATA LAKE                    │   │                |
│                                                              │   └────────────────┘
│  000_inbox/        – Ingestion zone                          │            ▲
│  100_raw/          – Immutable raw storage                   |            |
│  200_staging/      – Validation & format analysis zone       │            |
│  300_processed/    – Processed content zone                  ├────────────┘
│  400_embeddings/   – Embedding & vector artifacts            |
│  500_catalog/      – Catalog & metadata                      │
│  /backup/          – NAS snapshot & system backup            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│        MONITORING – GOVERNANCE – ADMIN DASHBOARD             │
│                                                              │
│  - Trạng thái Agent (version, health, latency)               │
│  - Thống kê sử dụng, token, chi phí                          │
│  - Alert Agent fail / chậm (Email)                           │
│                                                              │
│  Công nghệ: Prometheus / Grafana / Next.js Admin             │
└──────────────────────────────────────────────────────────────┘
```
## 3. Yêu cầu chung cho mỗi AI Agent
Có các endpoint:
* **/metadata** – thông tin cấu hình & khả năng của Agent (bắt buộc)
* **/data** – trả về dữ liệu hiện có của Agent (nếu có)
* **/ask** – xử lý yêu cầu, trả về markdown (bắt buộc)

## 4. Endpoint /metadata – khai báo Agent

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

## 5. Endpoint /data – Lấy dữ liệu hiện có

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

## 6. Endpoint /ask – Xử lý Prompt
Nhận prompt và model cần dùng để Agent xử lý.
**Request:**
Sử dụng giao thức **POST** với payload như sau:

```python
{
  session_id: "bdbb0a79-1122-4f9e-9934-5635695dc661",
  model_id: "gpt-4.1",
  user: "demo-user",
  prompt: "Nói thêm về tài liệu",
  context: {
    language: "vi",
    project: "demo-project",
    extra_data: {
      document: [
        "http://203.113.132.48:8008/research/user@example.com/Ten_tai_lieu_992c8e48f9_20250928103819162.md",
      ],
    },
    history: [
      {
        role: "user",
        content: "test",
      },
      {
        role: "assistant",
        content: "Chào bạn! Mình đã nhận được tin nhắn test. Bạn cần hỗ trợ gì về nghiên cứu hoặc tài liệu NEU không?",
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
## 8. Các API

**Session chat:**
Sử dụng API sau để lấy lịch sử chat:
https://research.neu.edu.vn/api/chat/sessions/592badb9-5796-4ca6-8d3a-0fd55e01f93a/messages

(Thay 592badb9-5796-4ca6-8d3a-0fd55e01f93a bằng session_id)

## 9. Databases Postgres
POSTGRES_HOST=101.96.66.223
POSTGRES_PORT=8013
POSTGRES_DB=research_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword

## 10. Hướng dẫn sử dụng MinIO

Hệ thống sử dụng **MinIO** để lưu trữ các file, tài liệu phục vụ cho các AI Agent và dự án nghiên cứu.

### 10.1 Cấu hình kết nối MinIO

Sử dụng các thông tin sau:

```python
MINIO_ENDPOINT=203.113.132.48
MINIO_PORT=8008
MINIO_ACCESS_KEY=course2
MINIO_SECRET_KEY=course2-s3-uiauia
MINIO_BUCKET_NAME=research
```
### 10.2 Truy cập giao diện đồ hoạ quản lý file

Bạn có thể quản lý file thông qua giao diện web tại:
http://203.113.132.48:8009
Access Key: course2
Secret Key: scrrect_key


## 11. Hạ tầng Ollama & các mô hình LLM nội bộ

Hệ thống đã triển khai **Ollama** cùng khoảng **15 mô hình LLM** trên các server nội bộ, đồng thời cấu hình **Proxy API** để các thầy cô và nhóm nghiên cứu có thể **gọi API thống nhất**, không cần quan tâm mô hình đang chạy ở đâu.

### 11.1 Endpoint Ollama Proxy

**Base URL:**
https://research.neu.edu.vn/ollama


## 11. Hạ tầng Ollama & các mô hình LLM nội bộ

Hệ thống đã triển khai **Ollama** cùng khoảng **15 mô hình LLM** trên các server nội bộ, đồng thời cấu hình **Proxy API** để các thầy cô và nhóm nghiên cứu có thể **gọi API thống nhất**, không cần quan tâm mô hình đang chạy ở đâu.

### 11.1 Endpoint Ollama Proxy

**Base URL:**

[https://research.neu.edu.vn/ollama](https://research.neu.edu.vn/ollama)

| Tên mô hình                     | ID            | Kích thước |
|---------------------------------|---------------|------------|
| deepseek-r1:32b                 | edba8017331d  | 19 GB      |
| gpt-oss:20b                     | 17052f91a42e  | 13 GB      |
| mxbai-embed-large:latest        | 468836162de7  | 669 MB     |
| nomic-embed-text:latest         | 0a109f422b47  | 274 MB     |
| qwen3-embedding:8b              | 64b933495768  | 4.7 GB     |
| qwen3:8b                        | 500a1f067a9f  | 5.2 GB     |
| qwen3-embedding:latest          | 64b933495768  | 4.7 GB     |
| gemma3:27b                      | a418f5838eaf  | 17 GB     |
| llama3.1:70b                    | 711a9e8463af  | 42 GB     |
| deepseek-r1:70b                 | d37b54d01a76  | 42 GB     |
| qwen3:32b                       | 030ee887880f  | 20 GB     |
| bge-m3:latest                   | 790764642607  | 1.2 GB    |
| nomic-embed-text:v1.5           | 0a109f422b47  | 274 MB    |
| qwen3:1.7b                      | 8f68893c685c  | 1.4 GB    |


````
Endpoint này tương thích với **OpenAI-style API**, cho phép sử dụng trực tiếp trong các thư viện, framework hoặc công cụ hiện có.


### 11.2 Ví dụ gọi Chat Completion (LLM)

**Ví dụ sử dụng mô hình `qwen3:8b`:**

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
````
**Ghi chú:**

* API tương thích với chuẩn `chat/completions`
* Có thể thay đổi `model` theo danh sách mô hình được cấp quyền
* Phù hợp để tích hợp vào Agent, Orchestrator hoặc script nghiên cứu

### 11.3 Ví dụ gọi API Embedding

**Ví dụ sử dụng mô hình embedding `qwen3-embedding`:**

```bash
curl -X POST https://research.neu.edu.vn/ollama/api/embed \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-embedding",
    "input": "Apple"
  }'
```

**Ứng dụng:**

* Sinh vector embedding cho văn bản
* Lưu vào Vector Database (Qdrant / Milvus)
* Phục vụ RAG, tìm kiếm ngữ nghĩa, clustering dữ liệu nghiên cứu


## 12. API tổng hợp: Tóm tắt & Embedding tài liệu

Hệ thống cung cấp endpoint **kết hợp xử lý tóm tắt và sinh embedding**, phục vụ trực tiếp cho nhu cầu xử lý tài liệu nghiên cứu (PDF, DOCX, …).

### 12.1 Endpoint

```
https://research.neu.edu.vn/ai/summarize_and_embed
```

### 12.2 Ví dụ sử dụng với Ollama

```bash
curl --location 'https://research.neu.edu.vn/ai/summarize_and_embed?provider=ollama' \
  --form 'file=@"/Users/mac/Documents/1.5 Writing SMART Learning Objectives.pdf"'
```

## 13. Data Lake – Kiến trúc lưu trữ & quản trị dữ liệu nghiên cứu

### 13.1 Mục tiêu của Data Lake

**Data Lake** trong hệ thống là **kho lưu trữ trung tâm** trên **NAS Synology**, phục vụ cho toàn bộ vòng đời dữ liệu nghiên cứu:

* Lưu trữ **bản gốc tài liệu nghiên cứu** (PDF, DOCX, dữ liệu thô)
* Hỗ trợ **pipeline xử lý dữ liệu cho AI** (parse, OCR, chunking, embedding)
* Đảm bảo:

  * **Tính bất biến (immutable)**
  * **Khả năng kiểm toán (audit)**
  * **Tái lập pipeline (reproducible)**
  * **Kiểm soát quyền truy cập**
* Đảm bảo nguyên tắc cốt lõi:
  **AI KHÔNG tự ý sử dụng dữ liệu nếu không được Catalog cho phép**

Data Lake **không phải** là thư mục chia sẻ thông thường, mà là **hạ tầng dữ liệu có phân vùng (zone-based), có vòng đời và có kiểm soát**.

### 13.2 Nguyên tắc thiết kế cốt lõi

1. **Tách vùng (Zone-based architecture)**
   Mỗi thư mục tương ứng một giai đoạn xử lý, không dùng lẫn.

2. **Bất biến dữ liệu gốc**
   Dữ liệu ở vùng `100_raw/` không bao giờ bị sửa.

3. **Mọi xử lý đều có dấu vết (traceable)**
   Từ chunk → file → nguồn gốc → người chịu trách nhiệm.

4. **Catalog là “nguồn sự thật duy nhất” (single source of truth)**
   Không Agent hay AI nào được dùng file nếu Catalog không cho phép.

### 13.3 Cấu trúc Data Lake & ý nghĩa từng zone

#### 13.3.1 `000_inbox/` – Ingestion Zone (vùng tiếp nhận)

**Mục đích:**
Tiếp nhận tài liệu ban đầu do con người hoặc đơn vị ngoài cung cấp.

* Chỉ yêu cầu **cấu trúc thư mục mức cao**, không yêu cầu chuẩn hoá sâu
* Ví dụ cấu trúc:

```
000_inbox/
  └── <chu_de>/
      └── <ngay_upload>/
          └── tai_lieu.pdf
```

**Lưu ý quan trọng:**

* Inbox **không phải** nơi AI sử dụng dữ liệu
* File trong inbox **chưa được tin cậy**

#### 13.3.2 `100_raw/` – Immutable Raw Storage

**Mục đích:**
Lưu trữ **bản gốc đã chuẩn hoá nhận dạng** của tài liệu.

Đặc điểm:

* Tên file = **hash nội dung** (ví dụ SHA-256)
* Đảm bảo:

  * Không trùng lặp (deduplication)
  * Phát hiện chỉnh sửa
  * Phục vụ audit và phục hồi

**Nguyên tắc bắt buộc:**

* Không chỉnh sửa file trong `100_raw/`
* Mọi bản cập nhật → file mới → hash mới

#### 13.3.3 `200_staging/` – Validation & Format Analysis

**Mục đích:**
Phân tích tài liệu để quyết định **cách xử lý phù hợp**.

Ví dụ artifact:

```
200_staging/<file_hash>/
  ├── pdf_profile.json
  ├── text_sample.txt
  └── validation.json
```

Nội dung phân tích:

* Có phải PDF scan hay không
* Có bảng, ảnh, công thức hay không
* Có cần OCR không

**Nguyên tắc:**

* ❌ Không lưu toàn bộ nội dung text
* ✔ Chỉ lưu metadata & mẫu nhỏ phục vụ quyết định pipeline

#### 13.3.4 `300_processed/` – Processed Content Zone

**Mục đích:**
Sinh dữ liệu **AI-ready** từ tài liệu gốc.

Ví dụ:

```
300_processed/<file_hash>/
  ├── clean_text.txt
  ├── sections.json
  ├── chunks.json
  └── tables.json
```

Đây là:

* Nguồn dữ liệu chính cho **RAG Backend**
* Nguồn sinh embedding

**Quy tắc quan trọng:**

* AI/Agent **chỉ nên đọc dữ liệu từ zone này**
* Không đọc trực tiếp từ `raw` hoặc `inbox`

#### 13.3.5 `400_embeddings/` – Embedding Artifacts

**Mục đích:**
Lưu trữ artifact trung gian liên quan đến embedding.

* Vector sinh từ `chunks.json`
* Có thể dùng để:

  * Debug
  * Audit
  * Regenerate vector database

**Lưu ý:**

* Vector “chính” thường nằm trong Qdrant/Milvus
* Zone này có thể tái tạo từ `300_processed`


#### 13.3.6 `500_catalog/` – Catalog & Metadata (CỰC KỲ QUAN TRỌNG)

**Mục đích:**
Quản trị toàn bộ vòng đời dữ liệu.

Catalog cần lưu:

* Danh tính file (hash, nguồn gốc)
* Mapping file ↔ đường dẫn NAS
* Trạng thái pipeline (raw → staging → processed → embedded)
* Quyền truy cập & trách nhiệm
* AI usage flags (được phép dùng hay không)

👉 **Nguyên tắc tuyệt đối:**
**AI KHÔNG tự quyết định sử dụng file – chỉ được dùng khi Catalog cho phép**

#### 13.3.7 `/backup/` – Backup & Snapshot

**Mục đích:**
Phục hồi hệ thống khi xảy ra sự cố.

* Snapshot NAS theo lịch
* Mapping snapshot ↔ file trong catalog

### 13.5 Chú ý với nhóm phát triển
Dòng chảy dữ liệu:
1. Upload → `000_inbox/`
2. Ingest → `100_raw/` + ghi Catalog
3. Validate → `200_staging/`
4. Process → `300_processed/`
5. Embed → `400_embeddings/` + Vector DB
6. AI/RAG:
   * Kiểm tra Catalog
   * Truy vấn Vector DB
   * Lấy nội dung từ `300_processed`
Thông tin đăng nhập
```
Link: https://nasneucourse.quickconnect.to/
research
L\w0'c%D
```
Cài đặt (Synology Drive Client): https://www.synology.com/en-global/support/download/DS925+?version=7.3#utilities 
* ❌ Không cho AI đọc trực tiếp `000_inbox/` hoặc `100_raw/`
* ❌ Không bypass Catalog
* ✔ Mọi chunk/vector phải truy vết được về file gốc
* ✔ Pipeline phải có version (chunking, embedding)