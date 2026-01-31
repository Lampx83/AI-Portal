# Hướng dẫn Khởi động Database

## Vấn đề: "Không thể kết nối đến database"

Lỗi này xảy ra khi backend không thể kết nối đến PostgreSQL database.

## Giải pháp

### Cách 1: Sử dụng Docker Compose (Khuyến nghị)

```bash
# Khởi động chỉ PostgreSQL
docker-compose up -d postgres

# Hoặc khởi động tất cả services
docker-compose up -d

# Kiểm tra status
docker-compose ps

# Xem logs
docker-compose logs postgres
```

### Cách 2: Sử dụng script helper

```bash
# Chạy script tự động
./scripts/start-db.sh
```

### Cách 3: Cài đặt PostgreSQL local (macOS)

```bash
# Cài đặt bằng Homebrew
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Hoặc start thủ công
pg_ctl -D /usr/local/var/postgresql@16 start
```

### Cách 4: Kiểm tra và sửa cấu hình

1. **Kiểm tra file `.env` ở root directory:**
   ```bash
   cat .env | grep POSTGRES
   ```
   
   Đảm bảo có các biến:
   ```
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=research_db
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   ```

2. **Kiểm tra PostgreSQL có đang chạy:**
   ```bash
   # Kiểm tra port
   nc -z localhost 5432
   
   # Hoặc kiểm tra process
   lsof -i :5432
   ```

3. **Kiểm tra backend có load được environment variables:**
   - Xem logs backend khi khởi động
   - Tìm dòng: `🔍 DB ENV CHECK:`
   - Đảm bảo các giá trị đúng

4. **Test kết nối database:**
   ```bash
   # Nếu dùng Docker
   docker-compose exec postgres psql -U postgres -d research_db
   
   # Nếu dùng local PostgreSQL
   psql -h localhost -U postgres -d research_db
   ```

## Troubleshooting

### Lỗi: "port is already allocated"
- Port 5432 đã được sử dụng bởi PostgreSQL khác
- Giải pháp: Dừng PostgreSQL cũ hoặc đổi port trong `.env`

### Lỗi: "connection refused"
- PostgreSQL không chạy hoặc không accessible
- Giải pháp: Start PostgreSQL (xem các cách trên)

### Lỗi: "authentication failed"
- Sai username/password
- Giải pháp: Kiểm tra `POSTGRES_USER` và `POSTGRES_PASSWORD` trong `.env`

### Backend không load được .env
- Backend đang chạy từ thư mục khác
- Giải pháp: Đảm bảo file `.env` ở root directory và backend load từ đúng path

## Kiểm tra Health Check

Sau khi start database, kiểm tra backend health:

```bash
curl http://localhost:3001/health
```

Kết quả mong đợi:
```json
{
  "status": "ok",
  "database": "connected"
}
```

Nếu database không kết nối được:
```json
{
  "status": "error",
  "database": "disconnected"
}
```
