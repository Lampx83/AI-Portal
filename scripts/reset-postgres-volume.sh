#!/usr/bin/env bash
# Xóa volume Postgres và khởi động lại stack.
# Dùng khi gặp lỗi: initdb: error: directory "/var/lib/postgresql/data" exists but is not empty
# Lưu ý: Toàn bộ dữ liệu trong PostgreSQL sẽ bị xóa.

set -e
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dev.yml"

echo "Stopping stack..."
$COMPOSE down

echo "Removing Postgres volume..."
for vol in $(docker volume ls -q 2>/dev/null | grep postgres_data || true); do
  echo "  Removing volume: $vol"
  docker volume rm "$vol" 2>/dev/null || true
done

echo "Starting stack (build if needed)..."
$COMPOSE up --build -d

echo "Done. Run '$COMPOSE up' without -d to follow logs."
