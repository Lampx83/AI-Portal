#!/usr/bin/env bash
# Chạy AI-Portal dev bằng Docker với basePath linh hoạt.
# Ví dụ:
#   ./scripts/dev-ai-portal.sh
#   ./scripts/dev-ai-portal.sh --basepath /tuyen-sinh
#   ./scripts/dev-ai-portal.sh --basepath /portal --port 8010
#   ./scripts/dev-ai-portal.sh --basepath /portal --detach
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

BASE_PATH="${BASE_PATH:-/base-path}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
DETACH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --basepath)
      BASE_PATH="${2:-}"
      shift 2
      ;;
    --basepath=*)
      BASE_PATH="${1#*=}"
      shift
      ;;
    --port)
      FRONTEND_PORT="${2:-}"
      shift 2
      ;;
    --port=*)
      FRONTEND_PORT="${1#*=}"
      shift
      ;;
    --detach|-d)
      DETACH=true
      shift
      ;;
    *)
      echo "Tham so khong hop le: $1"
      echo "Dung: $0 [--basepath /tuyen-sinh] [--port 3000] [--detach]"
      exit 1
      ;;
  esac
done

if [[ -z "${BASE_PATH}" || "${BASE_PATH:0:1}" != "/" ]]; then
  echo "BASE_PATH phai bat dau bang '/'. Vi du: /tuyen-sinh"
  exit 1
fi

NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${FRONTEND_PORT}${BASE_PATH}}"
APP_URL="${APP_URL:-${NEXTAUTH_URL}}"

cd "$PORTAL"

echo "=== AI-Portal dev (Docker + basePath) ==="
echo "BASE_PATH:     ${BASE_PATH}"
echo "FRONTEND_PORT: ${FRONTEND_PORT}"
echo "NEXTAUTH_URL:  ${NEXTAUTH_URL}"
echo "APP_URL:       ${APP_URL}"
echo "Truy cap:      http://localhost:${FRONTEND_PORT}${BASE_PATH}"
echo ""

COMPOSE_ARGS=(
  -f docker-compose.yml
  -f docker-compose.dev.yml
  -f docker-compose.basepath.yml
)

if [[ "${DETACH}" == "true" ]]; then
  BASE_PATH="${BASE_PATH}" \
  FRONTEND_PORT="${FRONTEND_PORT}" \
  NEXTAUTH_URL="${NEXTAUTH_URL}" \
  APP_URL="${APP_URL}" \
  docker compose "${COMPOSE_ARGS[@]}" up --build -d
else
  BASE_PATH="${BASE_PATH}" \
  FRONTEND_PORT="${FRONTEND_PORT}" \
  NEXTAUTH_URL="${NEXTAUTH_URL}" \
  APP_URL="${APP_URL}" \
  docker compose "${COMPOSE_ARGS[@]}" up --build
fi
