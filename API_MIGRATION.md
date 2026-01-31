# API Migration Summary

## Đã chuyển các API routes từ Frontend sang Backend

### ✅ Đã chuyển sang Backend

1. **Chat API** (`/api/chat/*`)
   - `GET /api/chat/sessions` - Lấy danh sách sessions
   - `POST /api/chat/sessions` - Tạo session mới
   - `GET /api/chat/sessions/:sessionId/messages` - Lấy messages
   - `POST /api/chat/sessions/:sessionId/messages` - Thêm message
   - `POST /api/chat/sessions/:sessionId/send` - Gửi message và gọi AI
   - `GET /api/chat/messages/:messageId` - Lấy chi tiết message

2. **Orchestrator API** (`/api/orchestrator/*`)
   - `POST /api/orchestrator/v1/ask` - Gọi AI orchestrator

3. **Agents API** (`/api/agents/*`)
   - `GET /api/agents/experts` - Proxy đến experts agent
   - `GET /api/agents/documents` - Proxy đến documents agent
   - `GET /api/agents/review` - Proxy đến review agent

4. **Upload API** (`/api/upload`)
   - `POST /api/upload` - Upload files lên S3/MinIO

5. **Demo Agent API** (`/api/demo_agent/*`)
   - `GET /api/demo_agent/v1/metadata` - Metadata của demo agent
   - `GET /api/demo_agent/v1/data` - Lấy dữ liệu demo
   - `POST /api/demo_agent/v1/ask` - Gọi demo agent

### ✅ Giữ lại trong Frontend

1. **NextAuth API** (`/api/auth/[...nextauth]`)
   - Giữ lại vì NextAuth cần chạy trong Next.js environment
   - Route này vẫn cần database connection để quản lý users

## Cấu trúc sau khi migration

### Backend (`/backend/src/routes/`)
```
routes/
├── chat.ts          # Chat sessions & messages
├── orchestrator.ts  # AI orchestrator
├── agents.ts        # Agent proxies
├── upload.ts        # File upload
└── demo-agent.ts    # Demo agent routes
```

### Frontend (`/frontend/app/api/`)
```
api/
└── auth/
    └── [...nextauth]/
        └── route.ts  # NextAuth (giữ lại)
```

## Cập nhật Frontend

Tất cả API calls trong frontend đã được cập nhật để gọi backend API thông qua:
- `NEXT_PUBLIC_API_BASE_URL` environment variable
- Default: `http://localhost:3001`

## Next.js Config

Đã xóa rewrites trong `next.config.mjs` vì tất cả API routes đã được chuyển sang backend.

## Testing

Sau khi migration, test các endpoints:

```bash
# Backend health check
curl http://localhost:3001/health

# Chat API
curl http://localhost:3001/api/chat/sessions

# Demo Agent
curl http://localhost:3001/api/demo_agent/v1/metadata

# NextAuth (vẫn ở frontend)
curl http://localhost:3000/api/auth/signin
```

## Notes

- Frontend vẫn cần database connection cho NextAuth
- Tất cả business logic API đã được chuyển sang backend
- Frontend chỉ còn NextAuth route và UI components
