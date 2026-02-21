#!/usr/bin/env bash
# Build và push AI Portal (backend + frontend) lên Docker Hub.
# Cần: Docker đã cài, đã login (docker login).
# Cách dùng:
#   export DOCKERHUB_USER=your-username
#   ./push-dockerhub.sh
# Hoặc:
#   DOCKERHUB_USER=your-username ./push-dockerhub.sh

set -e
cd "$(dirname "$0")"

if [ -z "${DOCKERHUB_USER}" ]; then
  echo "Lỗi: Chưa đặt DOCKERHUB_USER (username Docker Hub)."
  echo "Ví dụ: export DOCKERHUB_USER=myuser"
  echo "       ./push-dockerhub.sh"
  exit 1
fi

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml"

echo "=== Build backend & frontend (image: ${DOCKERHUB_USER}/ai-portal-*) ==="
$COMPOSE build backend frontend

echo "=== Push lên Docker Hub ==="
$COMPOSE push backend frontend

echo "=== Xong. Image đã đẩy: ==="
echo "  ${DOCKERHUB_USER}/ai-portal-backend:latest"
echo "  ${DOCKERHUB_USER}/ai-portal-frontend:latest"
