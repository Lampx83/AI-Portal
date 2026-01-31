# Hướng dẫn triển khai với Docker

## Yêu cầu

- Docker >= 20.10
- Docker Compose >= 2.0

## Cài đặt nhanh

### 1. Tạo file `.env`

Sao chép file `.env.example` thành `.env` và cập nhật các giá trị:

```bash
cp .env.example .env
```

Chỉnh sửa file `.env` và điền các thông tin cần thiết, đặc biệt là:
- `NEXTAUTH_SECRET`: Tạo một secret key ngẫu nhiên (có thể dùng: `openssl rand -base64 32`)
- `POSTGRES_PASSWORD`: Mật khẩu cho database
- `AZURE_AD_*`: Thông tin Azure AD nếu sử dụng SSO

### 2. Build và chạy ứng dụng

```bash
# Build và start tất cả services
docker-compose up -d

# Xem logs
docker-compose logs -f

# Xem logs của một service cụ thể
docker-compose logs -f app
docker-compose logs -f postgres
```

### 3. Khởi tạo database

Database sẽ tự động được khởi tạo với schema từ `schema.sql` khi container PostgreSQL chạy lần đầu.

Nếu cần chạy lại schema:

```bash
docker-compose exec postgres psql -U postgres -d research_db -f /docker-entrypoint-initdb.d/01-schema.sql
```

## Development Mode

Để chạy ở chế độ development với hot-reload:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Các lệnh hữu ích

### Dừng services
```bash
docker-compose down
```

### Dừng và xóa volumes (xóa dữ liệu database)
```bash
docker-compose down -v
```

### Rebuild ứng dụng sau khi thay đổi code
```bash
docker-compose build app
docker-compose up -d app
```

### Truy cập vào container
```bash
# Vào container app
docker-compose exec app sh

# Vào container postgres
docker-compose exec postgres psql -U postgres -d research_db
```

### Xem status
```bash
docker-compose ps
```

### Restart một service
```bash
docker-compose restart app
docker-compose restart postgres
```

## Kiểm tra ứng dụng

Sau khi khởi động, ứng dụng sẽ chạy tại:
- **Application**: http://localhost:3000
- **PostgreSQL**: localhost:5432

## Troubleshooting

### Lỗi kết nối database

Kiểm tra xem PostgreSQL đã sẵn sàng:
```bash
docker-compose exec postgres pg_isready -U postgres
```

### Xem logs để debug
```bash
docker-compose logs app
docker-compose logs postgres
```

### Reset hoàn toàn
```bash
# Dừng và xóa tất cả
docker-compose down -v

# Xóa images
docker-compose down --rmi all

# Build lại từ đầu
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

Để deploy lên production:

1. Cập nhật `.env` với các giá trị production
2. Đảm bảo `NEXTAUTH_URL` trỏ đến domain thực tế
3. Sử dụng reverse proxy (nginx/traefik) để handle SSL
4. Backup database thường xuyên:

```bash
docker-compose exec postgres pg_dump -U postgres research_db > backup.sql
```

## Health Checks

Các services có health checks tự động:
- PostgreSQL: Kiểm tra mỗi 10s
- App: Kiểm tra mỗi 30s

Xem trạng thái:
```bash
docker-compose ps
```
