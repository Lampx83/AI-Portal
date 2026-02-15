# AI Portal

## Trợ lý Dữ liệu (Data Agent) — cài qua trang Quản trị (Plugins)

Data Agent không built-in. Cách bật:

1. **Đóng gói Data Agent** (trong repo AI-Agents):  
   `cd AI-Agents && npm install && npm run pack` → tạo file `dist/data-agent.zip`. Host file zip này (GitHub Releases, static server, …).

2. **Cấu hình AI-Portal**: Đặt biến môi trường `DATA_AGENT_PACKAGE_URL` trỏ tới URL file zip (vd. `https://.../data-agent.zip`).

3. **Trong trang Quản trị**: Vào **Admin → tab Plugins** → bấm **Thêm**. Backend tải gói từ URL, giải nén, mount và thêm trợ lý "data". Dùng được ngay.

## Xuất / Nhập danh sách Agents (Database)

Thông tin agents (bảng `ai_portal.assistants`) có thể xuất ra file JSON để lưu hoặc import vào hệ thống khác.

- **Trong Admin**: Vào **Admin → tab Agents** → **Xuất file** (tải `agents-export.json`) hoặc **Nhập từ file** (chọn file JSON đã xuất trước đó). Nhập theo alias: trùng alias sẽ cập nhật, chưa có thì thêm mới.
- **Dòng lệnh (xuất ra file trong repo)**: Trong thư mục `backend` chạy `npm run export-agents`. Kết quả ghi vào `backend/data/agents-export.json`. Cần cấu hình kết nối Postgres (biến môi trường như khi chạy backend).

Định dạng file: `{ "version": 1, "schema": "ai_portal.assistants", "exported_at": "...", "agents": [ { "alias", "icon", "base_url", "domain_url", "is_active", "display_order", "config_json" }, ... ] }`.

## Tab Datalake (Admin) — cần LakeFlow chạy

Tab Datalake gọi API LakeFlow (port 8011). **Chạy local:** trong thư mục Datalake chạy `docker compose up -d` (hoặc `uvicorn` backend LakeFlow trên port 8011).

**AI Portal chạy trong Docker, LakeFlow trên host (cùng máy):** không dùng `localhost:8011` — từ container không tới được host. Set trong `.env`: `LAKEFLOW_API_URL=http://host.docker.internal:8011` (Mac/Windows). Linux: dùng IP máy host (vd. `http://172.17.0.1:8011`). Nếu **không** set `LAKEFLOW_API_URL` thì backend tự dùng `host.docker.internal:8011` khi chạy trong Docker.

## Chạy Docker chế độ dev

Khi chạy bằng Docker ở chế độ dev, source được mount vào container và backend/frontend chạy dev server → sửa code không cần build lại image.

**Lưu ý:** Để build nhanh, không set `DOCKER_DEFAULT_PLATFORM` (build native).

**Lần đầu hoặc sau khi đổi Dockerfile.dev:**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**Nếu Postgres báo lỗi** `initdb: error: directory "/var/lib/postgresql/data" exists but is not empty` (volume cũ lỗi hoặc không tương thích), xóa volume và chạy lại:

```bash
./scripts/reset-postgres-volume.sh
```

Hoặc thủ công: `docker compose -f docker-compose.yml -f docker-compose.dev.yml down` → `docker volume ls | grep postgres` → `docker volume rm <tên_volume>` → `docker compose ... up --build`.

**Các lần sau (container đã có):**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- **Backend:** sửa file trong `backend/src/` → API tự reload (tsx watch).
- **Frontend:** sửa file trong `frontend/app/`, `frontend/components/`, `frontend/lib/`, … → Next.js dev tự reload.

## Chạy Docker chế độ production

```bash
docker compose up --build
```

Build image production và chạy backend/frontend ở chế độ production.

## Deploy: LakeFlow trên server khác

Khi Datalake/LakeFlow chạy trên máy khác (vd. server 224, IP nội bộ 10.2.13.55), trên server chạy AI Portal cần set trong `.env`:

```bash
LAKEFLOW_API_URL=http://10.2.13.55:8011
```

Một biến này dùng cho cả tab Datalake (Admin) và trợ lý Quy chế (embedding). Không cần set `REGULATIONS_EMBEDDING_URL` riêng trừ khi dùng URL embedding khác.
