# Research

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
