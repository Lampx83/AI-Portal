# Research

## Tab Datalake (Admin) — cần LakeFlow chạy

Tab Datalake gọi API LakeFlow (port 8011). **Chạy local:** trong thư mục Datalake chạy `docker compose up -d` (hoặc `uvicorn` backend LakeFlow trên port 8011).

**Research chạy trong Docker, LakeFlow trên host (cùng máy):** không dùng `localhost:8011` — từ container không tới được host. Set trong `.env`: `LAKEFLOW_API_URL=http://host.docker.internal:8011` (Mac/Windows). Linux: dùng IP máy host (vd. `http://172.17.0.1:8011`). Nếu **không** set `LAKEFLOW_API_URL` thì backend tự dùng `host.docker.internal:8011` khi chạy trong Docker.

## Chạy Docker chế độ dev

Khi chạy bằng Docker ở chế độ dev, source được mount vào container và backend/frontend chạy dev server → sửa code không cần build lại image.

**Lần đầu hoặc sau khi đổi Dockerfile.dev:**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

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

Khi Datalake/LakeFlow chạy trên máy khác (vd. server 224, IP nội bộ 10.2.13.55), trên server chạy Research cần set trong `.env`:

```bash
LAKEFLOW_API_URL=http://10.2.13.55:8011
```

Một biến này dùng cho cả tab Datalake (Admin) và trợ lý Quy chế (embedding). Không cần set `REGULATIONS_EMBEDDING_URL` riêng trừ khi dùng URL embedding khác.
