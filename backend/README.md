# Backend API Server

Backend API server cho AI Portal, được xây dựng với Express.js và TypeScript.

## Cấu trúc

```
backend/
├── src/
│   ├── lib/              # Shared libraries
│   │   ├── db.ts         # Database connection pool
│   │   ├── config.ts     # Configuration
│   │   └── orchestrator/ # Agent client utilities
│   ├── routes/           # API routes
│   │   ├── chat.ts       # Chat sessions & messages
│   │   ├── orchestrator.ts # AI orchestrator
│   │   ├── agents.ts     # Agent proxies
│   │   └── upload.ts     # File upload
│   └── server.ts         # Express server entry point
├── package.json
├── tsconfig.json
└── Dockerfile
```

## API Endpoints

### Chat
- `GET /api/chat/sessions` - Lấy danh sách sessions
- `POST /api/chat/sessions` - Tạo session mới
- `GET /api/chat/sessions/:sessionId/messages` - Lấy messages của session
- `POST /api/chat/sessions/:sessionId/messages` - Thêm message
- `POST /api/chat/sessions/:sessionId/send` - Gửi message và gọi AI
- `GET /api/chat/messages/:messageId` - Lấy chi tiết message

### Orchestrator
- `POST /api/orchestrator/v1/ask` - Gọi AI orchestrator

### Agents
- `GET /api/agents/experts` - Proxy đến experts agent
- `GET /api/agents/documents` - Proxy đến documents agent
- `GET /api/agents/review` - Proxy đến review agent

### Upload
- `POST /api/upload` - Upload files lên S3/MinIO

### Health
- `GET /health` - Health check endpoint

## Setup

### Development

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env` từ `.env.example` ở root:
```bash
cp ../.env.example ../.env
```

3. Cập nhật các biến môi trường trong `.env` ở root

4. Chạy development server:
```bash
npm run dev
```

Server sẽ chạy tại `http://localhost:3001`

### Production

Build và chạy:
```bash
npm run build
npm start
```

Hoặc sử dụng Docker:
```bash
docker build -t ai-portal-backend .
docker run -p 3001:3001 --env-file .env ai-portal-backend
```

## Environment Variables

Xem `.env.example` ở root directory để biết danh sách đầy đủ các biến môi trường cần thiết.

## Database

Backend sử dụng PostgreSQL. Schema được định nghĩa trong `schema.sql` (trong thư mục backend).

## CORS

CORS được cấu hình để cho phép requests từ frontend. Cập nhật `CORS_ORIGIN` trong `.env` để thay đổi origin được phép.
