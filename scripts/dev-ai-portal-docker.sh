#!/usr/bin/env bash
# Chạy AI-Portal dev 100% bằng Docker (postgres, minio, backend, frontend — hot reload).
# Cách dùng (từ thư mục gốc repo):
#   ./scripts/dev-ai-portal-docker.sh              — frontend http://localhost:3000
#   ./scripts/dev-ai-portal-docker.sh --tuyen-sinh  — frontend http://localhost:8010/tuyen-sinh (basePath)
#
# Nếu vẫn lỗi "Can't resolve …" sau khi thêm package: trong thư mục AI-Portal chạy
#   docker compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend npm install --legacy-peer-deps
# rồi restart container frontend (hoặc docker compose … up --build lại — compose.dev đã chạy npm install mỗi lần start).
#
# Ảnh Guide/MinIO: compose.dev set MINIO_PUBLIC_BASE_URL + policy bucket public GetObject. Sau khi cập nhật compose, chạy lại up --build và upload lại ảnh (hoặc chỉ cần mở lại trang nếu URL đã là localhost:9000).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Khi chạy từ trong AI-Portal (./scripts/dev-ai-portal-docker.sh) thì ROOT đã là AI-Portal; nếu không thì thử ROOT/AI-Portal
if [[ -f "${ROOT}/docker-compose.yml" ]]; then
  PORTAL="$ROOT"
elif [[ -f "${ROOT}/AI-Portal/docker-compose.yml" ]]; then
  PORTAL="${ROOT}/AI-Portal"
else
  echo "Không tìm thấy docker-compose.yml tại ${ROOT} hoặc ${ROOT}/AI-Portal"
  exit 1
fi

TUYEN_SINH=false
[[ "${1:-}" == "--tuyen-sinh" ]] && TUYEN_SINH=true

cd "$PORTAL"
if [[ "$TUYEN_SINH" == true ]]; then
  echo "=== AI-Portal dev (Docker) — basePath /tuyen-sinh, cổng 8010 ==="
  echo "Truy cập: http://localhost:8010/tuyen-sinh"
  echo ""
  docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.dev-tuyen-sinh.yml up --build
else
  echo "=== AI-Portal dev (Docker) — cổng 3000 ==="
  echo "Truy cập: http://localhost:3000"
  echo ""
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
fi
