#!/usr/bin/env bash
# Chi khoi dong Postgres + Minio cho AI-Portal.
# Cach dung (tu thu muc goc repo):
#   ./scripts/dev-ai-portal-storage.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "${ROOT}/docker-compose.yml" ]]; then
  PORTAL="$ROOT"
elif [[ -f "${ROOT}/AI-Portal/docker-compose.yml" ]]; then
  PORTAL="${ROOT}/AI-Portal"
else
  echo "Khong tim thay docker-compose.yml tai ${ROOT} hoac ${ROOT}/AI-Portal"
  exit 1
fi

cd "$PORTAL"

echo "=== AI-Portal storage only (Postgres + Minio) ==="
docker compose -f docker-compose.yml up postgres minio
echo ""
echo "Postgres: localhost:5432"
echo "Minio API: localhost:9000"
echo "Minio Console: http://localhost:9001"
echo ""
echo "Dung de dung dich vu:"
echo "  docker compose -f docker-compose.yml stop postgres minio"
