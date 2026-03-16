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
docker inspect aiportal-frontend --format 'Cmd: {{.Config.Cmd}} Entrypoint: {{.Config.Entrypoint}}'

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

---

## Tìm nguyên nhân gốc (root cause) — không chỉ giới hạn CPU

Khi thấy process dạng `/app/A8fsh9G -c /app/aR7 -B` (tên khác build khác: `2kXCNE`, `2e1JI`, …) chiếm 100% CPU, cần phân biệt **hai nguồn** rồi mới xử lý đúng.

### Bước 0: Xác định đây là Next.js (JS) hay mã độc (binary)

Chạy **trong container** (hoặc trên host nếu biết chắc PID thuộc container frontend):

```bash
# Thay A8fsh9G, aR7 bằng đúng tên process bạn thấy trong htop
docker exec aiportal-frontend file /app/A8fsh9G /app/aR7
docker exec aiportal-frontend head -c 200 /app/A8fsh9G | xxd
```

**Nếu container không có lệnh `file`** (image Alpine mặc định), dùng:
```bash
docker exec aiportal-frontend head -c 4 /app/TÊN_FILE | xxd
```
- `7f 45 4c 46` = ELF (binary). `28`, `7b`, `21`… = ASCII (JS/text).

- **Nếu ra "JavaScript" hoặc "ASCII text" / nội dung giống JS:** đây là **chunk/worker do Next.js build** (tên hash), không phải miner. → Đi tiếp bước 1.
- **Nếu ra "ELF 64-bit LSB executable" hoặc binary:** khả năng cao **image bị nhiễm** (miner/backdoor). → Dừng dùng image đó, xem mục **"Khi đã xác định là ELF — tìm nguồn nhiễm"** bên dưới.

### Khi đã xác định là ELF — tìm nguồn nhiễm

Container vẫn chạy đúng CMD `[node server.js]` nhưng trong `/app` có file ELF (tên dạng hash, mỗi build khác nhau: A8fsh9G, 8t5Ey…). Binary **không** nằm trong source repo (đã `find ./frontend` không thấy). Nguồn khả dĩ:

1. **Dependency npm bị compromise** — postinstall/install script tải binary vào image. Cần kiểm tra script trong `node_modules`.
2. **Máy build bị nhiễm** — malware trên host inject vào build context hoặc layer trong lúc build.
3. **Image kéo từ registry** — image đã bị sửa trước khi pull.

**Bước điều tra:**

- **Entrypoint/Cmd (một lệnh in cả hai):**
  ```bash
  docker inspect aiportal-frontend --format 'Cmd: {{.Config.Cmd}} Entrypoint: {{.Config.Entrypoint}}'
  ```
  Nếu Cmd vẫn là `[node server.js]` → binary được **spawn từ bên trong** (server.js hoặc module được load).

- **Layer nào thêm file ELF:** sau khi build xong frontend, ghi lại IMAGE ID rồi:
  ```bash
  docker history --no-trunc <IMAGE_ID>
  ```
  Xem từng layer; layer nào COPY từ builder hoặc chạy npm có thể chứa file lạ. Có thể chạy container tạm từ layer trước layer nghi ngờ để so sánh:
  ```bash
  docker run --rm --entrypoint '' <IMAGE_ID> ls -la /app
  ```

- **Kiểm tra npm scripts (trên máy build, trong thư mục frontend):**
  ```bash
  npm run build 2>&1  # local build
  ls -la .next/standalone/   # có file tên hash không? chạy: head -c 4 .next/standalone/TÊN | xxd
  grep -r "postinstall\|install\|prepare" node_modules/*/package.json 2>/dev/null | head -20
  ```
  Nếu file ELF xuất hiện trong `.next/standalone/` sau `npm run build` local → nhiễm từ dependency (script chạy lúc build). Nếu không có trên máy dev nhưng có trong image Docker → nhiễm trong bước build Docker (có thể máy build khác bị nhiễm).

- **Build trên môi trường sạch:** clone repo vào máy/CI chưa từng chạy AI Portal, `docker compose build --no-cache frontend`, rồi `docker run --rm --entrypoint '' <image> ls /app` và `head -c 4 /app/TÊN | xxd`. Nếu vẫn có ELF → nguồn nằm trong repo hoặc base image/dependency. Nếu không có → máy build cũ bị nhiễm.

Sau khi xác định nguồn: dừng dùng image nhiễm, build lại từ nguồn sạch (lockfile + dependency đã audit), đổi toàn bộ secrets.

### Bước 1: Nếu là Next.js — nguyên nhân thường gặp

1. **Image cũ, chưa có fix typewriter**  
   Fix vòng re-render vô hạn nằm trong `components/ui/typewriter-markdown.tsx`. Nếu deploy image build trước khi có fix (hoặc từ nguồn khác), worker/chunk vẫn có thể chạy loop → 100% CPU.  
   **Cách xử lý:** rebuild từ repo hiện tại (có fix), không dùng image cũ:
   ```bash
   docker compose build --no-cache frontend && docker compose up -d frontend
   ```

2. **Next.js 16 spawn worker theo số CPU**  
   Số process ~ số core (vd. 32 process trên máy 32 core) có thể do Next/Node dùng worker pool. Các worker đó đang chạy **mã gì** mới quan trọng: nếu là chunk JS (bước 0) và bị loop (typewriter hoặc RSC), mỗi worker sẽ 100% CPU.  
   **Cách xử lý:** đảm bảo đã deploy image có fix typewriter; nếu vẫn xảy ra thì tìm route/component gây loop (xem bước 2).

3. **Vòng lặp ở RSC / API / middleware**  
   Infinite loop hoặc xử lý rất nặng trong React Server Components, API route, hoặc middleware cũng có thể đẩy CPU lên 100%.  
   **Cách xử lý:** tắt từng phần (vd. tắt typing effect, bypass route nghi ngờ) để thu hẹp đoạn code gây ra.

### Bước 2: Thu hẹp đoạn code gây runaway

- **Tắt typing effect tạm thời:** trong `components/ui/chat-messages.tsx` set `typingEffect={false}` cho message assistant (hoặc luôn dùng nhánh `<ReactMarkdown>...</ReactMarkdown>` thay vì `<TypewriterMarkdown>`). Rebuild và chạy lại. Nếu CPU hết runaway → nguyên nhân gốc liên quan typewriter (đã fix trong repo; cần image mới).
- **Xem route nào được gọi khi CPU lên:** kiểm tra access log (proxy/nginx) hoặc `docker logs aiportal-frontend` khi CPU tăng. Nếu chỉ tăng khi vào trang chat/assistant → trùng với typewriter/chat.
- **So sánh với build sạch:** build local `npm run build` rồi so sánh:
  ```bash
  ls -la frontend/.next/standalone/
  ```
  Các file tên hash (A8fsh9G, aR7, …) sẽ khác mỗi lần build; điều quan trọng là chúng phải là **JS trong repo**, không phải file lạ thêm từ bên ngoài.

### Bước 3: Chạy script chẩn đoán (trong repo)

Trong repo có script `scripts/diagnose-frontend-cpu.sh`. Chạy trên **host** (có Docker):

```bash
./scripts/diagnose-frontend-cpu.sh
```

Script in ra: CMD/Entrypoint, danh sách file trong `/app`, `file` cho process lạ, `ps aux` trong container. Lưu output để so sánh sau khi rebuild hoặc khi đổi môi trường.

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
