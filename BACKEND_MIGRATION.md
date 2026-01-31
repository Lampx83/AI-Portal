# Backend Migration Guide

## Tổng quan

Backend đã được tách riêng từ Next.js API Routes sang một Express.js server độc lập.

## Cấu trúc mới

```
Research/
├── backend/              # Backend API server (Express.js)
│   ├── src/
│   │   ├── lib/         # Shared libraries
│   │   ├── routes/      # API routes
│   │   └── server.ts    # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/            # Next.js frontend
│   └── app/api/         # (Có thể giữ lại cho NextAuth hoặc xóa)
└── docker-compose.yml   # Updated với backend service
```

## Thay đổi chính

### 1. Backend Server (Port 3001)
- Express.js server với TypeScript
- Các API routes đã được chuyển từ Next.js sang Express
- Database connection pool (PostgreSQL)
- CORS được cấu hình cho frontend

### 2. Frontend Updates
- `lib/config.ts`: Cập nhật để trỏ đến backend API
- `lib/research-assistants.ts`: Cập nhật baseUrl cho orchestrator
- `components/chat-composer.tsx`: Cập nhật upload endpoint

### 3. API Endpoints

Tất cả các endpoints giữ nguyên path, chỉ thay đổi base URL:

**Trước:** `http://localhost:3000/api/...`  
**Sau:** `http://localhost:3001/api/...`

## Setup

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Cập nhật .env với các giá trị phù hợp
npm run dev  # Development
# hoặc
npm run build && npm start  # Production
```

### 2. Frontend Setup

```bash
cd frontend
# Thêm vào .env.local:
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
npm install
npm run dev
```

### 3. Docker Compose

```bash
# Từ root directory
docker-compose up -d
```

Services:
- `postgres`: Port 5432
- `backend`: Port 3001
- `frontend`: Port 3000

## Environment Variables

### Backend (.env)
```env
PORT=3001
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=research_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
OPENAI_API_KEY=your_key
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret
```

## Migration Checklist

- [x] Tạo backend folder structure
- [x] Setup Express server với TypeScript
- [x] Di chuyển API routes
- [x] Di chuyển lib files (db, config, orchestrator)
- [x] Cập nhật frontend để gọi backend API
- [x] Cập nhật docker-compose.yml
- [x] Tạo Dockerfile cho backend
- [x] Tạo README và documentation

## Testing

1. **Backend Health Check:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Test API Endpoint:**
   ```bash
   curl http://localhost:3001/api/chat/sessions
   ```

3. **Frontend:**
   - Mở http://localhost:3000
   - Kiểm tra Network tab để đảm bảo API calls đi đến port 3001

## Notes

- NextAuth routes (`/api/auth/[...nextauth]`) vẫn có thể giữ lại trong frontend nếu cần
- Các external agent proxies (`/api/agents/*`) đã được chuyển sang backend
- Database schema không thay đổi
- Tất cả API contracts giữ nguyên, chỉ thay đổi base URL

## Troubleshooting

### Backend không kết nối được database
- Kiểm tra `POSTGRES_HOST` và `POSTGRES_PORT` trong `.env`
- Đảm bảo PostgreSQL đang chạy
- Kiểm tra network trong docker-compose

### CORS errors
- Kiểm tra `CORS_ORIGIN` trong backend `.env`
- Đảm bảo frontend URL khớp với CORS_ORIGIN

### Frontend không gọi được backend
- Kiểm tra `NEXT_PUBLIC_API_BASE_URL` trong frontend `.env.local`
- Kiểm tra backend đang chạy tại port 3001
- Kiểm tra browser console và network tab
