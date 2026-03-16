# Kiểm tra bảo mật & runaway CPU (aiportal-frontend)

## CVE-2025-66478 (React Server Components RCE)

**Next.js 15.x dùng App Router bị ảnh hưởng.** Đã nâng `next` lên **15.2.6** (bản đã vá). Nếu app từng chạy phiên bản chưa vá (15.2.4 trở xuống) khi có trên mạng trước khi patch, nên **xoay (rotate) toàn bộ secrets** (NEXTAUTH_SECRET, DB password, API keys, v.v.) sau khi deploy bản đã vá. Chi tiết: [Next.js Security Advisory CVE-2025-66478](https://nextjs.org/blog/security-advisory-cve-2025-66478), [React CVE-2025-55182](https://react.dev/blog/security-advisory-cve-2025-55182).

---

## Triệu chứng bạn mô tả

- **htop:** 8 CPU cores 100%, Load average ~8.86
- **docker stats:** `aiportal-frontend` **779% CPU**, **2233 PIDs**, ~2.5GB RAM
- **Process trong container:** `/app/2kXCNE -c /app/2e1JI -B` (8 process), `/app/AbUUKjg` (1 process)

## Phân tích

### 1. Tên process và file trong /app (đã xác minh trên server)

- **CMD đúng:** `[node server.js]` — container khởi động đúng theo Dockerfile.
- **Process tree:** `next-server` (PID 621102) là process cha, **spawn 2 process con:**
  - `/app/2kXCNE -c /app/2e1JI -B` — chiếm **~99% CPU** (đây là nguồn runaway).
  - `/app/AbUUKjg` — ~18% CPU.
- **Trong /app:** Có cả `server.js` (Next.js chuẩn) **và** các file `2e1JI`, `2kXCNE`, `AbUUKjg` (kích thước ~9KB, ~2.6MB, ~1.3MB; có quyền thực thi).

**Kết luận:** Image **đúng** là build từ Next.js (có `server.js` + `next-server`). Các file tên hash **do Next.js build sinh ra** (chunk/worker dùng content hash, thường là file JS được đặt tên dạng hash). Process **2kXCNE** là worker/child do Next.js spawn và đang ăn 99% CPU — khớp với **bug vòng lặp re-render** đã sửa trong `typewriter-markdown.tsx` (client-side loop có thể khiến server render/SSR hoặc worker xử lý liên tục).

### 2. 2233 PIDs là bất thường

- Next.js standalone thông thường: 1 process node + có thể vài worker (vài chục PIDs là nhiều).
- **2233 PIDs** = hàng nghìn process/thread → không phải hành vi chuẩn của Next.js trong repo này.

**Khả năng:**

- **Bug/leak:** vòng lặp tạo process/worker không giải phóng (đã xử lý một phần ở TypewriterMarkdown).
- **Lạm dụng:** container chạy thêm mã (miner, bot, proxy) tạo nhiều process.

### 3. Đã xử lý trong code (typewriter-markdown)

- Đã sửa vòng re-render vô hạn trong `components/ui/typewriter-markdown.tsx` (chỉ set state khi chuyển sang `hasCompleted`, tránh loop → 100% CPU).
- **Điều kiện:** bản fix chỉ có hiệu lực nếu server **deploy đúng image build từ repo có fix**. Nếu image cũ hoặc image build từ nguồn khác thì vẫn có thể bị loop hoặc process lạ.

---

## Bước kiểm tra ngay trên server

Chạy trên máy có container `aiportal-frontend` (ví dụ `codelab@nct-r750-2-vm1`).

### Bước 1: Image đang chạy có đúng không?

```bash
# CMD/ENTRYPOINT thực tế
docker inspect aiportal-frontend --format '{{.Config.Cmd}}' '{{.Config.Entrypoint}}'

# Image ID và tag
docker inspect aiportal-frontend --format '{{.Image}}'
docker images --no-trunc | grep aiportal-frontend
```

- Nếu `Cmd` là `[node server.js]` và không có entrypoint lạ → image có thể đúng bản chuẩn.
- Nếu `Cmd`/`Entrypoint` trỏ tới `2kXCNE` hoặc file lạ → **image không chuẩn hoặc bị sửa**.

### Bước 2: Trong container có những file gì?

```bash
docker exec aiportal-frontend ls -la /app
docker exec aiportal-frontend cat /app/package.json 2>/dev/null || true
```

- Chuẩn: có `server.js`, `node_modules`, `.next`, `public`.
- Nếu có file `2kXCNE`, `2e1JI`, `AbUUKjg` hoặc binary lạ → **cần điều tra thêm (có thể mã độc hoặc build khác)**.

### Bước 3: Process thực tế trong container

```bash
docker exec aiportal-frontend ps aux
# hoặc
docker top aiportal-frontend
```

So sánh với htop: nếu vẫn là `/app/2kXCNE` thì image/entrypoint không phải bản `node server.js` trong repo.

### Bước 4: Xác định loại file (trên server đã chạy)

```bash
docker exec aiportal-frontend file /app/2kXCNE /app/2e1JI /app/AbUUKjg
```

- Nếu ra **"JavaScript"** hoặc **"Node script"** → đúng là chunk/worker do Next.js build (tên hash), không phải binary lạ.
- Nếu ra **"ELF 64-bit LSB executable"** → native binary, cần điều tra nguồn.

### Bước 5: Image build từ đâu?

- Nếu dùng `docker compose build` tại repo này → image phải có `node server.js`.
- Nếu dùng `image: something/ai-portal-frontend:latest` (pull từ registry) → image có thể do pipeline/team khác build (có thể dùng pkg/tên hash). Cần kiểm tra pipeline/Dockerfile của image đó.

---

## Khuyến nghị

### Ngay lập tức

1. **Chạy đủ 4 bước kiểm tra trên** và lưu output (`docker inspect`, `ls -la /app`, `ps aux` / `docker top`).
2. **Giới hạn tài nguyên** cho container frontend (xem section dưới) để tránh 1 container chiếm hết CPU/RAM.
3. **Rebuild image từ repo hiện tại** (có fix typewriter), không dùng image cũ hoặc image từ nguồn chưa rõ:
   ```bash
   cd AI-Portal
   docker compose build --no-cache frontend
   docker compose up -d frontend
   ```
4. Sau khi deploy lại, kiểm tra lại `docker stats` và `htop`: số PIDs phải giảm mạnh (cỡ vài chục trở xuống), CPU không còn 700%+ liên tục.

### Dài hạn

- Chỉ dùng image build từ Dockerfile trong repo (hoặc từ CI/CD có nguồn gốc rõ).
- Bật resource limits (CPU/memory) cho tất cả container production.
- Nếu sau khi rebuild từ repo mà vẫn thấy process tên lạ hoặc PIDs > ~100 → cần điều tra thêm (malware / dependency bị compromise).

---

## Resource limits (đã thêm vào docker-compose.yml)

Trong `docker-compose.yml` đã có:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 3G
    reservations:
      cpus: '0.25'
      memory: 512M
```

- **limits:** container không vượt quá 4 CPU, 3GB RAM → tránh runaway chiếm hết máy.
- **reservations:** tối thiểu 0.25 CPU, 512MB RAM.

**Lưu ý:** Với `docker compose up` (không dùng Swarm), mục `deploy` có thể bị bỏ qua. Để áp dụng limits khi chạy bình thường:

```bash
# Cách 1: dùng compatibility mode
docker compose --compatibility up -d

# Cách 2: áp limits cho container đang chạy
docker update aiportal-frontend --cpus=4 --memory=3g
```

Sau khi thêm limits, rebuild/redeploy và theo dõi lại htop / docker stats.
