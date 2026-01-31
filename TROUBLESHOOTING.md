# Troubleshooting Guide

## Frontend không khởi động trong Docker

### Kiểm tra logs
```bash
docker-compose logs frontend
```

### Các vấn đề thường gặp:

1. **Build fails**
   - Kiểm tra xem có lỗi TypeScript/ESLint không
   - Xem logs: `docker-compose build frontend`

2. **Standalone output không đúng cấu trúc**
   - Next.js standalone output tạo `.next/standalone/` với `server.js` ở root
   - Đảm bảo `next.config.mjs` có `output: 'standalone'`

3. **Dependencies không đầy đủ**
   - Standalone output tự động include node_modules cần thiết
   - Nếu thiếu, có thể cần copy thêm từ builder stage

4. **Healthcheck fails**
   - Frontend cần thời gian để start (start_period: 60s)
   - Healthcheck check root path `/` thay vì `/health`

5. **Port conflicts**
   - Đảm bảo port 3000 không bị chiếm
   - Kiểm tra: `lsof -i :3000`

### Debug steps:

1. **Build riêng frontend:**
   ```bash
   cd frontend
   docker build -t research-frontend .
   docker run -p 3000:3000 research-frontend
   ```

2. **Kiểm tra standalone output:**
   ```bash
   cd frontend
   npm run build
   ls -la .next/standalone/
   # Kiểm tra xem server.js có tồn tại không
   ```

3. **Chạy frontend không chờ backend:**
   - Frontend có thể start mà không cần backend healthy
   - Chỉ cần backend `started` không phải `healthy`

4. **Kiểm tra environment variables:**
   ```bash
   docker-compose exec frontend env | grep NEXT_PUBLIC
   ```

### Quick fixes:

- **Tăng start_period:** Đã tăng lên 60s
- **Thay đổi depends_on:** Backend chỉ cần `started` không phải `healthy`
- **Healthcheck:** Check root `/` thay vì `/health`
