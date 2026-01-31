# Hướng dẫn Triển khai Tự động với GitHub Actions và Docker

## Tổng quan

Dự án này sử dụng **GitHub Actions** với **self-hosted runner** để tự động build và deploy ứng dụng lên server thông qua Docker.

## Yêu cầu

- Server Linux với Docker và Docker Compose đã cài đặt
- Quyền truy cập vào GitHub repository
- Port 3000 (hoặc port bạn cấu hình) mở để truy cập ứng dụng

## Bước 1: Cài đặt Self-Hosted Runner

### 1.1. Tạo Self-Hosted Runner trên GitHub

1. Vào repository trên GitHub
2. Vào **Settings** → **Actions** → **Runners**
3. Click **New self-hosted runner**
4. Chọn hệ điều hành của server (Linux)
5. Copy các lệnh cài đặt được hiển thị

### 1.2. Cài đặt Runner trên Server

SSH vào server và chạy các lệnh đã copy từ GitHub:

```bash
# Tạo thư mục cho runner
mkdir actions-runner && cd actions-runner

# Download runner (thay <token> và <runner-name> bằng giá trị từ GitHub)
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Giải nén
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Cấu hình runner (sử dụng token từ GitHub)
./config.sh --url https://github.com/<your-username>/<your-repo> --token <token>

# Cài đặt như service để tự động chạy khi server khởi động
sudo ./svc.sh install

# Khởi động service
sudo ./svc.sh start

# Kiểm tra status
sudo ./svc.sh status
```

### 1.3. Kiểm tra Runner đã hoạt động

Vào lại GitHub → **Settings** → **Actions** → **Runners**, bạn sẽ thấy runner với status **Idle** (sẵn sàng nhận job).

## Bước 2: Cấu hình GitHub Secrets

Các biến môi trường cần thiết phải được cấu hình trong GitHub Secrets:

1. Vào repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Thêm các secrets sau:

### Database
- `POSTGRES_DB`: Tên database (ví dụ: `research_db`)
- `POSTGRES_USER`: Username PostgreSQL (ví dụ: `postgres`)
- `POSTGRES_PASSWORD`: Mật khẩu PostgreSQL

### NextAuth
- `NEXTAUTH_URL`: URL của ứng dụng (ví dụ: `https://research.neu.edu.vn`)
- `NEXTAUTH_SECRET`: Secret key (tạo bằng: `openssl rand -base64 32`)

### Azure AD (nếu dùng SSO)
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`

### API & Services
- `NEXT_PUBLIC_API_BASE_URL`: URL API base
- `OPENAI_API_KEY`: API key cho OpenAI

### MinIO (nếu dùng)
- `MINIO_ENDPOINT`
- `MINIO_ENDPOINT_PUBLIC`
- `MINIO_PORT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET_NAME`

### AWS S3 (nếu dùng thay MinIO)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`

## Bước 3: Kiểm tra Docker trên Server

Đảm bảo Docker và Docker Compose đã được cài đặt:

```bash
# Kiểm tra Docker
docker --version

# Kiểm tra Docker Compose
docker-compose --version
# hoặc
docker compose version
```

Nếu chưa cài đặt:

```bash
# Cài đặt Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Thêm user vào docker group (để chạy không cần sudo)
sudo usermod -aG docker $USER

# Cài đặt Docker Compose (nếu chưa có)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Bước 4: Triển khai

### Tự động (qua GitHub Actions)

Khi bạn push code lên branch `main`, workflow sẽ tự động:

1. Checkout code
2. Tạo file `.env` từ GitHub Secrets
3. Build Docker image
4. Deploy với Docker Compose
5. Kiểm tra health của ứng dụng

### Thủ công (nếu cần)

Nếu muốn deploy thủ công trên server:

```bash
# Clone repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# Tạo file .env từ .env.example và điền thông tin
cp .env.example .env
nano .env

# Deploy
docker-compose up -d --build

# Xem logs
docker-compose logs -f
```

Hoặc sử dụng script deploy:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## Bước 5: Kiểm tra Deployment

Sau khi deploy thành công:

1. Kiểm tra containers đang chạy:
   ```bash
   docker-compose ps
   ```

2. Kiểm tra logs:
   ```bash
   docker-compose logs app
   docker-compose logs postgres
   ```

3. Kiểm tra ứng dụng:
   ```bash
   curl http://localhost:3000
   ```

4. Truy cập qua browser: `http://your-server-ip:3000`

## Troubleshooting

### Runner không nhận job

1. Kiểm tra runner đang chạy:
   ```bash
   sudo ./svc.sh status
   ```

2. Xem logs của runner:
   ```bash
   sudo journalctl -u actions.runner.<your-runner-name> -f
   ```

3. Restart runner:
   ```bash
   sudo ./svc.sh restart
   ```

### Lỗi Docker permission

Nếu gặp lỗi permission với Docker:

```bash
sudo usermod -aG docker $USER
# Đăng xuất và đăng nhập lại
```

### Lỗi build Docker

1. Kiểm tra Dockerfile có đúng không
2. Kiểm tra disk space: `df -h`
3. Xóa images cũ: `docker image prune -a`

### Lỗi kết nối database

1. Kiểm tra PostgreSQL container đang chạy:
   ```bash
   docker-compose ps postgres
   ```

2. Kiểm tra logs:
   ```bash
   docker-compose logs postgres
   ```

3. Kiểm tra kết nối:
   ```bash
   docker-compose exec postgres psql -U postgres -d research_db
   ```

### Rollback về version cũ

Nếu deployment bị lỗi, có thể rollback:

```bash
# Xem các backup images
docker images | grep research-app

# Rollback về image backup
docker tag research-app:backup-YYYYMMDD-HHMMSS research-app:latest
docker-compose up -d
```

## Monitoring

### Xem logs real-time

```bash
docker-compose logs -f app
```

### Kiểm tra resource usage

```bash
docker stats
```

### Backup database

```bash
docker-compose exec postgres pg_dump -U postgres research_db > backup_$(date +%Y%m%d).sql
```

## Cấu trúc Files

```
.github/workflows/main.yml    # GitHub Actions workflow
Dockerfile                     # Docker image definition
docker-compose.yml            # Docker Compose configuration
.env.example                  # Template cho biến môi trường
scripts/deploy.sh             # Script deploy thủ công
```

## Lưu ý Bảo mật

1. **Không commit file `.env`** vào Git
2. Sử dụng **GitHub Secrets** cho tất cả thông tin nhạy cảm
3. Đảm bảo **firewall** chỉ mở các port cần thiết
4. Sử dụng **HTTPS** cho production (cấu hình reverse proxy như Nginx)
5. Thường xuyên **update Docker images** để có security patches mới nhất

## Tài liệu tham khảo

- [GitHub Actions Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
